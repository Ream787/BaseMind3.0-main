The app is intended to provide a simple way to track Equipment within my scout group. It was meant to be visible to all and update automatically. During this, I tried multiple different methods, including a XAML app, Microsoft Access and some other Web development Software. I then, after many attempts, decided to make a Web app as it would automatically sync across users and provide a good interface. This was going well, and I was making progress, until I broke something, and I tried to get GitHub Copilot to fix it. It, for some reason, reset my GitHub repository, which meant I could not go back to a previous working version. It somehow kept getting worse. I have decided to just leave it for now and try again some other time.
I think the biggest issue was that I tried to implement too many features at once without having a proper working basic functionality. Therefore, I think the best option would be for me to restart from scratch and focus on making a working basic website before trying to implement AI chatbots, role-based access and security. Also, I have learnt how to use GitHub properly and not give Copilot full access to my GitHub.
# ScoutManager - Scout Equipment Management App

A comprehensive web application for managing Scout group equipment, camps, documents, and members with AI-powered chatbot assistance.

## 🎯 Features

- **Equipment Management**: Track equipment inventory, maintenance schedules, and conditions
- **Camp Planning**: Plan and organize camping trips with location management
- **Document Management**: Upload and organize group policies and documents
- **AI Chatbot**: Ask questions about your group's documents using Google Gemini
- **User Management**: Role-based access control (Admin, Manager, Member, Viewer)
- **Camp Locations**: Manage favorite camping locations and their details
- **Reports**: Generate reports on equipment and camp activities
- **Real-time Sync**: All data synced with Supabase backend

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or pnpm
- Supabase account
- Google Gemini API key

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Create environment file
cp .env.example .env.local

# 3. Add your credentials to .env.local
# VITE_SUPABASE_URL=your-project-url
# VITE_SUPABASE_ANON_KEY=your-anon-key
# VITE_GEMINI_API_KEY=your-gemini-key

# 4. Run development server
npm run dev
```

Visit `http://localhost:5173` and log in with:
- Email: `admin@scouts.org`
- Password: `admin123`

## 📚 Documentation

Complete setup and deployment guides:
- [QUICKSTART.md](./QUICKSTART.md) - Get running in 5 minutes
- [SETUP.md](./SETUP.md) - Full setup + Vercel deployment

## 🏗️ Tech Stack

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
- Google Generative AI (Gemini)
- RAG (Retrieval Augmented Generation)

**Deployment:**
- Vercel (Frontend)
- Supabase (Database & Functions)

## 📁 Project Structure

```
src/
├── app/
│   ├── components/          # Page and UI components
│   ├── context/             # React contexts (Auth, Data, Theme)
│   └── routes.tsx           # Route configuration
├── assets/                  # Images and static files
└── styles/                  # CSS and theme

supabase/
├── functions/server/        # Edge functions
├── migrations/              # Database schema
└── README.md               # Supabase setup

utils/
└── supabase/               # Supabase utilities
```

## 🔐 Authentication

- Role-based access control with 4 roles:
  - **Admin**: Full access to all groups
  - **Group Manager**: Manage specific groups
  - **Member**: View and edit group data
  - **Viewer**: Read-only access

## 💬 AI Chatbot

The chatbot uses Google Generative AI (Gemini) with Retrieval Augmented Generation (RAG):
- Answers questions based on uploaded documents
- Context-aware within selected group
- Secure backend API calls
- No API keys exposed to frontend

## 🛠️ Development

### Available Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build
```

### Building New Features

1. Create components in `src/app/components/`
2. Add routes in `src/app/routes.tsx`
3. Use contexts for state management
4. Add types to `DataContext.tsx`
5. Update database schema if needed

## 🗄️ Database Schema

Key tables:
- `users` - User accounts and roles
- `groups` - Scout groups
- `equipment` - Equipment inventory
- `camping_locations` - Venue information
- `camp_plans` - Trip planning
- `documents` - Policy documents
- `chat_messages` - Chatbot history

See [supabase/migrations/](./supabase/migrations/) for full schema.

## 🔒 Security

- All API keys stored in environment variables
- Row Level Security (RLS) on database tables
- Backend authentication for sensitive operations
- CORS properly configured
- No sensitive data in frontend

## 🐛 Troubleshooting

### Chatbot not working
- Check `GOOGLE_AI_API_KEY` is set in Supabase secrets
- Verify Supabase functions are deployed
- Check browser console for errors

### Database connection issues
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Ensure Supabase project is active
- Check network connectivity

### Build errors
```bash
rm -rf node_modules package-lock.json
npm install
```

## 📖 Documentation

- [QUICKSTART](./QUICKSTART.md) - 5-minute setup
- [Setup Guide](./SETUP.md) - Complete setup + deployment

## 🤝 Contributing

1. Create a feature branch
2. Make changes and test locally
3. Submit a pull request

## 📝 License

See [LICENSE](./LICENSE) for details.

## 👥 Support

For issues and questions, please create a GitHub issue or contact the development team.
  
