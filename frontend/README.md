# SplitEasy — Frontend

Multi-page vanilla HTML / CSS / JavaScript frontend for SplitEasy.  
No build step, no framework — open in a browser or serve with any static server.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Markup | HTML5 |
| Styling | CSS3 + Bootstrap 5.3.3 |
| Icons | Bootstrap Icons |
| Scripting | Vanilla JavaScript (ES6+) |
| Auth storage | `localStorage` |
| HTTP | `fetch` API with retry logic |
| Server (prod) | Nginx (Docker) |

---

## Project Structure

```
frontend/
├── index.html            # Public landing page
├── login.html            # Login form
├── signup.html           # Registration form
├── home.html             # Authenticated home / quick dashboard
├── groups.html           # Group list and management
├── expenses.html         # Expenses detail for one group
├── friends.html          # Friends — requests, search, management
├── account.html          # User profile and settings
├── balances.html         # Per-group balance view
├── global-settle.html    # Cross-group / global settlements
├── debts-loans.html      # Personal debts and loans tracker
├── finance.html          # Wallets and income management
├── income.html           # Income entries
├── econome.html          # Économé money-jar budgeting
├── dashboard.html        # Analytics dashboard
├── stats.html            # Spending statistics
├── overview.html         # Financial overview
│
├── js/
│   ├── config.js         # API base URL, auth helpers, fetchWithAuth
│   ├── auth.js           # Login and registration functions
│   ├── navbar.js         # Dynamic desktop + mobile navigation
│   ├── notifications.js  # Notification dropdown and WebSocket
│   ├── home.js           # Home page stats and activity feed
│   ├── group.js          # Groups CRUD, expense form, member management
│   ├── expenses.js       # Expense list and detail for a group
│   ├── friends.js        # Friends list, requests, search
│   ├── account.js        # Profile edit, password change, activity
│   ├── balance.js        # Group balance display
│   ├── global-balance.js # Global settlement calculations
│   ├── chat.js           # Group chat (WebSocket)
│   ├── finance.js        # Wallet CRUD and transfers
│   ├── income.js         # Income entries
│   ├── debts-loans.js    # Debts and loans management
│   ├── econome.js        # Jar strategies, distribution, ledger
│   ├── dashboard.js      # Dashboard analytics
│   ├── stats.js          # Statistics charts
│   └── overview.js       # Financial overview
│
├── css/
│   ├── style.css         # Global base styles, cards, avatars, layout
│   ├── auth.css          # Login and signup pages
│   ├── home.css          # Home page
│   ├── groups.css        # Groups page
│   ├── expenses.css      # Expenses page
│   ├── friends.css       # Friends page
│   ├── account.css       # Account page
│   ├── debts-loans.css   # Debts & loans page
│   ├── econome.css       # Économé page
│   └── overview.css      # Overview page
│
├── admin/
│   ├── index.html        # Admin dashboard
│   ├── js/
│   │   ├── auth.js       # Admin role check on entry
│   │   └── script.js     # Users, roles, reclamations management
│   └── css/
│       └── style.css     # Admin panel styles
│
├── Dockerfile
└── .gitignore
```

---

## Pages

### Public (no login required)
| Page | File | Description |
|---|---|---|
| Landing | `index.html` | Hero, features, pricing, CTA — redirects to `home.html` if already logged in |
| Login | `login.html` | Username + password form, password visibility toggle |
| Signup | `signup.html` | Username, email, password — validates min length and terms checkbox |

