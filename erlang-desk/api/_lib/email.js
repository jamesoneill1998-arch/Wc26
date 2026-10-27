// Transactional email via Resend's HTTP API.

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export async function sendSignInEmail(cfg, to, link) {
  if (!cfg.resendKey || !cfg.emailFrom) {
    if (cfg.production) {
      const e = new Error('Email is not configured')
      e.name = 'ConfigError'
      throw e
    }
    console.log(`[dev] sign-in link for ${to}: ${link}`) // local development only
    return
  }
  const html = `<div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:24px;color:#15171a">
<p style="font-size:20px;margin:0 0 16px">Sign in to Erlang Desk</p>
<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5">Use the button below within 15 minutes, in the same browser you requested it from.</p>
<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#1f4d3a;color:#f6f3ea;padding:12px 20px;text-decoration:none;font-family:Arial,sans-serif;font-size:15px">Sign in</a></p>
<p style="font-family:Arial,sans-serif;font-size:13px;color:#4a4d52">If you didn't ask for this, you can ignore this email. Nobody can sign in without access to your inbox.</p></div>`
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: cfg.emailFrom,
      to: [to],
      subject: 'Your Erlang Desk sign-in link',
      html,
      text: `Sign in to Erlang Desk (valid for 15 minutes, same browser only):\n${link}\n\nIf you didn't ask for this, ignore this email.`,
    }),
  })
  if (!r.ok) throw new Error(`Email provider returned ${r.status}`)
}
