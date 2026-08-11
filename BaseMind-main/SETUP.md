# ScoutManager - Vercel Deployment Guide

## ?? Important: Vercel-Only Deployment

This application is configured to run **exclusively on Vercel**. Local development environment is not supported. All work must be done through Vercel deployments.

## Prerequisites

- GitHub account with repository pushed
- [Supabase account](https://supabase.com)
- [Vercel account](https://vercel.com)

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Name it "scoutmanager"
4. Choose a region closest to your location
5. Create a strong password
6. Wait for the project to initialize

## Step 2: Setup Supabase Database

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of supabase/migrations/001_initial_schema.sql
4. Paste into the SQL editor and click **Run**
5. Repeat steps 2-4 for supabase/migrations/002_setup_auth.sql
6. Repeat steps 2-4 for supabase/migrations/003_setup_first_admin.sql

See [SUPABASE_AUTH_SETUP.md](./SUPABASE_AUTH_SETUP.md) for detailed instructions.

## Step 3: Get Supabase Credentials

From your Supabase project dashboard:

1. Go to **Settings** ? **API**
2. Copy your **Project URL** (starts with https://)
3. Copy your **anon key** (the public key)
4. Save these - you'll need them for Vercel

## Step 4: (Optional) Third-party AI keys

This project does not include an integrated AI chatbot by default. If you plan to add an external AI integration later, obtain any required API keys from the provider and store them in your Vercel environment variables.

## Step 5: Connect GitHub to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Sign in or create your account
3. Click "Add New Project"
4. Select "Import Git Repository"
5. Find and select your GitHub repository

## Step 6: Configure Vercel Project

In the import dialog:
- **Project Name**: scoutmanager
- **Framework Preset**: Vite
- **Root Directory**: BaseMind-main (if applicable)
- Click "Continue"

## Step 7: Add Environment Variables

**Important**: These variables must be set in Vercel, not in a local .env file.

1. In Vercel after clicking "Deploy", you'll see the environment variables screen
2. Add these 4 variables:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | Your Supabase Project URL (from Step 3) |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase Anon Key (from Step 3) |
| `VITE_APP_URL` | Your Vercel domain, e.g., `https://scoutmanager.vercel.app` |

**Note**: If you forgot to add them before deployment, you can:
1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Add the variables there
3. Click **Redeploy** on the latest deployment

## Step 8: Deploy

1. Click "Deploy"
2. Vercel will automatically build and deploy
3. Wait for build to complete (1-2 minutes)
4. Your app is live at your Vercel URL!

## Step 9: Verify & Access

1. Visit your Vercel URL
2. You should see the ScoutManager login page
3. Log in with your admin credentials from Supabase setup

## Post-Deployment

### Create/Manage Users

1. Go to Supabase dashboard
2. Click **Authentication** ? **Users**
3. Add new users via:
   - Supabase UI: Click "Add user"
   - App registration (if enabled)
   - SQL: Run INSERT into users table

### Update Environment Variables

To change environment variables later:
1. In Vercel project ? **Settings** ? **Environment Variables**
2. Edit or add variables
3. Redeploy (push to GitHub or click Redeploy)

### Custom Domain

1. In Vercel project ? **Settings** ? **Domains**
2. Add your custom domain
3. Update DNS according to Vercel's instructions
4. Update VITE_APP_URL in environment variables

## Customizing for Your Organization

### 1. Update Branding
- Replace logo images in src/assets/
- Modify colors in src/styles/theme.css
- Update organization name in components

### 2. Modify Database Schema
- Edit supabase/migrations/001_initial_schema.sql
- Add new tables as needed
- Run migrations in Supabase SQL Editor

### 3. Add New Pages
- Create components in src/app/components/
- Add routes in src/app/routes.tsx
- Update navigation in src/app/components/Layout.tsx

## Disabled Features (Not Available)

The following are **NOT supported** in this Vercel-only configuration:

- ? 
pm run dev - Local development server
- ? .env.local files - Use Vercel environment variables only
- ? Supabase local emulator - Not configured
- ? Local testing - Use Vercel preview deployments

## Troubleshooting

### "Supabase connection failed"
- Check VITE_SUPABASE_URL is correct in Vercel
- Verify Supabase project is active
- Confirm API keys are valid

### "Build failed" on Vercel
- Check build logs in Vercel dashboard
- Verify all dependencies in package.json
- Ensure root directory is set correctly

### "White screen" on app load
- Check browser console (F12 ? Console tab)
- Verify environment variables are set in Vercel
- Confirm Supabase database tables exist (check via migrations)

### App won't start
- Ensure all migrations ran successfully in Supabase
- Verify environment variables in Vercel settings
- Check Vercel deployment logs

## Security Notes

- Never commit .env or .env.local files
- Keep API keys private - only use Vercel's environment variables
- Use strong Supabase passwords
- Regularly rotate API keys
- Enable RLS (Row Level Security) policies in Supabase for production

## Support

For deployment issues:
1. Check Vercel deployment logs
2. Check Supabase dashboard for errors
3. Verify all environment variables
4. Confirm migrations were applied to database
