from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, Field, HttpUrl, field_validator


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=12000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=40)
    context: str | None = Field(default=None, max_length=12000)

    @field_validator("messages")
    @classmethod
    def require_user_message(cls, messages: list[ChatMessage]) -> list[ChatMessage]:
        if not any(message.role == "user" for message in messages):
            raise ValueError("At least one user message is required.")
        return messages


class ChatResponse(BaseModel):
    reply: str
    model: str


class StudyPackInput(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    source_url: str | None = Field(default=None, max_length=2048)
    transcript: str = Field(default="", max_length=100000)
    notes: str = Field(default="", max_length=50000)
    roadmap: str = Field(default="", max_length=20000)
    questions: str = Field(default="", max_length=20000)


class StudyPack(StudyPackInput):
    id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StudyPackList(BaseModel):
    items: list[StudyPack]
