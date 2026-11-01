const { getPKTDate } = require('../utils/timezone');
const { Pool, types } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');
const { tokenizeSqlPlaceholders } = require('./sqlTokenizer');
const { parseNumeric, round2 } = require('../utils/money');

// 1. Explicit Type Parsers:
// OID 20: BIGINT (int8) -> parsed to integer Number (safe up to 9,007,199,254,740,991)
types.setTypeParser(20, (val) => (val === null ? null : parseInt(val, 10)));
// OID 1700: NUMERIC / DECIMAL -> parsed to safe 2-decimal float via parseNumeric
types.setTypeParser(1700, (val) => (val === null ? null : parseNumeric(val)));
// OID 1082: DATE -> returns string 'YYYY-MM-DD' as-is without UTC time shifts
types.setTypeParser(1082, (val) => val);

// 2. Transaction AsyncLocalStorage:
// Enforces that every query executed inside a transaction is bound to EXACTLY ONE checked-out client.
const txStorage = new AsyncLocalStorage();

class PostgresAdapter {
  constructor(config = {}) {
    this.config = config;
    this.pool = null;
    this.pglite = null;
    this.isPGlite = false;
  }

  async init() {
    if (this.config.usePGlite) {
      const { PGlite } = require('@electric-sql/pglite');
      this.pglite = new PGlite(this.config.pgliteDataDir);
      this.isPGlite = true;
      return;
    }

    const connectionString = this.config.connectionString || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required when DB_DRIVER=postgres');
    }
    const poolSize = this.config.max || parseInt(process.env.DATABASE_POOL_SIZE, 10) || 10;
    const stmtTimeout = parseInt(process.env.PG_STATEMENT_TIMEOUT, 10) || 15000;
    const idleTxTimeout = parseInt(process.env.PG_IDLE_TX_TIMEOUT, 10) || 10000;

    this.pool = new Pool({
      connectionString,
      max: poolSize,
      idleTimeoutMillis: this.config.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: this.config.connectionTimeoutMillis || 5000,
      statement_timeout: stmtTimeout,
      idle_in_transaction_session_timeout: idleTxTimeout,
      ssl: this.config.ssl || false
    });

    // Connection verification with retry loop
    let client = null;
    let retries = 3;
    let delay = 1000;

    while (retries > 0) {
      try {
        client = await this.pool.connect();
        break;
      } catch (connErr) {
        retries--;
        if (retries === 0) throw connErr;
        console.warn(`[POSTGRES CONNECTION RETRY] Failed to connect, retrying in ${delay}ms... (${connErr.message})`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      }
    }

    try {
      const verRes = await client.query("SELECT current_setting('server_version_num')::int as ver_num, version() as ver_str");
      const verNum = verRes.rows[0].ver_num;
      const verStr = verRes.rows[0].ver_str;

      console.log(`[POSTGRES INITIALIZED] Pool Size: ${poolSize} | Statement Timeout: ${stmtTimeout}ms | Idle TX Timeout: ${idleTxTimeout}ms`);
      console.log(`[POSTGRES VERSION DETECTED] ${verStr}`);

      if (verNum < 160000) {
        throw new Error(`FATAL: PostgreSQL version ${verStr} is lower than required major version 16.0!`);
      }
    } finally {
      if (client) client.release();
    }
  }

  /**
   * Health latency measurement probe
   */
  async measureLatency() {
    const start = Date.now();
    await this.query('SELECT 1');
    return Date.now() - start;
  }

  /**
   * Returns the currently active transaction context (checked-out client) if inside a transaction.
   */
  getActiveClient() {
    return txStorage.getStore() || null;
  }

  /**
   * Execute multi-statement SQL script (DDL / migrations)
   */
  async exec(sql) {
    if (this.isPGlite) {
      await this.pglite.exec(sql);
      return;
    }
    const client = this.getActiveClient() ? this.getActiveClient().client : this.pool;
    await client.query(sql);
  }

