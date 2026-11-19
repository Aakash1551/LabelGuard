/**
 * Validator for Rule 6(1)(a) of PCR 2011:
 * Name and complete physical address of the manufacturer, packer, or importer.
 */

const RULE_CODE = 'PCR-R06-1-A';
const LEGAL_CITATION = 'The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(a) & The Legal Metrology Act, 2009 (Section 18)';

const validateManufacturer = (extractedDeclarations, ocrTokens, avgConfidence) => {
  const mfgDecl = extractedDeclarations.find(
    (d) => d.fieldType === 'MANUFACTURER_ADDRESS' || d.field_type === 'MANUFACTURER_ADDRESS'
  );

  const expectedFormat = 'Complete name and physical address including city/state and 6-digit postal PIN code with role qualifier (e.g. Manufactured by, Packed by, or Imported by).';

  if (!mfgDecl) {
    return {
      ruleCode: RULE_CODE,
      fieldName: 'MANUFACTURER_ADDRESS',
      status: 'REQUIRES_MANUAL_REVIEW',
      detectedEvidence: 'None detected in OCR stream.',
      expectedFormat,
      confidenceScore: avgConfidence || 0.0,
      explanation: 'Manufacturer/packer declaration was not detected in OCR stream. Missing OCR evidence alone does not establish a statutory breach; physical packaging verification required.',
      legalCitation: LEGAL_CITATION,
      manualReviewRecommendation: 'Verify physical packaging panel for printed manufacturer or packer address.',
    };
  }

  const parsed = mfgDecl.parsedValue || mfgDecl.parsed_value || {};
  const hasPinCode = parsed.has_pincode || parsed.hasPincode || Boolean(parsed.pincode);
  const rawText = mfgDecl.rawText || mfgDecl.raw_text || '';
  const confidence = mfgDecl.confidence || 0.85;

  if (hasPinCode) {
    return {
      ruleCode: RULE_CODE,
      fieldName: 'MANUFACTURER_ADDRESS',
      status: 'PASS',
      detectedEvidence: rawText,
      expectedFormat,
      confidenceScore: confidence,
      explanation: `Complies with Rule 6(1)(a). Declared ${parsed.role || 'Manufacturer'} with valid postal PIN code (${parsed.pincode}).`,
      legalCitation: LEGAL_CITATION,
      manualReviewRecommendation: null,
    };
  } else {
    return {
      ruleCode: RULE_CODE,
      fieldName: 'MANUFACTURER_ADDRESS',
      status: 'FAIL',
      detectedEvidence: rawText,
      expectedFormat,
      confidenceScore: confidence,
      explanation: 'Manufacturer name detected, but incomplete address: missing statutory 6-digit postal PIN code as required under Rule 6(1)(a).',
      legalCitation: LEGAL_CITATION,
      manualReviewRecommendation: 'Confirm if full address with postal district is present elsewhere on label.',
    };
  }
};

module.exports = { validateManufacturer, RULE_CODE, LEGAL_CITATION };
