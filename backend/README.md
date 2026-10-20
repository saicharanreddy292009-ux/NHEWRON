# NHEWRON FastAPI backend

## Setup

```bash
cd backend
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env
```

Create a key in the [Groq console](https://console.groq.com/keys), then set these values in `.env`:

```dotenv
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b
```

Never put this key in React code, prefix it with `VITE_`, or commit the real `.env` file.

Start the API:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: http://localhost:8000/docs  
Health: http://localhost:8000/api/health

## Routes

- `POST /api/chat` — streams Ron's Groq response as Server-Sent Events (SSE); accepts `messages` plus optional transcript `context`.
- `GET /api/study-packs` — list saved study packs.
- `POST /api/study-packs` — create a study pack.
- `GET /api/study-packs/{id}`, `PUT /api/study-packs/{id}`, `DELETE /api/study-packs/{id}` — manage a pack.
- `GET /api/health` — API and Groq configuration status.

Study packs persist in SQLite via `DATABASE_PATH` (defaults to `nhewron.db`). This starter has no user authentication or per-user isolation: do not expose it publicly for multi-user data until authentication, authorization, quotas, and production database backups are added.