  /**
   * Execute raw query with automatic ? -> $n tokenization.
   * If inside a transaction, strictly executes on the checked-out client.
   * If NOT inside a transaction, executes via pool.
   * Numbers are automatically parsed as numeric via global pg.types parsers (OID 20 & 1700).
   */
  async query(sql, params = []) {
    const tokenizedSql = tokenizeSqlPlaceholders(sql);
    const activeTx = this.getActiveClient();

    if (activeTx) {
      // FORBIDDEN to use pool/instance query inside a transaction. Bound strictly to active client.
      const res = await activeTx.client.query(tokenizedSql, params);
      const rowCount = res.rowCount !== undefined ? res.rowCount : (res.affectedRows !== undefined ? res.affectedRows : (res.rows ? res.rows.length : 0));
      return {
        rows: res.rows || [],
        rowCount
      };
    }

    if (this.isPGlite) {
      const res = await this.pglite.query(tokenizedSql, params);
      const rowCount = res.rowCount !== undefined ? res.rowCount : (res.affectedRows !== undefined ? res.affectedRows : (res.rows ? res.rows.length : 0));
      return {
        rows: res.rows || [],
        rowCount
      };
    }

    const res = await this.pool.query(tokenizedSql, params);
    return res;
  }

  async all(sql, params = []) {
    const res = await this.query(sql, params);
    return res.rows;
  }

  async get(sql, params = []) {
    const res = await this.query(sql, params);
    return res.rows && res.rows.length > 0 ? res.rows[0] : null;
  }

  async run(sql, params = []) {
    let finalSql = sql;
    // For INSERT statements without RETURNING id, append RETURNING id
    const isInsert = /^\s*INSERT\s+INTO/i.test(sql);
    const hasReturning = /RETURNING/i.test(sql);
    if (isInsert && !hasReturning) {
      finalSql = `${sql.trim().replace(/;$/, '')} RETURNING id;`;
    }

    const res = await this.query(finalSql, params);
    const lastRow = res.rows && res.rows.length > 0 ? res.rows[0] : null;
    return {
      rowCount: res.rowCount || 0,
      lastInsertRowid: lastRow ? lastRow.id : null,
      rows: res.rows || []
    };
  }

  /**
   * Atomic Transaction Scope
   * Binds the entire callback execution to ONE single checked-out client.
   * Any query executed during callback execution is routed to this client.
   */
  async transaction(callback, maxRetries = 3) {
    if (this.isPGlite) {
      return await this.pglite.transaction(async (tx) => {
        return await txStorage.run({ client: tx, isTx: true, id: Math.random() }, async () => {
          return await callback(this);
        });
      });
    }

    let attempt = 0;
    while (true) {
      attempt++;
      const client = await this.pool.connect();
      const txContext = {
        client,
        isTx: true,
        txId: Math.random().toString(36).substring(2, 9),
        connectionPid: null
      };

      try {
        const pidRes = await client.query('SELECT pg_backend_pid() AS pid');
        txContext.connectionPid = pidRes.rows[0].pid;

        await client.query('BEGIN');

        const result = await txStorage.run(txContext, async () => {
          return await callback(this);
        });

        await client.query('COMMIT');
        return result;
      } catch (err) {
        try {
          await client.query('ROLLBACK');
        } catch (rbErr) {
          // ignore rollback errors on closed / dead connection
        }

        // Retry on PostgreSQL deadlock (40P01) or serialization failure (40001)
        if ((err.code === '40P01' || err.code === '40001') && attempt < maxRetries) {
          const delayMs = Math.floor(Math.random() * 40) + attempt * 40;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        throw err;
      } finally {
        client.release();
      }
    }
  }

  /**
   * Atomic Per-Tenant Sequential Numbering
   * Uses locked counters table with INSERT ... ON CONFLICT DO UPDATE ... RETURNING
   * Guarantees zero duplicate invoice/receipt numbers even under high concurrency.
   */
  async getNextNumber(tenantId, counterType, prefix, padLength = 4, forDate = new Date()) {
    const today = getPKTDate(forDate).replace(/-/g, '');
    const fullType = `${counterType}_${today}`;

    const sql = `
      INSERT INTO counters (tenant_id, counter_type, last_number, updated_at)
      VALUES ($1, $2, 1, CURRENT_TIMESTAMP)
      ON CONFLICT (tenant_id, counter_type)
      DO UPDATE SET last_number = counters.last_number + 1, updated_at = CURRENT_TIMESTAMP
      RETURNING last_number;
    `;

    const res = await this.query(sql, [tenantId, fullType]);
    const num = res.rows[0].last_number;
    const formattedNum = String(num).padStart(padLength, '0');
    return `${prefix}-${today}-${formattedNum}`;
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

module.exports = {
  PostgresAdapter,
  txStorage
};
