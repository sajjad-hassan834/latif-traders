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

---

## Deployment Guide

### 1. Backend Deployment (Railway)

1. Go to [Railway](https://railway.app/) and create a **New Project** -> **Deploy from GitHub Repo**.
2. Select `sajjad-hassan834/latif-traders`.
3. In the Railway Service settings:
   - **Build Command**: Railway will use Nixpacks automatically.
   - **Start Command**: `node server/index.js` (handled by `Procfile` / `railway.json`).
4. **Environment Variables**:
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: Generate a secure random string (e.g. `your_long_secure_jwt_secret`)
   - `FRONTEND_URL`: Your Vercel frontend URL (e.g. `https://latif-traders.vercel.app`)
5. *(Recommended for SQLite persistence)* **Add Persistent Volume**:
   - In your Railway service dashboard, click **Add Volume**.
   - Set **Mount Path** to `/data`.
   - Add environment variable: `DATA_DIR=/data`.
   - This ensures your SQLite database, uploads, and backups persist across redeployments!
6. Generate a public domain under **Networking** (e.g. `https://latif-traders-production.up.railway.app`).

### 2. Frontend Deployment (Vercel)

1. Go to [Vercel](https://vercel.com/) and click **Add New** -> **Project**.
2. Import `sajjad-hassan834/latif-traders`.
3. In **Project Configuration**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `client` (or leave as root, both are supported with included `vercel.json` configs)
4. **Environment Variables**:
   - `VITE_API_URL`: Your Railway backend URL (e.g. `https://latif-traders-production.up.railway.app`)
5. Click **Deploy**.
6. When deployment finishes, copy your Vercel URL and ensure it is added to the Railway backend's `FRONTEND_URL` variable.

