# Stripe integration: remaining setup

Erlang Desk already used hosted Stripe Checkout. The Checkout Studio settings have been applied to the one place a Checkout Session is created: [api/billing/checkout.js](api/billing/checkout.js). Nothing else changed.

## Values to Replace

None of the values in the code are placeholders. Prices come from environment variables, so the only values still to set are in Vercel (see Setup below).

**Files containing placeholders:** none.

| Field | Current Value | What to Set |
|-------|--------------|-------------|
| mode | `subscription` | Already correct: Pro and Team are monthly subscriptions. |
| success_url | `${APP_URL}/#/app/account?checkout=success` | Already real. Set `APP_URL` to `https://erlangdesk.com`. |
| cancel_url | `${APP_URL}/#/app/account?checkout=cancelled` | Already real. |
| line_items[].price | `STRIPE_PRICE_PRO` / `STRIPE_PRICE_TEAM` (environment) | Your two Price IDs (`price_…`) from https://dashboard.stripe.com/prices, set in Vercel. |

## Configured Parameters

These come from Checkout Studio and are set in the code.

**Files containing these parameters:**
- [api/billing/checkout.js](api/billing/checkout.js)

| Parameter | Value |
|-----------|-------|
| ui_mode | `hosted` (see the note below) |
| billing_address_collection | `auto` |
| phone_number_collection | `{ enabled: false }` |
| automatic_tax | `{ enabled: false }` |
| allow_promotion_codes | `false` |
| payment_method_collection | `always` |

### Studio settings not applied, and why

The Stripe client in [api/_lib/stripe.js](api/_lib/stripe.js) pins API version `2024-06-20` and uses no SDK.

- **`ui_mode`:** set to `hosted`, the value for that API version. `hosted_page` is the newer name for the same thing.
- **`submit_type: auto`:** left out. `auto` is Stripe's default, so leaving it out gives the same Checkout page, and older API versions reject `submit_type` in subscription mode.
- **`origin_context: mobile_app` and `integration_identifier: hosted_mobile_app_0001`:** left out. Erlang Desk is a website, not a mobile app, and the pinned API version doesn't accept these fields. Stripe would reject the whole request. If Checkout Studio is set to "mobile app", switch it to "web".

These parameters were kept because the app depends on them:

- **`customer`:** links the subscription to the signed-in email, which is how access is granted.
- **`subscription_data`:** gives the 14-day trial promised on the pricing page (`TRIAL_DAYS`) and records the plan.

## Setup

Add these in Vercel under **erlang-desk → Settings → Environment Variables**. Test them on **Preview** first, then copy them to **Production** with live keys.

| Variable | Value | Secret? |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` (test), later `sk_live_…`. Add it yourself; never paste it in chat. | Yes |
| `STRIPE_PRICE_PRO` | Pro price ID (`price_…`) | No |
| `STRIPE_PRICE_TEAM` | Team price ID (`price_…`) | No |
| `SESSION_SECRET` | 32+ random characters | Yes |
| `APP_URL` | `https://erlangdesk.com` (the preview's own URL when testing) | No |
| `VITE_BILLING` | `on` | No |
| `TRIAL_DAYS` | `14` (the default) | No |
| `RESEND_API_KEY`, `EMAIL_FROM` | From https://resend.com once erlangdesk.com is verified there | Key is secret |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | From https://upstash.com (free tier) | Token is secret |

No dependencies to install: the Stripe client is plain `fetch`. No publishable key is needed, because customers are redirected to Stripe's hosted page.

In the Stripe Dashboard, under **Settings → Billing → Customer portal**, activate the portal. Allow cancellation, payment method updates and invoice history.

## Files involved

No new files apart from this one.

```
api/billing/checkout.js   creates the Checkout Session (Studio settings applied here)
api/billing/portal.js     opens the Stripe customer portal
api/_lib/stripe.js        minimal Stripe REST client, pinned API version
api/_lib/session.js       reads the plan from Stripe every 10 minutes
api/me.js, api/team.js    current plan, Team seats
```

## How it works

1. A visitor chooses Pro or Team. They sign in with an emailed link, so their email is proven.
2. `POST /api/billing/checkout` finds or creates the Stripe customer for that email and creates a subscription Checkout Session with the server-side price. The browser only names the plan.
3. The customer pays, or starts the trial, on Stripe's hosted page. They return to `/#/app/account?checkout=success`.
4. Access is read from the customer's live subscription in Stripe, at sign-in and then at most every 10 minutes. No webhook is needed: cancellations and failed payments take effect at the next check.
5. **Invoices, card and cancellation** opens the Stripe customer portal.

## Testing

Use test mode keys (`sk_test_…`) and these cards, with any future expiry date, any CVC and any postcode:

| Card | Result |
|---|---|
| 4242 4242 4242 4242 | Succeeds |
| 4000 0025 0000 3155 | Asks for 3D Secure authentication |
| 4000 0000 0000 0002 | Declined |

Check the full flow on a Preview deployment:
1. Sign in.
2. Start the Pro trial and pay with 4242.
3. Confirm that Account shows "Pro, in your free trial".
4. Open the portal and cancel.
5. Within 10 minutes, confirm that access ends at the period end.
6. Repeat with Team and add a planner.

## Next steps

- After the test flow passes, create the same two products in **live** mode. Put the live price IDs and `sk_live_…` key on **Production**, and set `VITE_BILLING=on` there.
- To give pilots free months, apply a coupon to their subscription in the Dashboard. Customer-entered promotion codes are off, per Checkout Studio.
- Once you're VAT-registered, turn on Stripe Tax and set `automatic_tax` to enabled.
- Add your own email to `ADMIN_EMAILS` (already done) so you keep full access without a subscription.

## Resources

- https://support.stripe.com
- https://docs.stripe.com/mcp
