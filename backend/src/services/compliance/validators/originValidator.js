/**
 * Validator for Rule 6(1)(aa) of PCR 2011:
 * Country of Origin / Country of Manufacture declaration.
 */

const RULE_CODE = 'PCR-R06-1-AA';
const LEGAL_CITATION = 'The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(aa) (Amended 2017)';

const validateCountryOfOrigin = (extractedDeclarations, ocrTokens, avgConfidence) => {
  const originDecl = extractedDeclarations.find(
    (d) => d.fieldType === 'COUNTRY_OF_ORIGIN' || d.field_type === 'COUNTRY_OF_ORIGIN'
  );

  const expectedFormat = "Unambiguous declaration of the country of origin or manufacture (e.g. 'Country of Origin: India', 'Made in India').";

  if (!originDecl) {
    if (avgConfidence < 0.72) {
      return {
        ruleCode: RULE_CODE,
        fieldName: 'COUNTRY_OF_ORIGIN',
        status: 'REQUIRES_MANUAL_REVIEW',
        detectedEvidence: 'None detected in OCR stream.',
        expectedFormat,
        confidenceScore: avgConfidence,
        explanation: 'Country of origin was not detected, but label OCR confidence is below the threshold for definitive absence. Inspector review required.',
        legalCitation: LEGAL_CITATION,
        manualReviewRecommendation: 'Inspect packaging panels for Country of Origin mark.',
      };
    } else {
      return {
        ruleCode: RULE_CODE,
        fieldName: 'COUNTRY_OF_ORIGIN',
        status: 'FAIL',
        detectedEvidence: 'Missing across legible label text.',
        expectedFormat,
        confidenceScore: avgConfidence,
        explanation: 'Mandatory country of origin declaration not found on package, violating Rule 6(1)(aa).',
        legalCitation: LEGAL_CITATION,
        manualReviewRecommendation: 'Verify whether product is imported or exempted under specific trade notifications.',
      };
    }
  }

  const parsed = originDecl.parsedValue || originDecl.parsed_value || {};
  const country = parsed.country || '';
  const rawText = originDecl.rawText || originDecl.raw_text || '';
  const confidence = originDecl.confidence || 0.85;

  if (country) {
    return {
      ruleCode: RULE_CODE,
      fieldName: 'COUNTRY_OF_ORIGIN',
      status: 'PASS',
      detectedEvidence: rawText,
      expectedFormat,
      confidenceScore: confidence,
      explanation: `Complies with Rule 6(1)(aa). Country of Origin clearly declared as '${country}'.`,
      legalCitation: LEGAL_CITATION,
      manualReviewRecommendation: null,
    };
  } else {
    return {
      ruleCode: RULE_CODE,
      fieldName: 'COUNTRY_OF_ORIGIN',
      status: 'REQUIRES_MANUAL_REVIEW',
      detectedEvidence: rawText,
      expectedFormat,
      confidenceScore: confidence,
      explanation: 'Country of origin phrase detected, but country name could not be parsed unambiguously.',
      legalCitation: LEGAL_CITATION,
      manualReviewRecommendation: 'Inspect origin statement manually to confirm country name.',
    };
  }
};

module.exports = { validateCountryOfOrigin, RULE_CODE, LEGAL_CITATION };
