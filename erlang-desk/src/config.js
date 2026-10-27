// Commercial settings in one place. VITE_* variables are public (they end
// up in the browser bundle) — never put secrets in them.

export const BRAND = {
  name: 'Erlang Desk',
  contactEmail: import.meta.env.VITE_CONTACT_EMAIL || '',
}

export const CURRENCY = import.meta.env.VITE_CURRENCY_SYMBOL || '£'

export const PLANS = [
  {
    id: 'free',
    name: 'Calculator',
    price: 0,
    per: 'Free, no account',
    blurb: 'Erlang A and C for a single interval. Good for a quick answer.',
    features: ['Erlang A and Erlang C side by side', 'Service level, wait, abandonment, occupancy', 'UK and offshore shrinkage', 'Chat concurrency'],
    cta: 'Open the calculator',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 59,
    per: 'per planner, per month',
    blurb: 'The full planner for one person running one operation.',
    features: ['Voice, chat, back office and branch', 'Backtested forecasts', 'Interval staffing with Erlang A', 'Sites with itemised shrinkage', '52-week capacity and hiring plan', 'Import and export'],
    cta: 'Start 14-day trial',
    featured: true,
  },
  {
    id: 'team',
    name: 'Team',
    price: 199,
    per: 'per month, up to five planners',
    blurb: 'For planning teams covering several sites and services.',
    features: ['Everything in Pro', 'Five named planners', 'Owner manages seats', 'Priority support', 'Onboarding session with your data'],
    cta: 'Start 14-day trial',
  },
]
