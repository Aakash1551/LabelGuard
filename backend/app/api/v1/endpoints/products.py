from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.session import get_db
from app.models.user import User
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse
from app.api.deps import get_current_user

router = APIRouter()


@router.get("/", response_model=List[ProductResponse], summary="List Packaged Commodities")
async def list_products(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = Query(None, description="Search by name or brand"),
    category: Optional[str] = Query(None, description="Filter by category"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Product)
    if category:
        stmt = stmt.where(Product.category == category)
    if search:
        search_filter = f"%{search.strip()}%"
        stmt = stmt.where((Product.name.ilike(search_filter)) | (Product.brand.ilike(search_filter)))

    stmt = stmt.offset(skip).limit(limit).order_by(Product.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED, summary="Create Product Entry")
async def create_product(
    product_in: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_product = Product(
        name=product_in.name.strip(),
        brand=product_in.brand.strip() if product_in.brand else None,
        category=product_in.category,
        barcode_gtin=product_in.barcode_gtin.strip() if product_in.barcode_gtin else None,
        created_by_id=current_user.id
    )
    db.add(new_product)
    await db.commit()
    await db.refresh(new_product)
    return new_product


@router.get("/{product_id}", response_model=ProductResponse, summary="Get Product Details")
async def get_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Product).where(Product.id == product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product record not found"
        )
    return product
