// shared-data.jsx — people, groups, expenses, categories for SplitEasy

// ── PEOPLE ──────────────────────────────────────────────────────────────────
const PEOPLE = [
  { id: "samir", name: "Samir Ali", you: true, color: "#f59e0b", color2: "#ec4899" },
  { id: "ahmed", name: "Ahmed Khaled", email: "ahmed.khaled@example.com", color: "#0ea5e9", color2: "#2563eb" },
  { id: "youssef", name: "Youssef Mohamed", email: "youssef.m@example.com", color: "#5b4ef0", color2: "#7c3aed" },
  { id: "sara", name: "Sara Ali", email: "sara.ali@example.com", color: "#ec4899", color2: "#f43f5e" },
  { id: "omar", name: "Omar Hassan", email: "omar.hassan@example.com", color: "#10b981", color2: "#14b8a6" },
  { id: "lina", name: "Lina Ben", email: "lina.ben@example.com", color: "#f97316", color2: "#f59e0b" },
  { id: "mehdi", name: "Mehdi Karim", email: "mehdi.karim@example.com", color: "#8b5cf6", color2: "#a855f7" },
  { id: "hicham", name: "Hicham Belkadi", email: "hicham.b@example.com", color: "#06b6d4", color2: "#0ea5e9" },
  { id: "nadia", name: "Nadia Tahiri", email: "nadia.t@example.com", color: "#d946ef", color2: "#a855f7" },
  { id: "amine", name: "Amine Riad", email: "amine.r@example.com", color: "#84cc16", color2: "#10b981" },
  { id: "imane", name: "Imane El Amrani", email: "imane.e@example.com", color: "#f43f5e", color2: "#be123c" },
  { id: "karim", name: "Karim Ait Ahmed", email: "karim.a@example.com", color: "#22c55e", color2: "#0ea5e9" },
];

const personById = (id) => PEOPLE.find((p) => p.id === id);

// ── CATEGORIES ──────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "food",    name: "Food & Drinks",  icon: "fork",     color: "#5b4ef0", soft: "#eeecff", pillBg: "#fef3c7", pillFg: "#92400e" },
  { id: "transport", name: "Transport",     icon: "car",      color: "#0ea5e9", soft: "#e0f2fe", pillBg: "#dbeafe", pillFg: "#1e40af" },
  { id: "shopping", name: "Shopping",       icon: "bag",      color: "#10b981", soft: "#dcfce7", pillBg: "#dcfce7", pillFg: "#065f46" },
  { id: "entertainment", name: "Entertainment", icon: "controller", color: "#f97316", soft: "#fff1e6", pillBg: "#ffedd5", pillFg: "#9a3412" },
  { id: "bills",    name: "Bills",          icon: "bill",     color: "#ec4899", soft: "#fce7f3", pillBg: "#fce7f3", pillFg: "#9d174d" },
  { id: "accom",    name: "Accommodation",  icon: "bed",      color: "#8b5cf6", soft: "#ede9fe", pillBg: "#ede9fe", pillFg: "#5b21b6" },
  { id: "other",    name: "Others",         icon: "more",     color: "#64748b", soft: "#f1f5f9", pillBg: "#f1f5f9", pillFg: "#334155" },
];
const categoryById = (id) => CATEGORIES.find((c) => c.id === id);

