from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ComplianceRuleBase(BaseModel):
    rule_code: str = Field(..., max_length=64)
    category: str = Field(..., max_length=64)
    title: str = Field(..., max_length=255)
    description: str
    act_reference: str = Field(..., max_length=255)
    rule_reference: str = Field(..., max_length=255)
    severity: str = Field(default="MANDATORY", pattern="^(MANDATORY|CONDITIONAL|RECOMMENDATION)$")
    is_active: bool = True
    version: str = "2011.amended"


class ComplianceRuleCreate(ComplianceRuleBase):
    pass


class ComplianceRuleResponse(ComplianceRuleBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ComplianceFindingResponse(BaseModel):
    id: str
    rule_id: str
    field_name: str
    status: str  # PASS, FAIL, REQUIRES_MANUAL_REVIEW, EXEMPTED
    detected_evidence: Optional[str] = None
    expected_format: Optional[str] = None
    confidence_score: float
    explanation: str
    legal_citation: str
    created_at: datetime
    rule: Optional[ComplianceRuleResponse] = None

    model_config = ConfigDict(from_attributes=True)
