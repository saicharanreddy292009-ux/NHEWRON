from functools import lru_cache
from typing import Any

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client, create_client

from app.config import get_settings

bearer_scheme = HTTPBearer(auto_error=False)


@lru_cache
def get_auth_client() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(
            status_code=503,
            detail="Authentication is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY on the backend.",
        )
    return create_client(settings.supabase_url, settings.supabase_anon_key)


@lru_cache
def get_admin_client() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=503,
            detail="Supabase server configuration is missing. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        )
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, Any]:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(
            status_code=503,
            detail="Authentication is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY on the backend.",
        )
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Sign in to continue.")

    try:
        auth_client = get_auth_client()
        result = auth_client.auth.get_user(credentials.credentials)
        user = result.user
        if user is None:
            raise HTTPException(status_code=401, detail="Your session is invalid. Please sign in again.")
        return {"id": str(user.id), "email": user.email or ""}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Your session is invalid or expired. Please sign in again.")
