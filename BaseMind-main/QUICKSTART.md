# Quick Start Guide - Vercel Deployment

## 🚀 Deploy to Vercel in 5 Minutes

### Prerequisites
- GitHub account with your repository
-- Supabase project with database configured
-- Vercel account

### Step 1: Prepare Your Vercel Project (1 min)
1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository
4. **Important**: Set Root Directory to `BaseMind-main`
5. Click "Deploy" (skip environment variables for now)

### Step 2: Set Environment Variables in Vercel (2 min)
After deployment, go to your project settings:

1. Click your project on Vercel
2. Go to **Settings → Environment Variables**
3. Add each variable:
   - `VITE_SUPABASE_URL` = Your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = Your Supabase Anon Key
   - `VITE_APP_URL` = Your Vercel deployment URL (e.g., `https://yourapp.vercel.app`)

### Step 3: Configure Supabase Database (1 min)
1. In your Supabase project → SQL Editor
2. Create New Query
3. Paste contents of `supabase/migrations/001_initial_schema.sql`
4. Click Run
5. Repeat for `002_setup_auth.sql` and `003_setup_first_admin.sql`

### Step 4: Redeploy (1 min)
Back in Vercel:
1. Go to **Deployments**
2. Click the three dots on latest deployment
3. Click **Redeploy**

**Your app is now live!**

Login with:
- Email: `admin@scouts.org`
- Password: `admin123`

---

## 🔑 Getting Your API Keys

### Supabase
1. Create project at supabase.com
2. Go to Settings → API
3. Copy Project URL → `VITE_SUPABASE_URL`
4. Copy anon key → `VITE_SUPABASE_ANON_KEY`

### Google Gemini
This project no longer includes an integrated Google Gemini chatbot. No Gemini API key is required.

---

## 📊 Project Overview

| Component | Purpose | Status |
|-----------|---------|--------|
| Frontend | React app with Vite | ✅ Ready |
| Database | Supabase PostgreSQL | ✅ Schema ready |
| Auth | Supabase Auth | ✅ Configured |
| Chatbot | Google Gemini | Removed |
| Hosting | Vercel (ready) | ⏳ Needs deployment |

---

## 📁 Important Files

- `.env.local` - Your credentials (NEVER commit)
- `src/app/context/AuthContext.tsx` - Authentication logic
-- `src/app/components/ChatbotPage.tsx` - AI chatbot UI (removed)
- `supabase/migrations/001_initial_schema.sql` - Database schema
- `SETUP.md` - Full setup guide

---

## 🐛 Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| "Module not found" | `rm -rf node_modules && npm install` |
| "undefined env variables" | Check `.env.local` has all variables |
| "Database connection error" | Verify Supabase URL and key are correct |
| "Chatbot not working" | Chatbot feature removed from this repo |

---

## 📚 Next: Full Guides

- 📖 [Full Setup Guide](./SETUP.md) - Complete setup + deployment
- 📋 [Implementation Summary](./IMPLEMENTATION_SUMMARY.md) - What was changed

---

## ✨ Features to Try

- **Login** - Admin dashboard access
- **Equipment** - View/manage scout equipment
-- **Chatbot** - Not available
- **Locations** - Manage camping sites
- **Documents** - Upload policy documents

---

## 🎯 Next Steps

- [ ] Get API keys from Supabase
- [ ] Complete `.env.local`
- [ ] Run database migrations
- [ ] Test login locally
- [ ] Test other features
- [ ] Deploy to Vercel (see SETUP.md)

---

## 💬 Need Help?

Check these first:
1. `.env.local` has correct values
2. Database migrations were run
3. Supabase URL is reachable
4. Your Gemini API key is valid

Still stuck? See [SETUP.md](./SETUP.md) troubleshooting section.

---

## 🎉 You're Ready!

Your Scout Manager app is configured and ready to use. Run `npm run dev` and start exploring!
