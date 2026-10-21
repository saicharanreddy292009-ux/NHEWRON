from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from postgrest.exceptions import APIError

from app.auth import get_admin_client, get_current_user

router = APIRouter(prefix="/api/profile", tags=["profile"])


class ProfileUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=24, pattern=r"^[A-Za-z0-9_]+$")
    full_name: str | None = Field(default=None, max_length=100)


@router.get("")
def get_profile(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    client = get_admin_client()
    result = client.table("profiles").select("id,username,full_name,created_at,updated_at").eq("id", user["id"]).limit(1).execute()
    if not result.data:
        # Support accounts created before the profile trigger was installed.
        seed = {
            "id": user["id"],
            "username": "user_" + user["id"].replace("-", "")[:12],
            "full_name": "",
        }
        client.table("profiles").insert(seed).execute()
        result = client.table("profiles").select("id,username,full_name,created_at,updated_at").eq("id", user["id"]).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found. Please contact support.")
    return {**result.data[0], "email": user["email"]}


@router.patch("")
def update_profile(
    payload: ProfileUpdate,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    if not changes:
        raise HTTPException(status_code=400, detail="Add at least one profile field to update.")

    client = get_admin_client()
    changes["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        result = client.table("profiles").update(changes).eq("id", user["id"]).execute()
    except APIError as exc:
        message = str(exc).lower()
        if "username" in message or "duplicate key" in message or "unique" in message:
            raise HTTPException(status_code=409, detail="That username is already in use. Please choose another.") from exc
        raise HTTPException(status_code=400, detail="Your profile could not be updated.") from exc

    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found.")
    row = result.data[0]
    return {**row, "email": user["email"]}
