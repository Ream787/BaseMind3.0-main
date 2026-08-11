# ScoutManager - Complete Setup Guide

## Prerequisites

- Node.js 18+ installed
- npm or pnpm package manager
- Git
- A Supabase account (https://supabase.com)
- A Google Cloud account with Gemini API enabled
- (Optional) A Vercel account for deployment

## Local Development Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd BaseMind-main

# Install dependencies
npm install

# Or with pnpm
pnpm install
```

### 2. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Name it "scoutmanager"
4. Choose a region near you
5. Create a strong password
6. Wait for the project to initialize

### 3. Get Supabase Credentials

From your Supabase project dashboard:

1. Go to **Settings** > **API**
2. Copy your **Project URL** (starts with `https://`)
3. Copy your **anon key** (the public key)
4. Also get **Service Role Secret Key** (keep this private!)

### 4. Create Environment File

```bash
# Copy the example file
cp .env.example .env.local

# Edit .env.local with your credentials
```

Edit `.env.local` and add:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key-here
VITE_GEMINI_API_KEY=your-gemini-api-key-here
VITE_APP_URL=http://localhost:5173
NODE_ENV=development
```

### 5. Setup Supabase Database

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy entire contents of `supabase/migrations/001_initial_schema.sql`
5. Paste into the SQL editor
6. Click **Run**
7. Wait for completion

### 6. Get Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com)
2. Click "Get API Key" button
3. Create a new API key
4. Copy it to your `.env.local` file as `VITE_GEMINI_API_KEY`

### 7. Run Development Server

```bash
npm run dev

# Application will be available at http://localhost:5173
```

### 8. Test Login

Use these test credentials:
- Email: `admin@scouts.org`
- Password: `admin123`

(Note: In production, you must implement proper password hashing with bcrypt)

## Project Structure

```
src/
├── app/
│   ├── components/          # React components for each page
│   ├── context/             # Authentication, Data, Theme contexts
│   └── App.tsx              # Main app component
├── assets/                  # Images and static files
└── styles/                  # Global CSS and Tailwind config

supabase/
├── functions/server/        # Edge functions (Hono server)
├── migrations/              # Database schema SQL
└── README.md               # Supabase setup guide

utils/
└── supabase/               # Supabase client and utilities
```

## Key Files to Update for Your Use Case

### 1. Add Your Branding
- Update logo images in `src/assets/`
- Modify colors in `src/styles/theme.css`
- Update organization name in components

### 2. Customize Database Schema
- Edit `supabase/migrations/001_initial_schema.sql`
- Add new tables as needed
- Run migrations in Supabase SQL editor

### 3. Add New Pages
- Create components in `src/app/components/`
- Add routes in `src/app/routes.tsx`
- Update navigation in `src/app/components/Layout.tsx`

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete Vercel deployment instructions.

### Quick Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Follow prompts and set environment variables in Vercel dashboard
```

## Common Tasks

### Add a New Document Type

1. Add table to database schema
2. Create migration SQL and run in Supabase
3. Update types in `src/app/context/DataContext.tsx`
4. Create component to display the data

### Reset Database

```bash
# In Supabase SQL Editor, run:
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

# Then re-run your migrations
```

### Enable Row Level Security (RLS)

For security, enable RLS policies on tables:

```sql
-- Example: Allow users to see only their own group's data
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see equipment from their groups"
ON equipment FOR SELECT
USING (group_id IN (
  SELECT group_id FROM user_groups 
  WHERE user_id = auth.uid()
));
```

## Troubleshooting

### "Module not found" errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Supabase connection issues

1. Verify environment variables are correct
2. Check that Supabase project is active
3. Verify network connectivity
4. Check browser console for detailed errors

### Chatbot not responding

1. Verify GOOGLE_AI_API_KEY is set and valid
2. Check Supabase function logs
3. Verify documents are uploaded
4. Check browser network tab for API requests

### Authentication problems

1. Ensure database schema is created
2. Verify user exists in `users` table
3. Check password hash (currently plain text, needs bcrypt in production)
4. Clear browser localStorage: `localStorage.clear()`

## Security Considerations

⚠️ **Important:** Before deploying to production:

1. **Implement Password Hashing**
   - Use bcrypt or Argon2
   - Never store plain text passwords

2. **Enable Row Level Security**
   - Set up RLS policies
   - Restrict data access by group

3. **API Key Rotation**
   - Regularly rotate Gemini API keys
   - Use Supabase secrets for backend keys

4. **CORS Configuration**
   - Restrict to your domain
   - Review Supabase CORS settings

5. **Database Backups**
   - Enable automatic backups in Supabase
   - Test restore procedures

6. **Monitoring**
   - Set up error tracking (Sentry, LogRocket)
   - Monitor API usage
   - Track authentication attempts

## Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **Vite Guide**: https://vitejs.dev/guide/
- **React Docs**: https://react.dev
- **Tailwind CSS**: https://tailwindcss.com
- **Google Gemini**: https://ai.google.dev

## Next Steps

1. ✅ Complete local setup
2. ✅ Customize for your organization
3. ✅ Add your users to the database
4. ✅ Upload policy documents
5. ✅ Test all features
6. ✅ Deploy to Vercel
7. ✅ Configure custom domain
8. ✅ Set up monitoring