// ── GROUPS ──────────────────────────────────────────────────────────────────
// Each group: id, name, type, memberIds, color, icon, heroSeed (for gradient), total spent, balance (you owe positive => they owe you, negative => you owe), updatedAgo
const GROUPS = [
  { id: "istanbul", name: "Trip to Istanbul", type: "trip", icon: "briefcase",
    color: "#5b4ef0", soft: "#eeecff", heroA: "#7c3aed", heroB: "#f59e0b",
    memberIds: ["samir","ahmed","youssef","sara","omar","lina"], total: 238.00, balance: -120.40, updated: "2h ago" },
  { id: "family", name: "Family", type: "home", icon: "home",
    color: "#10b981", soft: "#dcfce7", heroA: "#10b981", heroB: "#fbbf24",
    memberIds: ["samir","sara","omar","lina","mehdi"], total: 156.80, balance: 45.60, updated: "5h ago" },
  { id: "friends", name: "Friends", type: "social", icon: "groups",
    color: "#f97316", soft: "#fff1e6", heroA: "#f97316", heroB: "#ec4899",
    memberIds: ["samir","ahmed","youssef","sara","omar","lina","mehdi","amine"], total: 120.50, balance: 32.10, updated: "1d ago" },
  { id: "work", name: "Work Team", type: "work", icon: "briefcase",
    color: "#0ea5e9", soft: "#e0f2fe", heroA: "#0ea5e9", heroB: "#5b4ef0",
    memberIds: ["samir","ahmed","youssef","sara","karim","hicham"], total: 65.10, balance: -65.10, updated: "1d ago" },
  { id: "college", name: "College Buddies", type: "social", icon: "graduation",
    color: "#ec4899", soft: "#fce7f3", heroA: "#ec4899", heroB: "#f97316",
    memberIds: ["samir","ahmed","youssef","sara","omar","lina","mehdi","amine"], total: 62.00, balance: 18.00, updated: "2d ago" },
  { id: "weekend", name: "Weekend Crew", type: "social", icon: "controller",
    color: "#8b5cf6", soft: "#ede9fe", heroA: "#8b5cf6", heroB: "#06b6d4",
    memberIds: ["samir","amine","karim","hicham"], total: 42.30, balance: -12.30, updated: "3d ago" },
  { id: "groceries", name: "Groceries", type: "home", icon: "shopping-cart",
    color: "#10b981", soft: "#dcfce7", heroA: "#22c55e", heroB: "#84cc16",
    memberIds: ["samir","sara","lina","mehdi"], total: 89.20, balance: 10.80, updated: "3d ago" },
  { id: "basketball", name: "Basketball Team", type: "social", icon: "ball",
    color: "#f97316", soft: "#fff1e6", heroA: "#f97316", heroB: "#f59e0b",
    memberIds: ["samir","ahmed","youssef","omar","karim","amine","hicham"], total: 34.70, balance: 5.20, updated: "4d ago" },
  { id: "gifts", name: "Gifts & Occasions", type: "social", icon: "gift",
    color: "#ec4899", soft: "#fce7f3", heroA: "#ec4899", heroB: "#f43f5e",
    memberIds: ["samir","sara","lina","nadia","imane"], total: 18.90, balance: -8.90, updated: "4d ago" },
];
const groupById = (id) => GROUPS.find((g) => g.id === id);

const GROUP_TYPES = [
  { id: "trip", label: "Trip", icon: "briefcase" },
  { id: "home", label: "Home", icon: "home" },
  { id: "social", label: "Social", icon: "groups" },
  { id: "work", label: "Work", icon: "office" },
];

