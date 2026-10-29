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
  // Table layout and inline styles so it renders the same in Outlook and Gmail.
  const url = escapeHtml(link)
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#eef1f4">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f4;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #dde2e8;border-radius:8px;overflow:hidden">
<tr><td style="background:#0f1720;padding:18px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;letter-spacing:2px;color:#ffffff">ERLANG DESK</td></tr>
<tr><td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;color:#0f1720">
<p style="margin:0 0 10px;font-size:22px;font-weight:bold">Sign in to Erlang Desk</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.55;color:#3d4753">Use the button below within 15 minutes, in the same browser you asked from.</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#0b5d6b;border-radius:6px"><a href="${url}" style="display:inline-block;padding:13px 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none">Sign in</a></td></tr></table>
<p style="margin:24px 0 0;font-size:12.5px;line-height:1.5;color:#6b7683">If the button doesn't work, paste this link into the same browser:<br><a href="${url}" style="color:#0b5d6b;word-break:break-all">${url}</a></p>
</td></tr>
<tr><td style="padding:20px 28px 26px;font-family:Arial,Helvetica,sans-serif;font-size:12.5px;line-height:1.5;color:#6b7683;border-top:1px solid #eef1f4">If you didn't ask for this, ignore this email. Nobody can sign in without access to your inbox.</td></tr>
</table></td></tr></table></body></html>`
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
