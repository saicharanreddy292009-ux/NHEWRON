import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.auth import get_admin_client, get_current_user
from app.schemas import ChatHistoryInput

router = APIRouter(prefix="/api/chat-history", tags=["chat history"])

LIST_FIELDS = "id,mode,title,source_url,summary,created_at,updated_at"


@router.get("")
def list_chat_history(
    mode: Literal["ai", "studio"] | None = Query(default=None),
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, list[dict[str, Any]]]:
    query = (
        get_admin_client()
        .table("chat_sessions")
        .select(LIST_FIELDS)
        .eq("user_id", user["id"])
        .order("updated_at", desc=True)
        .limit(30)
    )
    if mode:
        query = query.eq("mode", mode)
    result = query.execute()
    return {"items": result.data or []}


@router.get("/{session_id}")
def get_chat_session(
    session_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    result = (
        get_admin_client()
        .table("chat_sessions")
        .select("*")
        .eq("id", session_id)
        .eq("user_id", user["id"])
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    return result.data[0]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_chat_session(
    payload: ChatHistoryInput,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    values = payload.model_dump(mode="json")
    values.update({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    result = get_admin_client().table("chat_sessions").insert(values).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="The chat could not be saved.")
    return result.data[0]


@router.put("/{session_id}")
def update_chat_session(
    session_id: str,
    payload: ChatHistoryInput,
    user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    values = payload.model_dump(mode="json")
    values["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = (
        get_admin_client()
        .table("chat_sessions")
        .update(values)
        .eq("id", session_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    return result.data[0]


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chat_session(
    session_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> Response:
    result = (
        get_admin_client()
        .table("chat_sessions")
        .delete()
        .eq("id", session_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
