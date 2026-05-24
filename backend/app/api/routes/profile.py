from fastapi import APIRouter
from app.models.profile import UserProfile

router = APIRouter()

_store: dict[str, UserProfile] = {}


@router.post("/save")
def save_profile(session_id: str, profile: UserProfile):
    _store[session_id] = profile
    return {"ok": True}


@router.get("/load")
def load_profile(session_id: str) -> UserProfile:
    return _store.get(session_id, UserProfile())