### Authenticated App
| Page | File | Description |
|---|---|---|
| Home | `home.html` | Welcome banner, stats (groups, friends, expenses, unsettled), quick actions, recent activity feed |
| Groups | `groups.html` | Create / edit / delete groups, search and filter, add expenses |
| Expenses | `expenses.html` | Full expense list for one group — add, edit, delete, manage members, group chat, view balances |
| Friends | `friends.html` | Tabs — My Friends / Received Requests / Sent Requests, search users by username or email |
| Account | `account.html` | Edit profile, change password, view activity log, delete account |
| Balances | `balances.html` | Net balance per member in a group, suggested settlements |
| Global Settle | `global-settle.html` | Cross-group balances with friends, global settlement history |
| Finance | `finance.html` | Wallet CRUD, transfers between wallets, income list |
| Income | `income.html` | Add and manage income entries tied to wallets |
| Debts & Loans | `debts-loans.html` | Track money you owe (debts) and money owed to you (loans), record repayments |
| Économé | `econome.html` | 6-jar budgeting — strategies, distribute income, spend from jars, ledger, monthly summary |
| Dashboard | `dashboard.html` | Totals — income, expenses, net balance, recent expenses |
| Stats | `stats.html` | Spending by category, by group, by day |
| Overview | `overview.html` | High-level personal finance overview |

### Admin Panel
| Page | File | Description |
|---|---|---|
| Admin Dashboard | `admin/index.html` | User management, role management, support tickets (reclamations) |

---

## Core JavaScript Files

### `js/config.js` — Foundation

Every page loads this first. It manages:

**API base URL:**
```javascript
const BASE_URL = "http://192.168.70.1:8800";  // ← change this to your backend URL
```

**Auth state (in memory + localStorage):**
```javascript
let token = null;
let currentUser = null;

loadAuth()          // loads token + user from localStorage on page load
setToken(t)         // sets or clears the JWT token
setUser(u)          // sets or clears the current user object
checkLogin()        // redirects to login.html if not authenticated
```

**`fetchWithAuth(url, options)`** — all API calls go through this:
- Attaches `Authorization: Bearer <token>` header
- Retries up to 3 times with exponential backoff on failure
- 10-second timeout with `AbortController`
- Parses JSON error responses and surfaces the `detail` field
- Redirects to `login.html` on 401

**`getHeaders(json = true)`** — returns headers object with auth token and optional `Content-Type: application/json`.

---

### `js/auth.js` — Authentication

| Function | What it does |
|---|---|
| `loginUser()` | POST `/auth/login` (URLSearchParams), saves token + user, redirects to `home.html` |
| `registerUser()` | POST `/auth/register` (JSON), redirects to `login.html` on success |

---

### `js/navbar.js` — Navigation

Injected dynamically into every authenticated page. Renders two versions:

**Desktop navbar (top bar):**
- Brand logo
- Nav links — Home, Groups, Friends, Global Settlements
- Analytics dropdown — Dashboard, Stats, Overview
- Notifications bell with unread count badge
- User dropdown — Account, Finance, Debts & Loans, Logout

**Mobile navbar (bottom bar):**
- Icon-only bottom navigation
- Links — Home, Groups, Friends, Account, Économé

Active page is highlighted automatically based on the current URL filename.

---

### `js/notifications.js` — Notifications

- Fetches unread notifications from `GET /Notifications/`
- Renders a dropdown list with type-based icons
- Opens a WebSocket to `ws://.../Notifications/ws/{user_id}` for real-time delivery
- Mark as read on click, mark all as read button

---

## Features In Detail

### Authentication Flow
```
1. User submits login form
2. POST /auth/login → receives JWT token
3. Token saved to localStorage
4. GET /users/user/me → fetches user object, saved to localStorage
5. Redirect to home.html
6. Every subsequent request sends Authorization: Bearer <token>
7. On 401 → clear token + redirect to login.html
```

### Expense Splitting
Three split modes available when adding an expense:

| Mode | How it works |
|---|---|
| Equal | Total divided equally among selected members |
| Percentage | Each member gets a custom percentage (must sum to 100 %) |
| Custom | Each member gets a specific fixed amount |

