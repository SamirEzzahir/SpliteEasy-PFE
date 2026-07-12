# Support / Ticketing

A complete two-sided support system: a **user portal** (`/support`) where people raise
and follow tickets, and the **admin queue** (`/admin/support`) where staff manage them.
Both sides share one data model and the existing notification system.

---

## User portal (`/support`)

| Route | What it does |
|---|---|
| `/support` | List my tickets (search + status/category filters), open a **New ticket** modal |
| `/support/[id]` | Ticket conversation (chat-style thread), reply, and **close** my ticket |

Creating a ticket captures a **category** (Bug / Feature Request / Account / Payment /
Other), a **priority** (Low / Medium / High), a subject, and a description.

A user reply on a ticket that was `waiting_user` or `resolved` automatically **reopens**
it (back to `in_progress`).

> **Entry point:** "Support" in the main app sidebar.

---

## Admin queue (`/admin/support`)

| Route | What it does |
|---|---|
| `/admin/support` | Ticket queue — search + status/priority filters, paginated |
| `/admin/support/[id]` | Workspace — reply, change status/priority, **assign** to staff, resolve/close/reopen |

Reads require `view_support`; writes require `manage_support`. Every admin write is
recorded in the [audit log](admin-panel.md).

---

## Status lifecycle

```
open ──▶ in_progress ──▶ waiting_user ──▶ resolved ──▶ closed
  ▲            │               │              │
  └──── user reply reopens ◀───┴──────────────┘
```

| Status | Meaning |
|---|---|
| `open` | New, not yet picked up |
| `in_progress` | Being worked on |
| `waiting_user` | Set automatically when an admin replies — awaiting the user |
| `resolved` | Admin marked it solved |
| `closed` | Closed by the user or admin (terminal) |

---

## Notifications (reuses `send_notification`)

| Event | Recipient |
|---|---|
| User creates a ticket | All support staff (wildcard / `manage_support`) |
| Admin replies / changes status | The ticket's requester |
| User replies | The assignee, or all support staff if unassigned |

---

## Architecture

One model, two portals — no duplicated logic.

```
backend/
├── models/user.py          # Reclamation (extended) + TicketReply
├── schemas/support.py      # Ticket* schemas (+ reuses Paginated[T])
├── repositories/support.py # shared list_tickets(...) + create/reply/status/assign + admin recipients
├── routers/support.py      # user portal  (/support)
└── routers/admin.py        # admin queue  (/admin/tickets)

frontend/
├── lib/api/support.ts          # supportApi (user) + shared Ticket types
├── lib/api/admin.ts            # adminApi.ticket* (admin)
├── components/support/ui.tsx   # shared status/priority/category badges + labels
├── components/support/Thread.tsx  # shared conversation + composer
├── app/support/…               # user portal pages
└── app/admin/support/…         # admin queue pages
```

The ticket table is named `reclamations` (kept for backward compatibility) and is
surfaced as a "ticket" everywhere in the API and UI.

---

## Deferred
File attachments (no upload subsystem yet), SLA timers, canned responses, and a
post-resolution satisfaction (CSAT) rating.
