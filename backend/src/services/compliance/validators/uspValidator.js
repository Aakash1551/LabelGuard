/**
 * Validator for Rule 6(1)(f) / Rule 6(1)(e) (Amended 2021/2022) of PCR 2011:
 * Unit Sale Price (USP) declaration.
 */

const RULE_CODE = 'PCR-R06-1-E-USP';
const LEGAL_CITATION = 'The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(f) & Rule 6(1)(e) (Amended 2021/2022)';

const validateUnitSalePrice = (extractedDeclarations, ocrTokens, avgConfidence) => {
  const uspDecl = extractedDeclarations.find(
    (d) => d.fieldType === 'UNIT_SALE_PRICE' || d.field_type === 'UNIT_SALE_PRICE'
  );

  const qtyDecl = extractedDeclarations.find(
    (d) => d.fieldType === 'NET_QUANTITY' || d.field_type === 'NET_QUANTITY'
  );

  const expectedFormat = 'Mandatory Unit Sale Price in Rs. per g/ml (for packages <= 1 kg/1 L) or Rs. per kg/L (for packages > 1 kg/1 L), rounded to nearest two decimal places.';

  // Determine if package exceeds 1kg/1L threshold or is multi-unit
  let isMandatoryThresholdExceeded = false;
  if (qtyDecl) {
    const qParsed = qtyDecl.parsedValue || qtyDecl.parsed_value || {};
    const val = qParsed.value || 0;
    const stdUnit = (qParsed.standard_unit || qParsed.unit || '').toLowerCase();
    if ((stdUnit === 'kg' && val > 1) || (stdUnit === 'l' && val > 1) || (stdUnit === 'g' && val > 1000) || (stdUnit === 'ml' && val > 1000)) {
      isMandatoryThresholdExceeded = true;
    }
  }

  if (uspDecl) {
    const parsed = uspDecl.parsedValue || uspDecl.parsed_value || {};
    const rawText = uspDecl.rawText || uspDecl.raw_text || '';
    const confidence = uspDecl.confidence || 0.88;
    return {
      ruleCode: RULE_CODE,
      fieldName: 'UNIT_SALE_PRICE',
      status: 'PASS',
      detectedEvidence: rawText,
      expectedFormat,
      confidenceScore: confidence,
      explanation: `Complies with Rule 6(1)(f). Unit Sale Price clearly declared: Rs. ${parsed.price} / ${parsed.unit}.`,
      legalCitation: LEGAL_CITATION,
      manualReviewRecommendation: null,
    };
  }

  // If not declared:
  if (isMandatoryThresholdExceeded) {
    if (avgConfidence < 0.72) {
      return {
        ruleCode: RULE_CODE,
        fieldName: 'UNIT_SALE_PRICE',
        status: 'REQUIRES_MANUAL_REVIEW',
        detectedEvidence: 'None detected.',
        expectedFormat,
        confidenceScore: avgConfidence,
        explanation: 'Package quantity exceeds 1 kg/1 L threshold making Unit Sale Price mandatory, but OCR confidence is below verification threshold. Manual check required.',
        legalCitation: LEGAL_CITATION,
        manualReviewRecommendation: 'Verify package pricing label for Unit Sale Price print.',
      };
    } else {
      return {
        ruleCode: RULE_CODE,
        fieldName: 'UNIT_SALE_PRICE',
        status: 'FAIL',
        detectedEvidence: 'Missing on package > 1 kg / 1 L.',
        expectedFormat,
        confidenceScore: avgConfidence,
        explanation: 'Package net quantity exceeds 1 kg/1 L threshold, but Unit Sale Price is omitted, violating Rule 6(1)(f).',
        legalCitation: LEGAL_CITATION,
        manualReviewRecommendation: 'Issue non-compliance query for missing statutory USP on bulk package.',
      };
    }
  }

  // For smaller packages (<= 1kg / 1L), USP is optional or conditionally exempted
  return {
    ruleCode: RULE_CODE,
    fieldName: 'UNIT_SALE_PRICE',
    status: 'EXEMPTED',
    detectedEvidence: 'Not declared (exempted for <= 1kg / 1L package).',
    expectedFormat,
    confidenceScore: 0.95,
    explanation: 'Unit Sale Price is optional for single-unit commodities of 1 kg/1 L or less under Rule 6(1)(e) proviso.',
    legalCitation: LEGAL_CITATION,
    manualReviewRecommendation: null,
  };
};

module.exports = { validateUnitSalePrice, RULE_CODE, LEGAL_CITATION };
