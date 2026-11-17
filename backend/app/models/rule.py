from datetime import datetime
from typing import List, Optional, Any, TYPE_CHECKING
from sqlalchemy import (
    String,
    Text,
    Float,
    Boolean,
    ForeignKey,
    DateTime,
    JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin, utc_now

if TYPE_CHECKING:
    from app.models.inspection import Inspection


class ComplianceRule(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "compliance_rules"

    rule_code: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    category: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    act_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    rule_reference: Mapped[str] = mapped_column(String(255), nullable=False)
    severity: Mapped[str] = mapped_column(
        String(32),
        default="MANDATORY",
        nullable=False
    )  # MANDATORY, CONDITIONAL, RECOMMENDATION
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    version: Mapped[str] = mapped_column(String(32), default="2011.amended", nullable=False)

    # Relationships
    findings: Mapped[List["ComplianceFinding"]] = relationship(
        "ComplianceFinding",
        back_populates="rule",
        cascade="all, delete-orphan"
    )


class ComplianceFinding(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "compliance_findings"

    inspection_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("inspections.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    rule_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("compliance_rules.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )
    field_name: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False
    )  # PASS, FAIL, REQUIRES_MANUAL_REVIEW, EXEMPTED
    detected_evidence: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    expected_format: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    confidence_score: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    legal_citation: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False
    )

    # Relationships
    inspection: Mapped["Inspection"] = relationship("Inspection", back_populates="findings")
    rule: Mapped["ComplianceRule"] = relationship("ComplianceRule", back_populates="findings")
