from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, UUIDPrimaryKeyMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.inspection import Inspection
    from app.models.user import User


class Product(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "products"

    name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    brand: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    category: Mapped[str] = mapped_column(
        String(100),
        default="FOOD",
        nullable=False
    )  # FOOD, COSMETICS, COMMODITY, ELECTRONICS
    barcode_gtin: Mapped[Optional[str]] = mapped_column(String(64), index=True, nullable=True)
    created_by_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    # Relationships
    inspections: Mapped[List["Inspection"]] = relationship(
        "Inspection",
        back_populates="product",
        cascade="all, delete-orphan"
    )
