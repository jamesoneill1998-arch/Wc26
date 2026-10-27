// Server configuration, read and validated once per request. Secrets live
// only in Vercel environment variables, never in the client bundle (only
// VITE_* variables are exposed to the browser).

export class ConfigError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ConfigError'
  }
}

function need(name) {
  const v = process.env[name]
  if (!v) throw new ConfigError(`${name} is not set`)
  return v
}

export function getConfig() {
  const sessionSecret = need('SESSION_SECRET')
  if (sessionSecret.length < 32) throw new ConfigError('SESSION_SECRET must be at least 32 characters')
  const appUrl = new URL(need('APP_URL')) // canonical origin; never trust the Host header
  if (appUrl.protocol !== 'https:' && appUrl.hostname !== 'localhost') throw new ConfigError('APP_URL must use https')
  return {
    appUrl: appUrl.origin,
    sessionSecret,
    production: process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production',
    stripeKey: process.env.STRIPE_SECRET_KEY || '',
    prices: {
      pro: process.env.STRIPE_PRICE_PRO || '',
      team: process.env.STRIPE_PRICE_TEAM || '',
    },
    trialDays: Math.max(0, Math.min(30, Number(process.env.TRIAL_DAYS ?? 14) || 0)),
    resendKey: process.env.RESEND_API_KEY || '',
    emailFrom: process.env.EMAIL_FROM || '',
    upstashUrl: process.env.UPSTASH_REDIS_REST_URL || '',
    upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  }
}
