// Change this to your backend server address
export const BASE_URL = 'http://192.168.1.3:8800'

export const WS_URL = BASE_URL.replace(/^http/, 'ws')

export const CURRENCIES = ['USD', 'EUR', 'MAD', 'GBP', 'CAD', 'AED', 'SAR', 'EGP'] as const

export const GROUP_TYPES = ['Home', 'Couple', 'Trip', 'Work', 'Personal', 'Other'] as const

export const EXPENSE_CATEGORIES = [
  'Food', 'Transport', 'Shopping', 'Entertainment',
  'Travel', 'Accommodation', 'Utilities', 'Billing', 'Other',
] as const

export const CATEGORY_ICONS: Record<string, string> = {
  Food: '🍽️',
  Transport: '🚗',
  Shopping: '🛒',
  Entertainment: '🎮',
  Travel: '✈️',
  Accommodation: '🏨',
  Utilities: '⚡',
  Billing: '🧾',
  Other: '📦',
}

export const WALLET_CATEGORIES = ['cash', 'bank', 'card', 'savings', 'other'] as const