The **Add Expense** form also supports:
- Category selection
- Date and time
- Payer selection (who paid)
- Optional wallet deduction (deducts from the payer's wallet balance)
- Économé jar assignment (NEC, FFA, EDU, LTSS, PLAY, GIVE)
- Photo attachment
- Note

### Group Management
- Create groups with title, type (Home, Couple, Trip, Work, Other), currency, description
- Invite friends as members during creation
- Supported currencies: MAD, USD, EUR, GBP, CAD, AED, SAR, EGP, TND, DZD, and more
- Edit or delete groups (owner only)
- Leave a group (if not the only member)
- Personal/solo group option for private expense tracking

### Friends System
- Search users by username or email
- Send friend requests
- Accept or reject incoming requests
- Cancel sent requests
- Remove existing friends
- Friend counts displayed in home stats

### Settlement Flow (per group)
```
1. View group balances (who owes who)
2. See suggested payments (minimized transactions)
3. Payer records a settlement with optional message + proof photo
4. Recipient reviews and accepts or rejects (with reason)
5. Notification sent on each action
```

### Global Settlements
Same approval flow but across **all shared groups between two friends**. Useful for settling everything at once instead of group by group.

Three display modes (set per user in account settings):
- **Separate** — group balances unchanged, global settlements shown separately
- **Auto-adjust** — group balances reduced by global settlements proportionally
- **Hybrid** — shows both original and adjusted balances

### Économé — 6-Jar Budgeting
Based on T. Harv Eker's money management system:

| Jar | Code | Default % | Purpose |
|---|---|---|---|
| Necessities | NEC | 55 % | Rent, food, bills |
| Financial Freedom | FFA | 10 % | Investments |
| Education | EDU | 10 % | Learning |
| Long-Term Savings | LTSS | 10 % | Future goals |
| Play | PLAY | 10 % | Fun |
| Give | GIVE | 5 % | Charity |

**Workflow:**
1. Create or choose a jar strategy (percentages must sum to 100 %)
2. Distribute income → each jar credited automatically
3. Record expenses from a specific jar
4. Transfer between jars if needed
5. View ledger, monthly summary, and per-jar history

### Wallets & Finance
- Multiple wallets per user (cash, bank, credit card, other)
- Transfer money between wallets (creates a transaction record)
- Income entries credit a wallet
- Expenses can optionally deduct from a wallet
- Debts add money to a wallet (borrowed)
- Loans deduct money from a wallet (lent)
- Full transaction history per wallet

### Debts & Loans
| Type | Meaning |
|---|---|
| Debt | Money **you owe** someone — tracks original amount, remaining, due date |
| Loan | Money **someone owes you** — same tracking |

Both support partial repayments, each linked to a wallet. Status auto-updates:
- `active` → `partially_paid` → `fully_paid`

### Admin Panel
Accessible at `/admin/index.html`. Requires a user with an admin role.

| Section | What you can do |
|---|---|
| Dashboard | See user count and open ticket count |
| Users | View all users, enable/disable accounts, assign roles |
| Roles | Create and edit roles with named permissions |
| Reclamations | View and resolve support tickets submitted by users |

---

## Configuration

### Changing the API URL

Open [js/config.js](js/config.js) and update `BASE_URL`:

```javascript
const BASE_URL = "http://your-backend-host:8000";
```

This is the **only file** that needs to change when deploying to a different environment.

---

## Running Locally

The frontend is fully static — no build, no npm, no compilation.

**Option 1 — VS Code Live Server**
Install the Live Server extension, right-click `index.html` → Open with Live Server.

**Option 2 — Python**
```bash
cd frontend/
python -m http.server 5500
```
Open `http://localhost:5500`

**Option 3 — Node `serve`**
```bash
npx serve frontend/
```

---

## Docker

```bash
# From inside frontend/
docker build -t spliteasy-frontend .
docker run -p 80:80 spliteasy-frontend
```

The image uses `nginx:alpine` and serves all static files on port 80.

---

## Notes

- The frontend is **entirely stateless** — all data lives in the backend. localStorage only holds the JWT token and the current user object.
- All pages except `index.html`, `login.html`, and `signup.html` call `checkLogin()` on load — unauthenticated users are redirected to `login.html`.
- The displayed currency is often `MAD` in the UI even when the group currency is different — this is a known inconsistency.
- Group chat and real-time notifications both use WebSocket connections. These will silently fail if the backend WebSocket server is unavailable.
- The admin panel does a role check on load (`admin/js/auth.js`) but the real enforcement is done server-side by the backend RBAC system.
