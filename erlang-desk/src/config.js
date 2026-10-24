// Commercial settings in one place. Set the VITE_* variables in Vercel
// (Project → Settings → Environment Variables) to switch on checkout.

export const BRAND = {
  name: 'Erlang Desk',
  tagline: 'Forecasting and capacity planning for contact centres',
  contactEmail: import.meta.env.VITE_CONTACT_EMAIL || '',
}

export const CURRENCY = import.meta.env.VITE_CURRENCY_SYMBOL || '$'

export const PLANS = [
  {
    id: 'free',
    name: 'Calculator',
    price: 0,
    period: 'forever',
    blurb: 'The Erlang C calculator, for quick staffing questions.',
    features: ['Erlang C calculator', 'Service level, ASA & occupancy', 'Shrinkage & chat concurrency', 'Staffing what-if table'],
    cta: 'Open calculator',
    href: '#/app/calculator',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 79,
    period: 'per planner / month',
    blurb: 'Full forecasting and capacity planning for one team.',
    features: ['Everything in Calculator', 'Auto-selected forecasts with backtest accuracy', 'Intraday interval requirements', '52-week capacity & hiring plan', 'CSV import & export'],
    cta: 'Start Pro',
    href: import.meta.env.VITE_STRIPE_PRO_URL || '#/app',
    featured: true,
  },
  {
    id: 'team',
    name: 'Team',
    price: 249,
    period: 'per month, up to 5 planners',
    blurb: 'For operations with several queues and sites.',
    features: ['Everything in Pro', 'Up to 5 planners', 'Priority support', 'Onboarding call with your data'],
    cta: 'Talk to us',
    href: import.meta.env.VITE_STRIPE_TEAM_URL || '#/app',
  },
]
