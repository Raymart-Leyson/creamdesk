# CreamDesk - Connector Hub

A "Desktop-like" web app built with Next.js 14+, Tailwind CSS, Supabase, and Framer Motion.

## Features
- **Desktop Interface**: Window management, Dock, Desktop Icons.
- **Google Integration**: Connect Drive and Calendar (Read-only listing).
- **Workspaces**: Manage projects, notes, and tasks.
- **PDF Intelligence**: Upload PDFs to generate summaries and flashcards via AI (OpenAI).
- **Creamy UI**: Custom "Cream" theme with thick borders and playful animations.

## Setup Instructions

### 1. Prerequisites
- Node.js 18+
- Supabase Account
- Google Cloud Console Project (for OAuth)
- OpenAI API Key (optional, for PDF AI)

### 2. Environment Variables
Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

Required keys:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase Anon Key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase Service Role Key (for Admin API routes)
- `GOOGLE_CLIENT_ID`: Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth Client Secret
- `NEXT_PUBLIC_APP_URL`: Your local URL (e.g., http://localhost:3000)
- `OPENAI_API_KEY`: Your OpenAI Key (optional)

### 3. Database Setup (Supabase)
Run the SQL migration in `supabase/migrations/20240101000000_initial_schema.sql` using the Supabase SQL Editor.

This handles:
- Tables (profiles, workspaces, notes, tasks, etc.)
- RLS Policies
- Storage Bucket (You must also create 'pdfs' bucket manually if SQL extension for storage is not enabled, though SQL tries to insert)

**Important**: Ensure you create a public (or private) bucket named `pdfs` in Supabase Storage if the SQL script doesn't automatically do it.

### 4. Google OAuth Configuration
1. Go to Google Cloud Console.
2. Create Credentials > OAuth Client ID (Web Application).
3. Add Redirect URI: `http://localhost:3000/api/oauth/google/callback`.
4. Enable APIs: Google Drive API, Google Calendar API.

### 5. Run Locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

## Architecture
- **Tech Stack**: Next.js App Router, Zustand (State), Tailwind v4 (Styling), Supabase (Backend).
- **Window Manager**: `src/store/useStore.ts` + `src/components/desktop/WindowManager.tsx`.
- **Apps**: Located in `src/apps/`. Each app is a component rendered inside a `WindowContainer`.

## Design System
- **Colors**: Cream (#FFF4E6), Espresso (#3A2A20), Peach (#FFB38A).
- **Typography**: Geist Sans / Mono.
- **Components**: Custom "Cream" components in `src/components/ui/CreamComponents.tsx`.

## License
MIT
