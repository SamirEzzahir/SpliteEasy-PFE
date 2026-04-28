# Frontend Guide

This guide maps the static frontend pages to their scripts and backend dependencies.

## Frontend Style

SplitEasy uses a multi-page app approach:

- plain HTML files in [`frontend/`](../frontend)
- CSS files in [`frontend/css/`](../frontend/css)
- global JavaScript in [`frontend/js/`](../frontend/js)
- a separate admin frontend in [`frontend/admin/`](../frontend/admin)

There is no framework, build pipeline, or import graph. Each page loads the scripts it needs directly with `<script>` tags.

## Shared Frontend Runtime

### `frontend/js/config.js`

Responsibilities:

- sets the global `API_URL`
- loads auth state from `localStorage`
- exposes `getHeaders()`
- exposes `checkLogin()`
- exposes `fetchCurrentUser()`
- exposes `fetchWithAuth()`

This file is the backbone of the web client.

### `frontend/js/navbar.js`

Responsibilities:

- renders the desktop navbar dynamically
- renders the mobile bottom nav dynamically
- wires notification badge UI into the nav
- shows account shortcuts into finance and settings screens

### `frontend/js/notifications.js`

Responsibilities:

- loads notification history from `/Notifications`
- opens WebSocket `/Notifications/ws/{user_id}`
- shows toasts
- marks notifications as read
- dispatches `newChatMessage` events for group chat payloads

### `frontend/js/auth.js`

Responsibilities:

- login
- registration
- redirects after auth actions

## Page Map

### Public entry pages

#### `frontend/index.html`

Purpose:

- landing page / marketing page

Notes:

- mostly static Bootstrap content
- links users into `login.html` and `signup.html`

#### `frontend/login.html`

Primary scripts:

- `js/config.js`
- `js/auth.js`

Purpose:

- log users into the app

#### `frontend/signup.html`

Primary scripts:

- `js/config.js`
- `js/auth.js`

Purpose:

- register a new user

### Main app pages

#### `frontend/home.html`

Primary scripts:

- `js/config.js`
- `js/notifications.js`
- `js/navbar.js`
- `js/group.js`
- `js/home.js`

Purpose:

- home dashboard
- quick group creation
- quick expense creation
- recent activity preview

Backend dependencies:

- `/activity`
- group creation and related membership helpers

#### `frontend/groups.html`

Primary scripts:

- `js/config.js`
- `js/notifications.js`
- `js/navbar.js`
- `js/group.js`

Purpose:

- list groups
- search/filter groups
- create/edit/delete groups
- manage friends while creating groups

Backend dependencies:

- `/groups`
- `/friends/my`
- `/wallets`
- `/groups/{group_id}/members`

#### `frontend/expenses.html`

Primary scripts:

- `js/config.js`
- `js/notifications.js`
- `js/navbar.js`
- `js/group.js`
- `js/expenses.js`
- `js/chat.js`
- `js/auth.js`

Purpose:

- the main group workspace
- group details and editing
- member management
- infinite-scroll expense list
- add/edit/delete expense
- settlement actions for that group
- Excel import/export
- chat offcanvas

Backend dependencies:

- `/groups/{id}`
- `/groups/{id}/members`
- `/groups/{id}/messages`
- `/expenses`
- `/expenses/{group_id}`
- `/settle/{group_id}/...`

This is one of the heaviest pages in the app.

#### `frontend/balances.html`

Primary scripts:

- `js/config.js`
- `js/balance.js`
- `js/navbar.js`
- `js/auth.js`

Purpose:

- group balance breakdown
- suggested settlements
- settlement history
- settlement-mode selector for separate / auto-adjust / hybrid behavior

Backend dependencies:

- `/settle/{group_id}/balances`
- `/settle/{group_id}/settlements`
- `/settle/{group_id}/history`
- `/users/user/me/global-settlement-mode`

#### `frontend/global-settle.html`

Primary scripts:

- `js/config.js`
- `js/navbar.js`
- `js/auth.js`
- `js/global-balance.js`

Purpose:

- balances across all friends and groups
- suggested global settlements
- pending/history actions for global settlement approval

Backend dependencies:

- `/settle/global/balances`
- `/settle/global/settlements`
- `/settle/global/history`
- `/settle/global/pending`

#### `frontend/friends.html`

Primary scripts:

- `js/config.js`
- `js/notifications.js`
- `js/navbar.js`
- `js/auth.js`
- `js/friends.js`

Purpose:

- search users
- send/accept/reject friend requests
- manage current friendships

Backend dependencies:

- `/friends/search`
- `/friends/my`
- `/friends/requests/sent`
- `/friends/requests/received`
- request accept/reject/remove endpoints

#### `frontend/dashboard.html`

Primary scripts:

- `js/config.js`
- `js/dashboard.js`
- `js/navbar.js`

Purpose:

- personal dashboard
- summary cards
- recent expenses
- searchable and filterable all-expense table

Backend dependencies:

- `/dashboard/summary`
- `/expenses/all`
- `/friends/my`

