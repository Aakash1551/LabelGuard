from datetime import datetime
from typing import List, Optional, Any, TYPE_CHECKING
from sqlalchemy import (
    String,
    Text,
    Float,
    Integer,
    Boolean,
    ForeignKey,
    JSON,
    DateTime,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin, utc_now

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.product import Product
    from app.models.rule import ComplianceFinding
    from app.models.report import InspectionReport


class Inspection(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "inspections"

    inspection_number: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True,
        nullable=False
    )
    product_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True
    )
    inspector_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default="PROCESSING",
        index=True,
        nullable=False
    )  # PROCESSING, COMPLIANT, POTENTIALLY_NON_COMPLIANT, REQUIRES_MANUAL_REVIEW, FAILED
    overall_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Manual audit override
    is_manual_override: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    manual_override_by_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    manual_override_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    product: Mapped[Optional["Product"]] = relationship("Product", back_populates="inspections")
    inspector: Mapped["User"] = relationship(
        "User",
        foreign_keys=[inspector_id],
        back_populates="inspections_conducted"
    )
    images: Mapped[List["InspectionImage"]] = relationship(
        "InspectionImage",
        back_populates="inspection",
        cascade="all, delete-orphan",
        order_by="InspectionImage.created_at"
    )
    extracted_declarations: Mapped[List["ExtractedDeclaration"]] = relationship(
        "ExtractedDeclaration",
        back_populates="inspection",
        cascade="all, delete-orphan"
    )
    findings: Mapped[List["ComplianceFinding"]] = relationship(
        "ComplianceFinding",
        back_populates="inspection",
        cascade="all, delete-orphan"
    )
    report: Mapped[Optional["InspectionReport"]] = relationship(
        "InspectionReport",
        back_populates="inspection",
        uselist=False,
        cascade="all, delete-orphan"
    )


class InspectionImage(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "inspection_images"

    inspection_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("inspections.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    panel_type: Mapped[str] = mapped_column(
        String(50),
        default="FRONT",
        nullable=False
    )  # FRONT, BACK, LEFT, RIGHT, TOP, BOTTOM, BULK
    width_px: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height_px: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    preprocessed_file_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False
    )

    # Relationships
    inspection: Mapped["Inspection"] = relationship("Inspection", back_populates="images")
    ocr_tokens: Mapped[List["OCRToken"]] = relationship(
        "OCRToken",
        back_populates="image",
        cascade="all, delete-orphan",
        order_by="OCRToken.line_index"
    )


class OCRToken(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "ocr_tokens"

    image_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("inspection_images.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    detected_text: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    polygon_bbox: Mapped[Any] = mapped_column(JSON, nullable=False)  # [[x1, y1], [x2, y2], [x3, y3], [x4, y4]]
    line_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False
    )

    # Relationships
    image: Mapped["InspectionImage"] = relationship("InspectionImage", back_populates="ocr_tokens")


class ExtractedDeclaration(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "extracted_declarations"

    inspection_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("inspections.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    source_image_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("inspection_images.id", ondelete="SET NULL"),
        nullable=True
    )
    field_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True
    )  # MANUFACTURER, NET_QUANTITY, MRP, UNIT_SALE_PRICE, MFG_DATE, EXPIRY_DATE, CONSUMER_CARE, COUNTRY_OF_ORIGIN, GENERIC_NAME
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    parsed_value: Mapped[Any] = mapped_column(JSON, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    primary_bbox: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False
    )

    # Relationships
    inspection: Mapped["Inspection"] = relationship("Inspection", back_populates="extracted_declarations")