// ── EXPENSES (full-app — separate from Jars transactions) ───────────────────
const EXPENSES = [
  { id: "e1", title: "Dinner at Bella Italia", subtitle: "Italian restaurant",
    groupId: "friends", paidBy: "samir", categoryId: "food", amount: 45.60,
    date: "May 16, 2026", time: "8:30 PM", splitIds: ["samir","ahmed","youssef","sara","omar"] },
  { id: "e2", title: "Uber to Airport", subtitle: "Travel to airport",
    groupId: "istanbul", paidBy: "youssef", categoryId: "transport", amount: 28.00,
    date: "May 15, 2026", time: "2:15 PM", splitIds: ["samir","ahmed","youssef","sara"] },
  { id: "e3", title: "Grocery Shopping", subtitle: "Carrefour market",
    groupId: "family", paidBy: "sara", categoryId: "shopping", amount: 76.80,
    date: "May 14, 2026", time: "6:45 PM", splitIds: ["samir","sara","omar","lina"] },
  { id: "e4", title: "Bowling Night", subtitle: "Fun evening",
    groupId: "college", paidBy: "ahmed", categoryId: "entertainment", amount: 38.50,
    date: "May 13, 2026", time: "9:20 PM", splitIds: ["samir","ahmed","youssef","amine"] },
  { id: "e5", title: "Coffee & Snacks", subtitle: "Starbucks",
    groupId: "work", paidBy: "samir", categoryId: "food", amount: 12.40,
    date: "May 12, 2026", time: "10:10 AM", splitIds: ["samir","ahmed","youssef"] },
  { id: "e6", title: "Hotel Booking", subtitle: "3 nights stay",
    groupId: "istanbul", paidBy: "samir", categoryId: "accom", amount: 210.00,
    date: "May 10, 2026", time: "11:00 AM", splitIds: ["samir","ahmed","youssef","sara"] },
  { id: "e7", title: "Museum Tickets", subtitle: "Cultural visit",
    groupId: "istanbul", paidBy: "ahmed", categoryId: "entertainment", amount: 45.00,
    date: "May 9, 2026", time: "1:30 PM", splitIds: ["samir","ahmed","youssef","sara"] },
];

// ── FRIENDS ─────────────────────────────────────────────────────────────────
// status: friend | received | sent
// balance: positive = friend owes you, negative = you owe friend
const FRIENDS_INIT = [
  { personId: "ahmed",   status: "friend", balance:  120.50, mutuals: 12, activity: "added expense" },
  { personId: "youssef", status: "friend", balance:  -85.00, mutuals:  8 },
  { personId: "sara",    status: "friend", balance:   45.20, mutuals: 15 },
  { personId: "omar",    status: "friend", balance:  -30.10, mutuals:  7 },
  { personId: "lina",    status: "friend", balance:   60.00, mutuals:  6 },
  { personId: "mehdi",   status: "friend", balance:    0.00, mutuals:  5 },
  // received requests
  { personId: "amine",   status: "received", balance: 0, mutuals: 7, requestAt: "2d ago" },
  { personId: "imane",   status: "received", balance: 0, mutuals: 6, requestAt: "3d ago" },
  // sent
  { personId: "karim",   status: "sent",     balance: 0, mutuals: 5, requestAt: "1d ago" },
];

const SUGGESTIONS = [
  { personId: "hicham", mutuals: 10 },
  { personId: "nadia",  mutuals: 9 },
  { personId: "amine",  mutuals: 7 },
  { personId: "imane",  mutuals: 6 },
  { personId: "karim",  mutuals: 5 },
];

const FRIEND_ACTIVITY = [
  { who: "ahmed",   action: "added an expense", detail: "Dinner at Bella Italia", when: "2h ago", icon: "expense", color: "#5b4ef0", soft: "#eeecff" },
  { who: "sara",    action: "settled up with you", detail: "Trip to Istanbul",   when: "5h ago", icon: "settle",  color: "#10b981", soft: "#dcfce7" },
  { who: "youssef", action: "joined",            detail: "College Buddies",      when: "1d ago", icon: "groups",  color: "#f59e0b", soft: "#fef3c7" },
  { who: "omar",    action: "paid you",          detail: "Grocery Shopping",     when: "2d ago", icon: "wallet",  color: "#ec4899", soft: "#fce7f3" },
];

const SETTLEMENTS = [
  { from: "samir", to: "ahmed",   amount: 38.50, label: "Bowling Night",   status: "settled" },
  { from: "youssef", to: "samir", amount: 14.00, label: "Uber to Airport", status: "settled" },
  { from: "sara", to: "samir",    amount: 25.60, label: "Grocery Shopping", status: "settled" },
];

Object.assign(window, {
  PEOPLE, personById, CATEGORIES, categoryById,
  GROUPS, groupById, GROUP_TYPES, EXPENSES,
  FRIENDS_INIT, SUGGESTIONS, FRIEND_ACTIVITY, SETTLEMENTS,
});
