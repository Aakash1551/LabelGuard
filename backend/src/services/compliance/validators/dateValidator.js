/**
 * Validator for Rule 6(1)(d) of PCR 2011:
 * Month and year of manufacture, packing, or import.
 */

const RULE_CODE = 'PCR-R06-1-D';
const LEGAL_CITATION = 'The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(d) (Amended 2021)';

const validateDateOfManufacture = (extractedDeclarations, ocrTokens, avgConfidence) => {
  const dateDecl = extractedDeclarations.find(
    (d) =>
      d.fieldType === 'MFG_DATE' ||
      d.field_type === 'MFG_DATE' ||
      d.fieldType === 'PACKED_DATE' ||
      d.field_type === 'PACKED_DATE'
  );

  const expectedFormat = 'Month and year of manufacture or pre-packing declared clearly (e.g. MM/YYYY, MM/YY, or Month Year).';

  if (!dateDecl) {
    return {
      ruleCode: RULE_CODE,
      fieldName: 'MFG_DATE',
      status: 'REQUIRES_MANUAL_REVIEW',
      detectedEvidence: 'None detected in OCR stream.',
      expectedFormat,
      confidenceScore: avgConfidence || 0.0,
      explanation: 'Date of manufacture/packing was not detected in OCR text stream. Missing OCR evidence alone does not establish a statutory breach; physical inspection of batch coding / crimp / gusset required.',
      legalCitation: LEGAL_CITATION,
      manualReviewRecommendation: 'Verify batch coding / manufacturing date stamp on crimp or gusset.',
    };
  }

  const parsed = dateDecl.parsedValue || dateDecl.parsed_value || {};
  const rawText = dateDecl.rawText || dateDecl.raw_text || '';
  const confidence = dateDecl.confidence || 0.88;
  const month = parsed.month;
  const year = parsed.year;

  if (month && year && month >= 1 && month <= 12 && year >= 2000 && year <= 2040) {
    return {
      ruleCode: RULE_CODE,
      fieldName: 'MFG_DATE',
      status: 'PASS',
      detectedEvidence: rawText,
      expectedFormat,
      confidenceScore: confidence,
      explanation: `Complies with Rule 6(1)(d). Declared ${parsed.date_type || 'Manufacturing/Packing Date'}: ${parsed.formatted || `${month}/${year}`}.`,
      legalCitation: LEGAL_CITATION,
      manualReviewRecommendation: null,
    };
  } else {
    return {
      ruleCode: RULE_CODE,
      fieldName: 'MFG_DATE',
      status: 'REQUIRES_MANUAL_REVIEW',
      detectedEvidence: rawText,
      expectedFormat,
      confidenceScore: confidence,
      explanation: 'Date text detected, but month/year components could not be validated unambiguously without manual confirmation.',
      legalCitation: LEGAL_CITATION,
      manualReviewRecommendation: 'Confirm date formatting on stamped label.',
    };
  }
};

module.exports = { validateDateOfManufacture, RULE_CODE, LEGAL_CITATION };
