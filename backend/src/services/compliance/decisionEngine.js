/**
 * Master Compliance Rules & Decision Engine (PCR 2011)
 * Evaluates extracted declarations against statutory requirements and computes
 * the overall legal compliance outcome:
 * - COMPLIANT
 * - POTENTIALLY_NON_COMPLIANT
 * - REQUIRES_MANUAL_REVIEW
 */

const ComplianceRule = require('../../models/ComplianceRule');
const { validateManufacturer } = require('./validators/manufacturerValidator');
const { validateCountryOfOrigin } = require('./validators/originValidator');
const { validateCommodityName } = require('./validators/commodityValidator');
const { validateNetQuantity } = require('./validators/quantityValidator');
const { validateDateOfManufacture } = require('./validators/dateValidator');
const { validateMRP } = require('./validators/mrpValidator');
const { validateUnitSalePrice } = require('./validators/uspValidator');
const { validateConsumerCare } = require('./validators/consumerCareValidator');
const { validateLegibilityAndProminence } = require('./validators/legibilityValidator');

const evaluateInspectionCompliance = async (inspection, product = null) => {
  // 1. Gather all OCR tokens and extracted declarations
  const allTokens = [];
  let totalConfidence = 0.0;

  for (const img of inspection.images || []) {
    for (const t of img.ocrTokens || []) {
      allTokens.push(t);
      totalConfidence += t.confidence || 0.85;
    }
  }

  const avgConfidence = allTokens.length > 0
    ? totalConfidence / allTokens.length
    : 0.85;

  const declarations = inspection.extractedDeclarations || [];

  // 2. Fetch seeded rules catalog for ID linking
  const rules = await ComplianceRule.find({ isActive: true });
  const ruleMap = new Map();
  for (const r of rules) {
    ruleMap.set(r.ruleCode, r._id);
  }

  // 3. Execute all validators
  const rawFindings = [];

  // Rule 6(1)(a): Manufacturer / Packer Address
  rawFindings.push(validateManufacturer(declarations, allTokens, avgConfidence));

  // Rule 6(1)(aa): Country of Origin
  rawFindings.push(validateCountryOfOrigin(declarations, allTokens, avgConfidence));

  // Rule 6(1)(b): Generic Commodity Name
  rawFindings.push(validateCommodityName(product, allTokens, avgConfidence));

  // Rule 6(1)(c) & Rules 12, 13: Net Quantity & Standard SI Units
  const qtyFindings = validateNetQuantity(declarations, allTokens, avgConfidence);
  rawFindings.push(...qtyFindings);

  // Rule 6(1)(d): Month & Year of Manufacture
  rawFindings.push(validateDateOfManufacture(declarations, allTokens, avgConfidence));

  // Rule 6(1)(e): Maximum Retail Price (MRP)
  rawFindings.push(validateMRP(declarations, allTokens, avgConfidence));

  // Rule 6(1)(f): Unit Sale Price (USP)
  rawFindings.push(validateUnitSalePrice(declarations, allTokens, avgConfidence));

  // Rule 6(1)(n): Consumer Care Cell
  rawFindings.push(validateConsumerCare(declarations, allTokens, avgConfidence));

  // Rule 9: Prominence, Background Contrast & Legibility
  rawFindings.push(validateLegibilityAndProminence(inspection.images, allTokens, avgConfidence));

  // 4. Attach MongoDB ruleId and format findings
  const findings = rawFindings.map((f) => ({
    ruleId: ruleMap.get(f.ruleCode) || null,
    ruleCode: f.ruleCode,
    fieldName: f.fieldName,
    status: f.status,
    detectedEvidence: f.detectedEvidence,
    expectedFormat: f.expectedFormat,
    confidenceScore: round(f.confidenceScore || 0.85, 3),
    explanation: f.explanation,
    legalCitation: f.legalCitation,
    manualReviewRecommendation: f.manualReviewRecommendation || null,
  }));

  // 5. Calculate Tri-State Decision Outcome
  let overallStatus = 'COMPLIANT';
  const hasFailures = findings.some((f) => f.status === 'FAIL');
  const hasManualReview = findings.some((f) => f.status === 'REQUIRES_MANUAL_REVIEW');

  if (hasFailures) {
    overallStatus = 'POTENTIALLY_NON_COMPLIANT';
  } else if (hasManualReview) {
    overallStatus = 'REQUIRES_MANUAL_REVIEW';
  } else {
    overallStatus = 'COMPLIANT';
  }

  // Calculate compliance score (percentage of passing rules)
  const passCount = findings.filter((f) => f.status === 'PASS' || f.status === 'EXEMPTED').length;
  const overallScore = round((passCount / findings.length) * 100, 1);

  // 6. Persist into inspection document
  inspection.findings = findings;
  inspection.status = overallStatus;
  inspection.overallScore = overallScore;

  await inspection.save();

  return {
    inspection_id: inspection._id.toString(),
    inspection_number: inspection.inspectionNumber,
    overall_status: overallStatus,
    overall_score: overallScore,
    total_rules_evaluated: findings.length,
    passed_count: passCount,
    failed_count: findings.filter((f) => f.status === 'FAIL').length,
    manual_review_count: findings.filter((f) => f.status === 'REQUIRES_MANUAL_REVIEW').length,
    findings: inspection.toJSON().findings,
  };
};

const round = (val, dec = 2) => {
  return Number(Math.round(val + 'e' + dec) + 'e-' + dec);
};

module.exports = { evaluateInspectionCompliance };
