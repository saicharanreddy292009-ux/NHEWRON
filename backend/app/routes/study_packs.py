import uuid
from fastapi import APIRouter, HTTPException, Response, status
from app import database
from app.schemas import StudyPack, StudyPackInput, StudyPackList

router = APIRouter(prefix="/api/study-packs", tags=["study packs"])

@router.get("", response_model=StudyPackList)
async def list_study_packs() -> StudyPackList:
    return StudyPackList(items=database.list_packs())

@router.post("", response_model=StudyPack, status_code=status.HTTP_201_CREATED)
async def save_study_pack(payload: StudyPackInput) -> StudyPack:
    return StudyPack(**database.save_pack(str(uuid.uuid4()), payload.model_dump()))

@router.put("/{pack_id}", response_model=StudyPack)
async def update_study_pack(pack_id: str, payload: StudyPackInput) -> StudyPack:
    if not database.get_pack(pack_id):
        raise HTTPException(status_code=404, detail="Study pack not found.")
    return StudyPack(**database.save_pack(pack_id, payload.model_dump()))

@router.get("/{pack_id}", response_model=StudyPack)
async def get_study_pack(pack_id: str) -> StudyPack:
    pack = database.get_pack(pack_id)
    if not pack:
        raise HTTPException(status_code=404, detail="Study pack not found.")
    return StudyPack(**pack)

@router.delete("/{pack_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_study_pack(pack_id: str) -> Response:
    if not database.delete_pack(pack_id):
        raise HTTPException(status_code=404, detail="Study pack not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
