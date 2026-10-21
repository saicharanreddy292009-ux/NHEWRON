# NHEWRON FastAPI backend

## Setup

Use Python 3.12+.

```bash
cd backend
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env
```

Configure these variables in `.env`:

```dotenv
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_server_only_service_role_secret
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Create the Supabase project tables first by running [`supabase/schema.sql`](../supabase/schema.sql) in the Supabase SQL Editor. The schema adds profile creation for new users and private study packs linked to each account.

Keep `SUPABASE_SERVICE_ROLE_KEY` and `GROQ_API_KEY` server-side only. Never put the service role key in a `VITE_` variable or commit a real `.env` file.

## Run the API

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: http://localhost:8000/docs  
Health: http://localhost:8000/api/health

## Routes

- `POST /api/chat` — streams Ron's Groq response; requires a valid Supabase bearer token.
- `POST /api/youtube/transcript` — retrieves available YouTube captions and returns a concise AI summary; requires a valid Supabase bearer token.
- `GET /api/chat-history?mode=ai|studio` — list recent conversations belonging to the current account.
- `POST /api/chat-history`, `GET /api/chat-history/{id}`, `PUT /api/chat-history/{id}`, `DELETE /api/chat-history/{id}` — save, restore, update and delete an account-scoped chat.
- `GET /api/profile` — returns the current user's profile.
- `PATCH /api/profile` — updates full name and username for the current user.
- `GET /api/study-packs` — list only the current user's study packs.
- `POST /api/study-packs` — create a study pack for the current user.
- `GET /api/study-packs/{id}`, `PUT /api/study-packs/{id}`, `DELETE /api/study-packs/{id}` — access only the current user's pack.
- `GET /api/health` — public service health check.

## Authentication notes

Supabase Auth handles registration, email verification (if enabled in the Supabase project), session storage/refresh in the official JS client, password changes, and sign-out. FastAPI validates the bearer token with Supabase Auth before serving account data. Database table access is performed on the server, and every study-pack query is filtered by the authenticated user ID.

For production, verify email confirmation and password policies in Supabase Auth, set allowed redirect URLs to your frontend domain, configure exact production CORS origins, and keep all server-only secrets in Vercel backend environment variables.


## YouTube transcript limitations

Transcript retrieval uses `youtube-transcript-api` and the unauthenticated YouTube transcript interface. It can retrieve manually-created and auto-generated captions when available. YouTube can change this interface or block requests from cloud/serverless IP addresses, and some videos have no retrievable captions. In these cases the endpoint returns a human-readable error and the frontend keeps manual transcript entry available. This is not the official YouTube Data API and it does not extract audio or bypass restrictions.
