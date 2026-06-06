# SplitEasy — React Frontend

A full-featured expense splitting web app built with React 18, TypeScript, Vite, and Tailwind CSS. Connects to the SplitEasy FastAPI backend.

---

## Tech Stack

| Tool | Version | Purpose |
|------|---------|---------|
| React | 18 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 5 | Build tool & dev server |
| Tailwind CSS | 4 | Styling |
| React Router | 6 | Client-side routing |
| Axios | 1.7 | HTTP client |
| Bootstrap Icons | 1.11 | Icon set |

---

## Getting Started

### Prerequisites
- Node.js 18+
- SplitEasy backend running on port 8800

### Install & Run

```powershell
cd frontend-react
npm install
npm run dev
```

The dev server starts at `http://localhost:5173` and proxies all `/api/*` requests to `http://127.0.0.1:8800`.

### Build for Production

```powershell
npm run build
npm run preview
```

---

## Project Structure

```
frontend-react/
├── src/
│   ├── api/
│   │   └── client.ts              # Axios instance + JWT interceptor
│   ├── components/
│   │   ├── AddExpenseModal.tsx     # Create/edit expense with split modes
│   │   ├── CreateGroupModal.tsx    # Create group with type & members
│   │   ├── ManageMembersModal.tsx  # Add/remove group members
│   │   ├── ToastContainer.tsx      # Toast notification renderer
│   │   └── BodyPortal.tsx          # Portal utility for modals
│   ├── context/
│   │   ├── AuthContext.tsx         # Auth state (token, user, login, logout)
│   │   └── ToastContext.tsx        # Toast notifications context
│   ├── hooks/
│   │   ├── useToast.ts             # Toast management hook
│   │   └── useNotifications.ts     # Real-time notifications (WebSocket + polling)
│   ├── routes/
│   │   └── RequireAuth.tsx         # Auth guard for protected routes
│   ├── shell/
│   │   └── AppShell.tsx            # Main layout (sidebar + topbar)
│   ├── types/
│   │   └── index.ts                # All TypeScript interfaces
│   ├── views/                      # Page components (see Pages section)
│   ├── App.tsx                     # Router + providers setup
│   ├── main.tsx                    # Entry point
│   └── index.css                   # Global styles
├── vite.config.ts
├── tsconfig.json
└── index.html
```

---

## Pages & Routes

### Public Routes
| Route | Page | Description |
|-------|------|-------------|
| `/login` | LoginPage | Username + password authentication |
| `/signup` | SignupPage | New user registration |

### Protected Routes (require login)
| Route | Page | Description |
|-------|------|-------------|
| `/app` | HomePage | Dashboard: balance summary, recent expenses, activity feed |
| `/app/groups` | GroupsPage | Create/manage groups, view member balances |
| `/app/groups/:id/expenses` | GroupExpensesPage | Expenses within a specific group |
| `/app/expenses` | ExpensesPage | All expenses with filters (category, group, date) |
| `/app/friends` | FriendsPage | Friend connections, requests, balances |
| `/app/global-settle` | GlobalSettlePage | Settle debts across all groups |
| `/app/finance` | FinancePage | Wallets, transactions, donut chart |
| `/app/income` | IncomePage | Income records by type and wallet |
| `/app/debts-loans` | DebtsLoansPage | Track personal debts and loans |
| `/app/econome` | EconomePage | 6-jar budget allocation system |
| `/app/dashboard` | DashboardPage | Financial reports |
| `/app/insights` | InsightsPage | Expense analysis + CSV export |
| `/app/account` | AccountPage | Profile, password, preferences |
| `/join/:groupId` | JoinGroupPage | Join a group via invite link |

---

## Key Features

### Expense Splitting
Three split modes available when adding an expense:
- **Equal** — splits evenly among all selected members
- **Percentage** — each member gets a custom % (must total 100)
- **Share** — each member gets a custom fixed amount

### Groups
- Create groups with type (Home, Trip, Couple, Work, Personal)
- Multi-currency support per group
- Invite members by username
- View per-member balance breakdown
- Settle up within a group

### Friends & Settlements
- Send/accept/reject friend requests
- View balance owed to/from each friend
- Global settle: resolves debts across multiple groups at once
- Settlement status tracking (pending → accepted/rejected)

### Wallets & Finance
- Multiple wallets (cash, bank, card, savings)
- Transaction history per wallet
- Balance visualization with donut chart

### Income Tracking
- Log income with categories (salary, freelance, rental, etc.)
- Link income to a specific wallet
- Historical income timeline

### Debts & Loans
- Track money you owe (debts) and money others owe you (loans)
- Mark as repaid with date tracking

### Econome (6-Jar System)
Budget allocation based on T. Harv Eker's method:
| Jar | Default % | Purpose |
|-----|-----------|---------|
| 🏠 Necessities | 55% | Rent, food, bills |
| 💰 Financial Freedom | 10% | Investments |
| 🎯 Long-term Savings | 10% | Big purchases |
| 📚 Education | 10% | Courses, books |
| 🎉 Play | 10% | Entertainment |
| 🎁 Give | 5% | Charity, gifts |

### Real-time Notifications
- WebSocket connection for instant alerts
- Fallback polling every 5 minutes
- Auto-reconnect (up to 5 attempts)
- Mark all as read

---

## Authentication

JWT-based authentication stored in `localStorage`.

- On login: token saved, added to every request via Axios interceptor
- On 401 response: token cleared, redirected to `/login`
- On page load: token validated against `/auth/me`

---

## API Configuration

| Environment | How it works |
|-------------|-------------|
| Development | Vite proxies `/api/*` → `http://127.0.0.1:8800` |
| Production | Set `VITE_API_URL=https://your-api.example.com` |

---

## State Management

| Concern | Solution |
|---------|---------|
| Auth (user, token) | React Context (`AuthContext`) |
| Toast notifications | React Context (`ToastContext`) |
| Server data | Local component state + Axios |
| Real-time events | WebSocket in `useNotifications` hook |
