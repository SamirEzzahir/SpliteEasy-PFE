from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator

# Allowed values (kept in sync with the frontend selectors and migrations).
TICKET_CATEGORIES = {"bug", "feature", "account", "payment", "other"}
TICKET_PRIORITIES = {"low", "medium", "high"}
TICKET_STATUSES = {"open", "in_progress", "waiting_user", "resolved", "closed"}


class TicketCreate(BaseModel):
    subject: str = Field(min_length=3, max_length=200)
    message: str = Field(min_length=1, max_length=2000)
    category: str = "other"
    priority: str = "medium"

    @field_validator("category")
    @classmethod
    def _valid_category(cls, v: str) -> str:
        return v if v in TICKET_CATEGORIES else "other"

    @field_validator("priority")
    @classmethod
    def _valid_priority(cls, v: str) -> str:
        return v if v in TICKET_PRIORITIES else "medium"


class TicketReplyCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class TicketReplyRead(BaseModel):
    id: int
    author_id: Optional[int] = None
    author_username: Optional[str] = None
    is_admin: bool = False
    body: str
    created_at: datetime


class TicketRead(BaseModel):
    id: int
    subject: str
    category: str
    priority: str
    status: str
    user_id: int
    requester_username: Optional[str] = None
    assigned_to_id: Optional[int] = None
    assignee_username: Optional[str] = None
    reply_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None


class TicketDetail(TicketRead):
    message: str
    replies: list[TicketReplyRead] = []


# ── Admin mutations ──────────────────────────────────────────────────────────
class TicketStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def _valid_status(cls, v: str) -> str:
        if v not in TICKET_STATUSES:
            raise ValueError("Invalid status")
        return v


class TicketPriorityUpdate(BaseModel):
    priority: str

    @field_validator("priority")
    @classmethod
    def _valid_priority(cls, v: str) -> str:
        if v not in TICKET_PRIORITIES:
            raise ValueError("Invalid priority")
        return v


class TicketAssign(BaseModel):
    assignee_id: Optional[int] = None
