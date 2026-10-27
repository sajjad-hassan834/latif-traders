/**
 * SQL Parameter Tokenizer & Driver Dialect Normalizer
 * Safely converts SQLite '?' positional parameters to PostgreSQL '$1, $2, ...' placeholders,
 * and handles driver-specific keywords (ILIKE/LIKE, FOR UPDATE) without regex magic.
 * 
 * Strict Tokenization Rules:
 *  1. Skips single-quoted string literals: 'hello ? world' (including escaped quotes '')
 *  2. Skips double-quoted identifiers: "column ? name"
 *  3. Skips single-line comments: -- some comment with ?
 *  4. Skips multi-line comments: /* comment with ? * /
 *  5. Replaces only bare, unquoted tokens.
 */

function tokenizeSqlPlaceholders(sql) {
  if (typeof sql !== 'string') return sql;

  let result = '';
  let paramIndex = 1;
  const len = sql.length;
  let i = 0;

  while (i < len) {
    const ch = sql[i];
    const next = i + 1 < len ? sql[i + 1] : '';

    // 1. Single-line comment: --
    if (ch === '-' && next === '-') {
      let end = sql.indexOf('\n', i + 2);
      if (end === -1) end = len;
      result += sql.slice(i, end);
      i = end;
      continue;
    }

    // 2. Multi-line comment: /* ... */
    if (ch === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2);
      if (end === -1) {
        result += sql.slice(i);
        break;
      }
      result += sql.slice(i, end + 2);
      i = end + 2;
      continue;
    }

    // 3. Single-quoted string: '...'
    if (ch === "'") {
      let j = i + 1;
      let str = "'";
      while (j < len) {
        if (sql[j] === "'") {
          if (j + 1 < len && sql[j + 1] === "'") {
            str += "''";
            j += 2;
            continue;
          }
          str += "'";
          j++;
          break;
        } else {
          str += sql[j];
          j++;
        }
      }
      result += str;
      i = j;
      continue;
    }

    // 4. Double-quoted identifier: "..."
    if (ch === '"') {
      let j = i + 1;
      let str = '"';
      while (j < len) {
        if (sql[j] === '"') {
          if (j + 1 < len && sql[j + 1] === '"') {
            str += '""';
            j += 2;
            continue;
          }
          str += '"';
          j++;
          break;
        } else {
          str += sql[j];
          j++;
        }
      }
      result += str;
      i = j;
      continue;
    }

    // 5. Bare placeholder: ?
    if (ch === '?') {
      result += `$${paramIndex++}`;
      i++;
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

/**
 * Normalizes SQL for target driver (sqlite or postgres) using tokenization (skips quoted text)
 */
function tokenizeSqlForDriver(sql, driver = 'postgres') {
  if (typeof sql !== 'string') return sql;

  let result = '';
  let paramIndex = 1;
  const len = sql.length;
  let i = 0;

  const isWordBoundary = (char) => !char || /[\s,;()\.\+\-\*\/<>=]/.test(char);

  while (i < len) {
    const ch = sql[i];
    const next = i + 1 < len ? sql[i + 1] : '';

    // 1. Single-line comment: --
    if (ch === '-' && next === '-') {
      let end = sql.indexOf('\n', i + 2);
      if (end === -1) end = len;
      result += sql.slice(i, end);
      i = end;
      continue;
    }

    // 2. Multi-line comment: /* ... */
    if (ch === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2);
      if (end === -1) {
        result += sql.slice(i);
        break;
      }
      result += sql.slice(i, end + 2);
      i = end + 2;
      continue;
    }

    // 3. Single-quoted string: '...'
    if (ch === "'") {
      let j = i + 1;
      let str = "'";
      while (j < len) {
        if (sql[j] === "'") {
          if (j + 1 < len && sql[j + 1] === "'") {
            str += "''";
            j += 2;
            continue;
          }
          str += "'";
          j++;
          break;
        } else {
          str += sql[j];
          j++;
        }
      }
      result += str;
      i = j;
      continue;
    }

    // 4. Double-quoted identifier: "..."
    if (ch === '"') {
      let j = i + 1;
      let str = '"';
      while (j < len) {
        if (sql[j] === '"') {
          if (j + 1 < len && sql[j + 1] === '"') {
            str += '""';
            j += 2;
            continue;
          }
          str += '"';
          j++;
          break;
        } else {
          str += sql[j];
          j++;
        }
      }
      result += str;
      i = j;
      continue;
    }

    // 5. Bare placeholder: ?
    if (ch === '?') {
      if (driver === 'postgres') {
        result += `$${paramIndex++}`;
      } else {
        result += '?';
      }
      i++;
      continue;
    }

    // 6. Keyword translation (ILIKE <-> LIKE)
    const prevChar = i > 0 ? sql[i - 1] : null;
    if (isWordBoundary(prevChar)) {
      // Check for ILIKE keyword
      if (sql.slice(i, i + 5).toUpperCase() === 'ILIKE' && isWordBoundary(sql[i + 5])) {
        if (driver === 'sqlite') {
          result += 'LIKE';
        } else {
          result += 'ILIKE';
        }
        i += 5;
        continue;
      }

      // Check for FOR UPDATE clause (strip for SQLite)
      if (driver === 'sqlite' && sql.slice(i, i + 10).toUpperCase() === 'FOR UPDATE' && isWordBoundary(sql[i + 10])) {
        i += 10;
        continue;
      }
    }

    // 7. Postgres Typecasts (::text, ::int, ::integer, ::date) -> strip for SQLite
    if (ch === ':' && next === ':') {
      let j = i + 2;
      while (j < len && /[a-zA-Z_]/.test(sql[j])) {
        j++;
      }
      if (driver === 'sqlite') {
        i = j;
        continue;
      } else {
        result += sql.slice(i, j);
        i = j;
        continue;
      }
    }

    result += ch;
    i++;
  }

  return result;
}

module.exports = {
  tokenizeSqlPlaceholders,
  tokenizeSqlForDriver
};
