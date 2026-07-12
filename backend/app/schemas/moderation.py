from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator

REPORT_TARGETS = {"user", "group", "expense", "message"}
REPORT_REASONS = {"spam", "abuse", "fake_account", "inappropriate", "other"}
REPORT_STATUSES = {"open", "reviewing", "dismissed", "actioned"}


class ReportCreate(BaseModel):
    target_type: str
    target_id: int
    reason: str
    description: Optional[str] = None

    @field_validator("target_type")
    @classmethod
    def _t(cls, v: str) -> str:
        if v not in REPORT_TARGETS:
            raise ValueError("Invalid target_type")
        return v

    @field_validator("reason")
    @classmethod
    def _r(cls, v: str) -> str:
        if v not in REPORT_REASONS:
            raise ValueError("Invalid reason")
        return v


class ReportRead(BaseModel):
    id: int
    reporter_id: Optional[int] = None
    reporter_username: Optional[str] = None
    target_type: str
    target_id: int
    target_username: Optional[str] = None
    reason: str
    description: Optional[str] = None
    status: str
    notes: Optional[str] = None
    handled_by: Optional[int] = None
    handled_by_username: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class ReportStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def _s(cls, v: str) -> str:
        if v not in REPORT_STATUSES:
            raise ValueError("Invalid status")
        return v


class ReportNotesUpdate(BaseModel):
    notes: str


class ReportWarn(BaseModel):
    message: Optional[str] = None
