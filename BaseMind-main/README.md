# ScoutManager - Scout Equipment Management App

A comprehensive web application for managing Scout group equipment, camps, documents, and members.

## ?? Features

- **Equipment Management**: Track equipment inventory, maintenance schedules, and conditions
- **Camp Planning**: Plan and organize camping trips with location management
- **Document Management**: Upload and organize group policies and documents
 
- **User Management**: Role-based access control (Admin, Manager, Member, Viewer)
- **Camp Locations**: Manage favorite camping locations and their details
- **Reports**: Generate reports on equipment and camp activities
- **Real-time Sync**: All data synced with Supabase backend

## ?? Deployment

**This application runs exclusively on Vercel.** 

### Vercel Deployment

1. **Push to GitHub**: Ensure your repository is on GitHub
2. **Connect to Vercel**: 
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Select the BaseMind-main folder as root directory

3. **Set Environment Variables** in Vercel:
   - Go to your Vercel project **Settings → Environment Variables**
   - Add these 4 variables (from your Supabase and Google accounts):
   ```
   VITE_SUPABASE_URL = https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY = your-anon-public-key
   VITE_APP_URL = https://your-domain.vercel.app
   ```

4. **Deploy**: Click "Deploy" - Vercel automatically builds and deploys your app

5. **Verify**: Your app will be live at your Vercel URL

## ?? Prerequisites for Deployment

- GitHub repository
- [Supabase project](https://supabase.com) with database configured
- [Google Gemini API key](https://aistudio.google.com)
- [Vercel account](https://vercel.com)

## ?? Production Setup

### Database Setup
Run these SQL migrations in your Supabase SQL Editor:
- supabase/migrations/001_initial_schema.sql - Create tables and schema
- supabase/migrations/002_setup_auth.sql - Setup authentication
- supabase/migrations/003_setup_first_admin.sql - Create admin user

See [SUPABASE_AUTH_SETUP.md](./SUPABASE_AUTH_SETUP.md) for detailed authentication instructions.

## ??? Tech Stack

**Frontend:**
- React 18.3
- TypeScript
- Vite
- Tailwind CSS
- Radix UI Components
- React Router

**Backend:**
- Supabase (PostgreSQL + Auth + Functions)
- Hono (Edge Functions Framework)
- Deno Runtime

**AI:**
This project no longer includes the AI chatbot feature.

**Deployment:**
- Vercel (Frontend)
- Supabase (Database & Functions)

## ?? Project Structure

`
src/
+-- app/
�   +-- components/          # Page and UI components
�   +-- context/             # React contexts (Auth, Data, Theme)
�   +-- routes.tsx           # Route configuration
+-- assets/                  # Images and static files
+-- styles/                  # CSS and theme

supabase/
+-- functions/server/        # Edge functions
+-- migrations/              # Database schema
+-- README.md               # Supabase setup

utils/
+-- supabase/               # Supabase utilities
`

## ?? Authentication

- Role-based access control with 4 roles:
  - **Admin**: Full access to all groups
  - **Group Manager**: Manage specific groups
  - **Member**: View and edit group data
  - **Viewer**: Read-only access

## Chatbot
This project does not include a chatbot feature.

## ??? Development & Deployment

**This application is configured for Vercel-only deployment.** Local development is not supported.

### Complete Deployment Instructions
See [SETUP.md](./SETUP.md) for comprehensive Vercel deployment guide.

### Quick Start (5 minutes)
See [QUICKSTART.md](./QUICKSTART.md) for Vercel deployment quick start.

### Customizing for Your Organization

1. **Update Branding**
   - Replace logo images in src/assets/
   - Modify colors in src/styles/theme.css
   - Update organization name in components

2. **Modify Database Schema**
   - Edit supabase/migrations/001_initial_schema.sql
   - Add new tables as needed
   - Run migrations in Supabase SQL Editor

3. **Add New Pages**
   - Create components in src/app/components/
   - Add routes in src/app/routes.tsx
   - Update navigation in src/app/components/Layout.tsx
   - Push to GitHub to trigger auto-deployment on Vercel

## ??? Database Schema

Key tables:
- users - User accounts and roles
- groups - Scout groups
- equipment - Equipment inventory
- camping_locations - Venue information
- camp_plans - Trip planning
- documents - Policy documents

See [supabase/migrations/](./supabase/migrations/) for full schema.

## ?? Security

- All API keys stored in environment variables
- Row Level Security (RLS) on database tables
- Backend authentication for sensitive operations
- CORS properly configured
- No sensitive data in frontend

## ?? Troubleshooting

### Chatbot not working
- Check GOOGLE_AI_API_KEY is set in Supabase secrets
- Verify Supabase functions are deployed
- Check browser console for errors

### Database connection issues
- Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
- Ensure Supabase project is active
- Check network connectivity

### Build errors
`ash
rm -rf node_modules package-lock.json
npm install
`

## ?? Documentation

- [QUICKSTART](./QUICKSTART.md) - Vercel deployment quick start
- [Setup Guide](./SETUP.md) - Complete Vercel deployment guide
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment information

## ?? Contributing

1. Create a feature branch
2. Make changes and test via Vercel preview deployments
3. Submit a pull request

## ?? License

See [LICENSE](./LICENSE) for details.

## ?? Support

For issues and questions, please create a GitHub issue or contact the development team.
