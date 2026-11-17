from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.session import get_db
from app.models.user import User
from app.models.rule import ComplianceRule
from app.schemas.rule import ComplianceRuleResponse
from app.api.deps import get_current_user

router = APIRouter()


@router.get("/", response_model=List[ComplianceRuleResponse], summary="List Legal Metrology Rules Catalog")
async def list_rules(
    category: Optional[str] = Query(None, description="Filter by declaration category"),
    is_active: bool = Query(True, description="Filter active rules"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns the statutory rules governing packaged commodity labeling under PCR 2011.
    """
    stmt = select(ComplianceRule).where(ComplianceRule.is_active == is_active)
    if category:
        stmt = stmt.where(ComplianceRule.category == category)
    stmt = stmt.order_by(ComplianceRule.rule_code)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{rule_code}", response_model=ComplianceRuleResponse, summary="Get Specific Regulatory Rule")
async def get_rule_by_code(
    rule_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(ComplianceRule).where(ComplianceRule.rule_code == rule_code)
    result = await db.execute(stmt)
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Regulatory rule '{rule_code}' not found in registry"
        )
    return rule
