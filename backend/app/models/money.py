"""Private wallet catalog and immutable cash journal."""
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, Text, UniqueConstraint, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class WalletType(Base):
    __tablename__ = "wallet_types"
    __table_args__ = (
        Index("uq_wallet_type_owner_name", "user_id", "name_key", unique=True, postgresql_where=text("user_id IS NOT NULL")),
        Index("uq_wallet_type_default_name", "name_key", unique=True, postgresql_where=text("user_id IS NULL")),
    )
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(50))
    name_key: Mapped[str] = mapped_column(String(100))
    archived_at: Mapped[datetime | None] = mapped_column(DateTime)


class MoneyEvent(Base):
    __tablename__ = "money_events"
    __table_args__ = (UniqueConstraint("user_id", "idempotency_key", name="uq_money_request"),)
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(30))
    description: Mapped[str] = mapped_column(String(255))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3))
    personal_share: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    occurred_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    source_type: Mapped[str | None] = mapped_column(String(30))
    source_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, index=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(120))
    request_fingerprint: Mapped[str | None] = mapped_column(Text)
    reversal_of: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("money_events.id"), unique=True)
    reversed_at: Mapped[datetime | None] = mapped_column(DateTime)
    entries: Mapped[list["WalletEntry"]] = relationship(back_populates="event", lazy="selectin")


class WalletEntry(Base):
    __tablename__ = "wallet_entries"
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("money_events.id"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    wallet_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("wallets.id"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    balance_after: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String(3))
    event: Mapped["MoneyEvent"] = relationship(back_populates="entries")
    wallet: Mapped["Wallet"] = relationship(lazy="selectin")
