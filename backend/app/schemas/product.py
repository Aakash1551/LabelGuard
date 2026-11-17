from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ProductBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    brand: Optional[str] = Field(None, max_length=255)
    category: str = Field(
        default="FOOD",
        pattern="^(FOOD|COSMETICS|COMMODITY|ELECTRONICS)$"
    )
    barcode_gtin: Optional[str] = Field(None, max_length=64)


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    brand: Optional[str] = Field(None, max_length=255)
    category: Optional[str] = Field(None, pattern="^(FOOD|COSMETICS|COMMODITY|ELECTRONICS)$")
    barcode_gtin: Optional[str] = Field(None, max_length=64)


class ProductResponse(ProductBase):
    id: str
    created_by_id: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
