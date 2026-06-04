# 🏆 WC26 App — Launch & Update Guide

## What's in this project

```
wc26/
├── index.html          ← App shell & PWA meta tags
├── vite.config.js      ← Build config + PWA plugin
├── package.json        ← Dependencies
├── vercel.json         ← Vercel deployment config
├── public/
│   └── favicon.svg     ← App icon (replace with your own)
└── src/
    ├── main.jsx        ← React entry point
    └── App.jsx         ← ← YOUR ENTIRE APP IS HERE
```

---

## ✅ Step 1 — Install Node.js (one-time)

Download from **https://nodejs.org** → choose "LTS" version.

Verify it works:
```bash
node --version   # should show v20 or higher
npm --version
```

---

## ✅ Step 2 — Run locally

```bash
# Unzip the project folder, then:
cd wc26
npm install        # installs React, Vite, etc (~30 seconds)
npm run dev        # starts local server
```

Open **http://localhost:5173** in your browser. You'll see your app live.

> 💡 Any change you save in `App.jsx` updates the browser instantly — no refresh needed.

---

## ✅ Step 3 — Deploy to Vercel (free, takes 2 minutes)

### Option A: Drag & Drop (no Git needed)

1. Run `npm run build` — creates a `dist/` folder
2. Go to **https://vercel.com** → sign up free
3. Click **"Add New Project"** → **"Browse"**
4. Drag your `dist/` folder onto the page
5. Done! Vercel gives you a live URL like `wc26.vercel.app`

### Option B: GitHub (recommended — enables auto-deploy on save)

```bash
# One-time setup
git init
git add .
git commit -m "launch wc26"

# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/wc26.git
git push -u origin main
```

Then on Vercel:
1. **"Add New Project"** → **"Import Git Repository"**
2. Select your `wc26` repo
3. Click **Deploy**

Every time you push to GitHub, Vercel rebuilds automatically. ✨

---

## ✅ Step 4 — Custom domain (optional, ~$10/year)

1. Buy a domain on **Namecheap** or **Google Domains** (e.g. `wc26app.com`)
2. In Vercel: Project Settings → Domains → Add domain
3. Follow Vercel's DNS instructions (usually just add a CNAME record)
4. HTTPS is automatic and free

---

## 📱 PWA — Make it installable on phones

Your app already has PWA configured. Once deployed:

**On iPhone (Safari):**
1. Open your Vercel URL in Safari
2. Tap the Share button (box with arrow)
3. Tap **"Add to Home Screen"**
4. App icon appears on home screen — works like a native app!

**On Android (Chrome):**
1. Open your URL in Chrome
2. Tap the 3-dot menu
3. Tap **"Add to Home Screen"** or **"Install App"**

> To get proper icons, replace `public/favicon.svg` with a 512×512 PNG and
> add `public/icons/icon-192.png` and `public/icons/icon-512.png`.
> Free tool: **https://realfavicongenerator.net**

---

## 🔄 How to update the app after it's live

This is the beauty of the setup — **updating is as easy as editing one file.**

### If you used GitHub (recommended):

```bash
# 1. Edit src/App.jsx (update scores, add features, fix bugs)
# 2. Save the file
# 3. Push to GitHub:
git add .
git commit -m "update: added knockout stage"
git push
# Vercel detects the push and redeploys automatically in ~30 seconds
```

### If you used drag & drop:

```bash
npm run build          # rebuilds the dist/ folder
# Then drag the new dist/ folder onto Vercel again
```

---

## 🧠 Working with Claude to update the app

You can come back to Claude at any time and say things like:

- *"Add knockout stage bracket to the app"*
- *"Update the Group A standings — Mexico won 2-0"*
- *"Add a dark/light mode toggle"*
- *"Add a World Cup bracket for Round of 32"*
- *"Fix the Kalshi API — the ticker changed to FIFAWC26"*

Claude will give you the updated `App.jsx`. You replace your existing file and push.

---

## 💰 Monetization options (once live)

| Method | How | Earning potential |
|--------|-----|-------------------|
| **Google AdSense** | Add script tag + ad component | $2–10 CPM |
| **Kalshi affiliate** | Use their referral link in the app | % of trades |
| **Premium tier** | Gate AI picks behind a $2.99/mo Stripe paywall | Recurring |
| **Sponsor banner** | Sell a static slot to a sports bar or betting app | $100–500/mo |

### Quick AdSense setup:
1. Sign up at **https://adsense.google.com**
2. Add their script to `index.html`
3. Add `<ins class="adsbygoogle" ...>` component in `App.jsx`
4. Approval takes 1–2 weeks

---

## 🛠 Useful commands

```bash
npm run dev       # local dev server (hot reload)
npm run build     # production build → dist/
npm run preview   # preview the production build locally
```

---

## 📞 Need help?

- **Vercel docs**: https://vercel.com/docs
- **Vite docs**: https://vitejs.dev
- **Kalshi API**: https://docs.kalshi.com
- **Ask Claude**: paste your error message and say "help me fix this"

---

*Built with React + Vite + Kalshi API + Claude AI · FIFA World Cup 2026*
