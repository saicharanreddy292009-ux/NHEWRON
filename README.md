# NHEWRON — Focus. Learn. Evolve.

NHEWRON is a learning workspace with a React + Vite frontend, a FastAPI API, streamed Groq-powered Ron AI, Markdown-rendered answers, account authentication, profile settings, and user-specific study packs.

## Stack

- Frontend: React, Vite, React Markdown, GitHub-Flavoured Markdown, Inter typography.
- Authentication: Supabase Auth (registration, email verification, password reset/change and session management).
- Backend: FastAPI, validates Supabase access tokens before serving protected routes.
- Data: Supabase Postgres, with row-level security policies plus backend ownership checks.
- AI: Groq `openai/gpt-oss-120b` with streamed SSE responses.

## Required one-time setup

### 1. Create/configure a Supabase project

1. Create a Supabase project.
2. Open the project's **SQL Editor** and run the full [`supabase/schema.sql`](supabase/schema.sql) file. This creates profile and study-pack tables, profile creation for new accounts, and RLS policies.
3. In **Authentication → URL Configuration**, set the Site URL to `https://nhewron.vercel.app` and add the production site (and any preview URLs you use) to the allowed redirect URLs.
4. In **Authentication → Providers → Email**, decide whether email verification is required. With verification enabled, users must click the link sent after registration before signing in.

### 2. Frontend environment variables

Configure these in the Vercel project whose root directory is `frontend`:

```dotenv
VITE_API_BASE_URL=https://nhewron-qrsd.vercel.app
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
```

The anon/publishable key is designed for client use. Never add the service-role key to the frontend or prefix a server secret with `VITE_`.

### 3. Backend environment variables

Configure these in the Vercel project whose root directory is `backend`:

```dotenv
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_server_only_service_role_secret
CORS_ORIGINS=https://nhewron.vercel.app
```

Keep `GROQ_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` server-side only. Redeploy both Vercel projects after adding or changing variables.

## Run locally

### Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Vite serves the app at http://localhost:5173. Fill the Supabase values in `frontend/.env` and set `VITE_API_BASE_URL` to the local or deployed FastAPI service.

### Backend

```bash
cd backend
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API root: http://localhost:8000
- Interactive API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/api/health

## Account functionality

- Sign up, sign in, verify email where configured, and request a password reset.
- Edit full name and a unique 3–24-character username.
- Change password inside profile settings.
- Export profile details and study packs to a JSON file.
- Sign out from the current session.
- Study packs are read and modified only for the authenticated account.
- Theme preference persists locally per browser.

## Main API routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Public API status |
| POST | `/api/chat` | Authenticated streamed Ron AI |
| GET, PATCH | `/api/profile` | Read/update signed-in profile |
| GET, POST | `/api/study-packs` | List/create private study packs |
| GET, PUT, DELETE | `/api/study-packs/{id}` | Manage a pack owned by the current user |