#### `frontend/overview.html`

Primary scripts:

- `js/config.js`
- `js/notifications.js`
- `js/navbar.js`
- `js/overview.js`

Purpose:

- cross-user and cross-group overview charts
- time range filtering

Backend dependencies:

- `/users`
- `/groups`
- `/stats/groups`

#### `frontend/stats.html`

Primary scripts:

- `js/config.js`
- `js/stats.js`
- `js/navbar.js`

Purpose:

- user analytics charts

Backend dependencies:

- stats endpoints under `/stats/user/...`

#### `frontend/account.html`

Primary scripts:

- `js/config.js`
- `js/notifications.js`
- `js/navbar.js`
- `js/account.js`

Purpose:

- account profile screen
- password change
- recent and full activity views

Backend dependencies:

- `/users/user/me`
- `/users/user/me/change-password`
- `/activity`

### Personal finance pages

#### `frontend/income.html`

Primary scripts:

- `js/config.js`
- `js/auth.js`
- `js/income.js`
- `js/navbar.js`

Purpose:

- income entries
- wallet management
- income-type management
- transfer history

Backend dependencies:

- `/incomes`
- `/incometype`
- `/wallets`
- `/transactions`

#### `frontend/finance.html`

Primary scripts:

- `js/config.js`
- `js/notifications.js`
- `js/navbar.js`
- `js/finance.js`

Purpose:

- combined finance dashboard
- income, wallets, transfers, debts, and loans on one page

Backend dependencies:

- `/incomes`
- `/incometype`
- `/wallets`
- `/transactions`
- `/debts-loans`

#### `frontend/debts-loans.html`

Primary scripts:

- `js/config.js`
- `js/notifications.js`
- `js/navbar.js`
- `js/debts-loans.js`

Purpose:

- focused debt/loan workflow separate from the broader finance dashboard

Backend dependencies:

- `/debts-loans/...`

#### `frontend/econome.html`

Primary scripts:

- `js/config.js`
- `js/navbar.js`
- `js/econome.js`

Purpose:

- money-jar budgeting
- strategy management
- income distribution
- jar spending and transfers
- unified ledger
- monthly summary charts

Backend dependencies:

- `/econome/config`
- `/econome/strategies`
- `/econome/balances`
- `/econome/monthly-summary`
- `/econome/ledger`
- `/econome/income-sources`
- `/econome/jar/{jar_type}`
- `/econome/transactions/...`
- `/econome/distribute`
- `/econome/spend`
- `/econome/transfer`

### Admin frontend

#### `frontend/admin/index.html`

Primary scripts:

- `admin/js/auth.js`
- `admin/js/script.js`

Purpose:

- admin dashboard
- user management
- role management
- reclamation workflow

Backend dependencies:

- `/auth/me`
- `/admin/users`
- `/admin/roles`
- `/admin/reclamations`

## Shared UX Patterns

Common implementation patterns across the frontend:

- auth token is read from `localStorage`
- fetch calls mostly use `getHeaders()` from `config.js`
- Bootstrap modals/offcanvas components drive major workflows
- notifications and badges are global
- many pages use direct DOM rendering rather than templating helpers
- Chart.js is used for analytics screens

## Frontend Architecture Notes

### Group chat design

Chat is intentionally lightweight:

- `chat.js` loads history from group message endpoints
- new messages arrive through the notification WebSocket
- `notifications.js` dispatches a browser event
- `chat.js` updates the open group view

### Large page scripts

The heaviest client files today are:

- [`frontend/js/group.js`](../frontend/js/group.js)
- [`frontend/js/expenses.js`](../frontend/js/expenses.js)
- [`frontend/js/dashboard.js`](../frontend/js/dashboard.js)
- [`frontend/js/econome.js`](../frontend/js/econome.js)

These scripts contain both data fetching and most DOM/render logic.

## Frontend Caveats

- `API_URL` is hardcoded in `config.js`.
- Auth state is spread across multiple `localStorage` keys, including `user` and `currentUser`.
- Some pages contain duplicate helper/function names because scripts grew over time.
- The sent-request cancel action in `friends.js` calls `/friends/request/{id}/cancel`, but that route is not present in the current backend router.
- Many scripts assume global functions exist because of script load order rather than explicit imports.

## Best Reading Order For Frontend Work

1. [`frontend/js/config.js`](../frontend/js/config.js)
2. [`frontend/js/navbar.js`](../frontend/js/navbar.js)
3. [`frontend/js/notifications.js`](../frontend/js/notifications.js)
4. [`frontend/js/group.js`](../frontend/js/group.js)
5. [`frontend/js/expenses.js`](../frontend/js/expenses.js)
6. [`frontend/js/balance.js`](../frontend/js/balance.js)
7. [`frontend/js/global-balance.js`](../frontend/js/global-balance.js)
8. [`frontend/js/finance.js`](../frontend/js/finance.js)
9. [`frontend/js/econome.js`](../frontend/js/econome.js)
