# LATIF TRADERS - Frozen Food Management & POS ERP System

A modern, high-density ERP and Point of Sale (POS) solution tailored for frozen food trading, cold storage batch management, FIFO inventory costing, customer/supplier ledgers, operating expenses, and profit & loss financial reporting.

---

## Key Features

- **High-Speed Touch & Barcode POS**: Barcode scanning, item search, multiple payment methods (Cash, Card, Bank Transfer), customer credit assignments, and thermal receipt printing.
- **Cold Storage Batch & Expiry Control**: Multi-batch inventory tracking with manufacturing & expiration dates, days-remaining alerts, and FIFO cost accounting.
- **Dynamic Role-Based Access Control**:
  - **Owner / Administrator**: Full operational oversight, staff accounts, audit trails, and system backups.
  - **Sales Staff / Cashier**: POS terminal, customer checkout, recent sales, and Day-End Z-Register reports.
  - **Store / Warehouse Staff**: Receiving purchases, inventory adjustments, stock valuation, and batch expiry tracking.
  - **Accountant**: Customer receivables (Udhaar), supplier payables, operating expense logging, cashbook reconciliation, and P&L financial statements.
- **Executive Operations Dashboard**: Clean, tabbed command center with operational alerts (low stock & expiring batches), live sales feeds, and working capital summaries.
- **User Account Management**: Dedicated self-service profile and password update modal with permission inspection.
- **Disaster Recovery & Database Backups**: 1-click SQLite snapshot backup and restore system.

---

## Tech Stack

- **Frontend**: React 18, Vite, Vanilla CSS design tokens, Lucide Icons.
- **Backend**: Node.js, Express.js.
- **Database**: SQLite with `better-sqlite3` (WAL mode enabled for high-concurrency).
- **Authentication**: JWT with bcrypt password hashing and role-based route middleware.

---

## Quick Start

### 1. Install Dependencies
```bash
# Install server dependencies
npm install

# Install client dependencies
npm --prefix client install
```

### 2. Run in Development
```bash
npm run dev
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`

### 3. Default Login Credentials
| Username | Password | Role | Description |
| :--- | :--- | :--- | :--- |
| `admin` | `admin123` | Administrator | Full administrative access |
| `cashier` | `cashier123` | Sales / Cashier | POS Counter & Day Register |
| `store` | `store123` | Inventory | Stock, Batches & Purchases |
| `accountant` | `accountant123` | Accountant | Ledgers, Expenses & P&L |
