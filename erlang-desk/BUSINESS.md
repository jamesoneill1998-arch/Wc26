# Erlang Desk: business plan

## The gap

Contact centres with roughly 20 to 300 agents mostly plan in Excel. The big WFM suites (NICE, Verint, Calabrio, Genesys WFM) are priced and scoped for large enterprises: per-agent licensing, implementation projects and long contracts. Free online Erlang calculators answer one interval at a time and stop there. Erlang Desk sits in between: the whole forecast → staffing → hiring workflow, self-serve, at a team price.

**Buyer**: the workforce planner, WFM analyst or operations manager. They often own a budget line or a company card for tools under about $100 a month.

**Wedge**: privacy. Data never leaves the browser, so there is often no vendor security review and no DPA negotiation. That shortens the sales cycle a lot.

## Pricing (set in `src/config.js`)

| Plan | Price | Role |
|---|---|---|
| Calculator | Free | Search traffic and lead capture: Erlang A vs C, rostered for UK and offshore |
| Pro | £59 per planner per month | Core revenue: one planner, every channel and site |
| Team | £199 per month, five planners | Planning teams across several sites |

Both paid plans have a 14-day trial through Stripe. Price per **planner**, not per agent; that's the clearest contrast with the incumbents. Add annual prices (10× monthly) once monthly customers are converting.

At £59, about 170 Pro seats (or a mix with Team) is roughly £10k MRR.

## Getting customers

1. **SEO with free tools.** "Erlang C calculator", "call centre staffing calculator", "how many agents do I need" and "shrinkage calculator" are evergreen searches with real B2B intent. The calculator page is the landing page for them. Next, add standalone pages per question (shrinkage, occupancy, ASA vs service level) that each embed a small calculator.
2. **LinkedIn and communities.** WFM people gather in LinkedIn groups, SWPP (Society of Workforce Planning Professionals), Call Centre Helper forums and r/callcentres. Post useful teardowns ("why your 80/20 target costs 9 extra FTE") with a link to the calculator.
3. **Templates as lead magnets.** A free "capacity plan CSV template" exchanged for an email address.
4. **Direct outreach.** Search LinkedIn for "Workforce Planner" at companies with 50 to 500 employees. Offer a free 20-minute session where you load their CSV and show them their own hiring plan. This converts better than any landing page.
5. **Marketplaces later.** Listings on G2 and Capterra once there are about 10 happy users to leave reviews.

"Passive" income comes once the content ranks and the product sells itself. Plan on 3 to 6 months of active outreach and support to get there.

## Roadmap

### Done
- [x] Accounts (passwordless), Stripe checkout and portal, Team seats, server-checked plans
- [x] Security hardening: CSP, HSTS, CSRF, rate limits, validated imports. See SECURITY.md
- [x] Erlang A (abandonment-aware staffing), shown against Erlang C
- [x] Voice, chat, back office and branch in one workspace
- [x] Sites with itemised shrinkage (UK 35% / offshore 20% defaults), hours and attrition

### Before charging
- [ ] Your own domain, Vercel env vars, Stripe prices and portal, Resend domain, Upstash (see README)
- [ ] Have the privacy notice and terms (public/privacy.html, public/terms.html) reviewed for UK GDPR
- [ ] Register with the ICO as a data controller (a small fee); you hold customer emails
- [ ] Analytics that never touch workspace data (Plausible or Vercel Analytics). Update the CSP `connect-src` if needed

### Next differentiators
- [ ] Events calendar: bank holidays and campaigns as dated forecast overlays
- [ ] Schedule fit: required staff against shift patterns, with the under/over curve
- [ ] Skill splits: one forecast shared across UK and offshore by percentage
- [ ] Budget view: FTE × loaded cost per site, cost per contact, the onshore/offshore mix trade-off
- [ ] Excel export of the capacity plan, formatted for finance
- [ ] Optional encrypted cloud sync for Team

### Later
- [ ] Connectors (Genesys Cloud, Five9, Amazon Connect, Zendesk) to replace CSV upload
- [ ] White-label pricing for BPOs and WFM consultancies

## Running costs

Vercel Pro (about £16/month; Hobby is non-commercial), a domain (about £12/year), Stripe fees (about 1.5% + 20p for UK cards), Resend and Upstash free tiers. All the computation runs in the customer's browser, so hosting costs stay flat as you add customers.
