import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.auth import get_admin_client, get_current_user
from app.schemas import StudyPack, StudyPackInput, StudyPackList

router = APIRouter(prefix="/api/study-packs", tags=["study packs"])


@router.get("", response_model=StudyPackList)
def list_study_packs(user: dict[str, Any] = Depends(get_current_user)) -> StudyPackList:
    result = (
        get_admin_client()
        .table("study_packs")
        .select("*")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return StudyPackList(items=result.data or [])


@router.post("", response_model=StudyPack, status_code=status.HTTP_201_CREATED)
def save_study_pack(
    payload: StudyPackInput,
    user: dict[str, Any] = Depends(get_current_user),
) -> StudyPack:
    values = payload.model_dump()
    values.update({"id": str(uuid.uuid4()), "user_id": user["id"]})
    result = get_admin_client().table("study_packs").insert(values).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="The study pack could not be saved.")
    return StudyPack(**result.data[0])


@router.put("/{pack_id}", response_model=StudyPack)
def update_study_pack(
    pack_id: str,
    payload: StudyPackInput,
    user: dict[str, Any] = Depends(get_current_user),
) -> StudyPack:
    result = (
        get_admin_client()
        .table("study_packs")
        .update(payload.model_dump())
        .eq("id", pack_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Study pack not found.")
    return StudyPack(**result.data[0])


@router.get("/{pack_id}", response_model=StudyPack)
def get_study_pack(
    pack_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> StudyPack:
    result = (
        get_admin_client()
        .table("study_packs")
        .select("*")
        .eq("id", pack_id)
        .eq("user_id", user["id"])
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Study pack not found.")
    return StudyPack(**result.data[0])


@router.delete("/{pack_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_study_pack(
    pack_id: str,
    user: dict[str, Any] = Depends(get_current_user),
) -> Response:
    result = (
        get_admin_client()
        .table("study_packs")
        .delete()
        .eq("id", pack_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Study pack not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
