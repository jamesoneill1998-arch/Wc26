# Erlang Desk: business plan

## The gap

Contact centres with roughly 20 to 300 agents mostly plan in Excel. The big WFM suites (NICE, Verint, Calabrio, Genesys WFM) are priced and scoped for large enterprises: per-agent licensing, implementation projects and long contracts. Free online Erlang calculators answer one interval at a time and stop there. Erlang Desk sits in between: the whole forecast → staffing → hiring workflow, self-serve, at a team price.

**Buyer**: the workforce planner, WFM analyst or operations manager. They often own a budget line or a company card for tools under about $100 a month.

**Wedge**: privacy. Data never leaves the browser, so there is often no vendor security review and no DPA negotiation. That shortens the sales cycle a lot.

## Pricing (set in `src/config.js`)

| Plan | Price | Role |
|---|---|---|
| Calculator | Free | Search traffic and lead capture |
| Pro | $79 per planner per month | Core revenue: one planner, full workflow |
| Team | $249 per month, up to 5 planners | Multi-queue operations |

Annual billing at 10× monthly. Price per **planner**, not per agent; that's the clearest contrast with the incumbents.

At $79, 130 Pro subscribers is about $10k MRR. That is achievable for a niche B2B tool with steady content and outreach.

## Getting customers

1. **SEO with free tools.** "Erlang C calculator", "call centre staffing calculator", "how many agents do I need" and "shrinkage calculator" are evergreen searches with real B2B intent. The calculator page is the landing page for them. Next, add standalone pages per question (shrinkage, occupancy, ASA vs service level) that each embed a small calculator.
2. **LinkedIn and communities.** WFM people gather in LinkedIn groups, SWPP (Society of Workforce Planning Professionals), Call Centre Helper forums and r/callcentres. Post useful teardowns ("why your 80/20 target costs 9 extra FTE") with a link to the calculator.
3. **Templates as lead magnets.** A free "capacity plan CSV template" exchanged for an email address.
4. **Direct outreach.** Search LinkedIn for "Workforce Planner" at companies with 50 to 500 employees. Offer a free 20-minute session where you load their CSV and show them their own hiring plan. This converts better than any landing page.
5. **Marketplaces later.** Listings on G2 and Capterra once there are about 10 happy users to leave reviews.

"Passive" income comes once the content ranks and the product sells itself. Plan on 3 to 6 months of active outreach and support to get there.

## Roadmap to a sellable v1

### Must have before charging
- [ ] **Accounts and billing**: Stripe Checkout plus the customer portal, with sign-in by magic link (Clerk, Supabase Auth or Stripe-only licence keys). Gate the forecast, staffing and capacity pages behind an active subscription and keep the calculator free.
- [ ] **Licence check on the server**: one Vercel serverless function that checks the Stripe subscription status, so the paywall can't be bypassed in the browser.
- [ ] **Your own domain** (e.g. erlangdesk.com), a privacy policy reviewed for your jurisdiction, and terms of service.
- [ ] **Analytics** that never touch workspace data (Plausible or Vercel Analytics).

### Differentiators (next 3 months)
- [ ] **Erlang A** (abandonment-aware staffing): fewer FTE than Erlang C at the same real service level. A strong selling point.
- [ ] **Multiple queues and skills** in one workspace, with a combined plan.
- [ ] **Events calendar**: bank holidays and campaigns as forecast overlays on specific dates.
- [ ] **Schedule fit**: compare required agents with a shift pattern and show the under- and over-staffing curve.
- [ ] **Excel export** of the capacity plan, formatted for finance.
- [ ] **Optional cloud sync** for Team (encrypted workspaces) so planners can share.

### Later
- [ ] Direct connectors (Genesys Cloud, Five9, Talkdesk, Amazon Connect APIs) to replace CSV upload.
- [ ] Budget view: FTE × loaded cost, and cost per contact.
- [ ] White-label or reseller pricing for BPO consultancies.

## Running costs

Vercel Hobby or Pro ($0–20/month), a domain (~$15/year), Stripe fees (~3%) and an email tool. All the computation runs in the customer's browser, so hosting costs stay flat as you add customers.
