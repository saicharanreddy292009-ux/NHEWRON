# NHEWRON — Focus. Learn. Evolve.

NHEWRON is a learning workspace with a React + Vite frontend, a FastAPI service, streamed Groq-powered learning chat, YouTube lecture embeds, and saved study packs.

## Project structure

- `frontend/` — React SPA, built with Vite.
- `backend/` — FastAPI, Groq integration and SQLite study-pack persistence.

## Run locally

### 1. Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Vite serves the app at http://localhost:5173. Set `VITE_API_BASE_URL` in the frontend environment if your API runs somewhere else.

### 2. Backend

Open a second terminal:

```bash
cd backend
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env
```

Create a key from the [Groq console](https://console.groq.com/keys). Add it to `backend/.env`:

```dotenv
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b
```

Keep the Groq key on the server only. Do not put it in React source, use a `VITE_` variable for it, or commit the real `.env`.

Start the server:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API root: http://localhost:8000
- Interactive API docs: http://localhost:8000/docs
- Health: http://localhost:8000/api/health

## Main API routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Report API and Groq-key configuration |
| POST | `/api/chat` | Stream Ron responses from Groq; optional transcript context |
| GET | `/api/study-packs` | List persisted study packs |
| POST | `/api/study-packs` | Create a study pack |
| GET | `/api/study-packs/{id}` | Read a study pack |
| PUT | `/api/study-packs/{id}` | Update a study pack |
| DELETE | `/api/study-packs/{id}` | Delete a study pack |

Study packs are stored in SQLite at `backend/nhewron.db` by default. Set `DATABASE_PATH` to change the path.

## YouTube playback

The app accepts standard watch links, short links, Shorts, livestream and embed URLs, and uses YouTube's privacy-enhanced `youtube-nocookie.com` embed domain. Playback still depends on the video's embedding and age restrictions. When a video is not embeddable, use the visible **Open on YouTube** fallback.

## Before public launch

This is a development-ready foundation, not yet a secure multi-user production service. Add authentication and per-user authorization, request/rate limits, provider usage controls, database migrations/backups, deployment-specific CORS, monitoring, and secret management before exposing the API publicly. The focus screen cannot block other apps or websites.
