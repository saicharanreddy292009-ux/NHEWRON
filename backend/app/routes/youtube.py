import logging
import re
from urllib.parse import parse_qs, urlparse

from fastapi import APIRouter, Depends, HTTPException
from groq import AsyncGroq
from starlette.concurrency import run_in_threadpool
from youtube_transcript_api import YouTubeTranscriptApi

from app.auth import get_current_user
from app.config import get_settings
from app.schemas import YouTubeTranscriptRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/youtube", tags=["youtube"])

VIDEO_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{11}$")
SUMMARY_CHAR_LIMIT = 40000
TRANSCRIPT_CHAR_LIMIT = 100000
PREFERRED_LANGUAGES = ["en", "en-US", "en-GB", "hi", "te"]


def extract_video_id(url: str) -> str:
    parsed = urlparse(url.strip())
    host = (parsed.hostname or "").lower().removeprefix("www.")
    if parsed.scheme not in ("http", "https") or host not in {
        "youtube.com", "m.youtube.com", "music.youtube.com",
        "youtu.be", "youtube-nocookie.com",
    }:
        raise HTTPException(status_code=422, detail="Paste a valid YouTube video URL.")

    video_id = ""
    if host == "youtu.be":
        video_id = parsed.path.strip("/").split("/")[0]
    elif parsed.path == "/watch":
        video_id = parse_qs(parsed.query).get("v", [""])[0]
    else:
        match = re.match(r"^/(?:embed|shorts|live|v)/([^/?]+)", parsed.path)
        if match:
            video_id = match.group(1)

    if not VIDEO_ID_PATTERN.fullmatch(video_id):
        raise HTTPException(status_code=422, detail="That URL doesn't contain a valid YouTube video ID.")
    return video_id


def fetch_transcript(video_id: str) -> tuple[str, str, bool]:
    api = YouTubeTranscriptApi()
    transcript_list = api.list(video_id)

    try:
        selected = transcript_list.find_transcript(PREFERRED_LANGUAGES)
    except Exception as exc:
        if type(exc).__name__ != "NoTranscriptFound":
            raise
        selected = next(iter(transcript_list), None)

    if selected is None:
        raise LookupError("No captions are available for this video.")

    fetched = selected.fetch()
    text = " ".join(snippet.text.strip() for snippet in fetched if snippet.text.strip())
    if not text:
        raise LookupError("The available captions for this video are empty.")
    return text, selected.language, bool(selected.is_generated)


@router.post("/transcript")
async def get_youtube_transcript(
    payload: YouTubeTranscriptRequest,
    user: dict = Depends(get_current_user),
) -> dict[str, object]:
    video_id = extract_video_id(payload.youtube_url)
    try:
        raw_transcript, language, is_generated = await run_in_threadpool(fetch_transcript, video_id)
    except LookupError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        name = type(exc).__name__
        logger.warning("Transcript extraction failed for video %s (%s)", video_id, name)
        if name == "TranscriptsDisabled":
            detail = "This video has captions disabled. Try another video or paste its transcript manually."
        elif name == "VideoUnavailable":
            detail = "This video is unavailable to the transcript service, possibly because it is private or age-restricted."
        elif name in {"RequestBlocked", "IpBlocked"}:
            detail = "YouTube blocked transcript access from this server. This can happen on serverless hosts such as Vercel. Try another video or paste the transcript manually."
        elif name == "NoTranscriptFound":
            detail = "No transcript was found in the supported languages. Try another video or paste the transcript manually."
        else:
            detail = "YouTube could not provide a transcript for this video right now. Try again or paste the transcript manually."
        raise HTTPException(status_code=502, detail=detail) from exc

    was_truncated = len(raw_transcript) > TRANSCRIPT_CHAR_LIMIT
    transcript = raw_transcript[:TRANSCRIPT_CHAR_LIMIT]
    summary = ""
    summary_error = ""
    summary_partial = len(raw_transcript) > SUMMARY_CHAR_LIMIT
    settings = get_settings()

    if settings.groq_api_key.strip():
        client = AsyncGroq(api_key=settings.groq_api_key, timeout=60.0, max_retries=1)
        try:
            summary_source = transcript[:SUMMARY_CHAR_LIMIT]
            completion = await client.chat.completions.create(
                model=settings.groq_model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are Ron, a concise study assistant. Summarize only the provided YouTube transcript. "
                            "Use clean Markdown with a short descriptive heading, 4-7 bullet points, and a final "
                            "one-sentence takeaway. Do not invent details or add a colon to headings. "
                            "If the transcript is a partial excerpt, say the summary covers the available excerpt."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            "Create a brief, accurate study summary from this transcript. "
                            + ("The transcript was shortened because it is very long. " if summary_partial else "")
                            + "\n\n" + summary_source
                        ),
                    },
                ],
                temperature=0.2,
                max_completion_tokens=900,
                top_p=1,
                reasoning_effort="medium",
                stream=False,
            )
            summary = (completion.choices[0].message.content or "").strip()
            if not summary:
                summary_error = "The transcript was extracted, but Ron returned an empty summary. You can still ask follow-up questions."
        except Exception:
            logger.exception("Transcript extracted, but summary generation failed for %s", video_id)
            summary_error = "The transcript was extracted, but the summary couldn't be generated right now. You can still ask follow-up questions."
        finally:
            await client.close()
    else:
        summary_error = "The transcript was extracted, but Ron AI is not configured to summarize it yet."

    return {
        "video_id": video_id,
        "youtube_url": payload.youtube_url,
        "transcript": transcript,
        "language": language,
        "is_generated": is_generated,
        "transcript_truncated": was_truncated,
        "summary": summary,
        "summary_partial": summary_partial,
        "summary_error": summary_error,
    }
