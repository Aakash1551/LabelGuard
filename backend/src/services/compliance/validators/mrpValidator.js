/**
 * Validator for Rule 6(1)(e) of PCR 2011:
 * Maximum Retail Price (MRP) and mandatory 'inclusive of all taxes' declaration.
 */

const RULE_CODE = 'PCR-R06-1-E';
const LEGAL_CITATION = 'The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(e) (Amended 2021/2022)';

const validateMRP = (extractedDeclarations, ocrTokens, avgConfidence) => {
  const mrpDecl = extractedDeclarations.find(
    (d) => d.fieldType === 'MRP' || d.field_type === 'MRP'
  );

  const expectedFormat = "Mandatory statutory format: 'Maximum or Max. Retail Price Rs. or ₹ .... inclusive of all taxes' or 'MRP Rs. / ₹ .... incl. of all taxes'.";

  if (!mrpDecl) {
    if (avgConfidence < 0.72) {
      return {
        ruleCode: RULE_CODE,
        fieldName: 'MAX_RETAIL_PRICE',
        status: 'REQUIRES_MANUAL_REVIEW',
        detectedEvidence: 'None detected in OCR stream.',
        expectedFormat,
        confidenceScore: avgConfidence,
        explanation: 'Maximum Retail Price declaration was not detected, but label OCR confidence is below statutory verification threshold. Visual inspection required.',
        legalCitation: LEGAL_CITATION,
        manualReviewRecommendation: 'Verify retail pricing panel for stamped or printed MRP.',
      };
    } else {
      return {
        ruleCode: RULE_CODE,
        fieldName: 'MAX_RETAIL_PRICE',
        status: 'FAIL',
        detectedEvidence: 'Missing across all legible packaging panels.',
        expectedFormat,
        confidenceScore: avgConfidence,
        explanation: 'Mandatory declaration of Maximum Retail Price (MRP) not found on package, violating Rule 6(1)(e).',
        legalCitation: LEGAL_CITATION,
        manualReviewRecommendation: 'Issue non-compliance notice under Section 36 for missing MRP.',
      };
    }
  }

  const parsed = mrpDecl.parsedValue || mrpDecl.parsed_value || {};
  const rawText = mrpDecl.rawText || mrpDecl.raw_text || '';
  const confidence = mrpDecl.confidence || 0.90;
  const amount = parsed.amount;
  const inclusiveTaxes = parsed.inclusive_of_taxes || parsed.inclusiveOfTaxes;

  if (amount && amount > 0) {
    if (inclusiveTaxes) {
      return {
        ruleCode: RULE_CODE,
        fieldName: 'MAX_RETAIL_PRICE',
        status: 'PASS',
        detectedEvidence: rawText,
        expectedFormat,
        confidenceScore: confidence,
        explanation: `Complies with Rule 6(1)(e). Declared MRP: Rs. ${amount.toFixed(2)} with mandatory 'inclusive of all taxes' statement.`,
        legalCitation: LEGAL_CITATION,
        manualReviewRecommendation: null,
      };
    } else {
      return {
        ruleCode: RULE_CODE,
        fieldName: 'MAX_RETAIL_PRICE',
        status: 'FAIL',
        detectedEvidence: rawText,
        expectedFormat,
        confidenceScore: confidence,
        explanation: `Statutory violation of Rule 6(1)(e). MRP declared as Rs. ${amount.toFixed(2)}, but omits the mandatory 'inclusive of all taxes' (or 'incl. of all taxes') qualification.`,
        legalCitation: LEGAL_CITATION,
        manualReviewRecommendation: "Verify whether 'incl. of taxes' is printed elsewhere on the price sticker.",
      };
    }
  } else {
    return {
      ruleCode: RULE_CODE,
      fieldName: 'MAX_RETAIL_PRICE',
      status: 'REQUIRES_MANUAL_REVIEW',
      detectedEvidence: rawText,
      expectedFormat,
      confidenceScore: confidence,
      explanation: 'MRP anchor detected, but numeric price value could not be reliably determined.',
      legalCitation: LEGAL_CITATION,
      manualReviewRecommendation: 'Examine price sticker to resolve printed retail amount.',
    };
  }
};

module.exports = { validateMRP, RULE_CODE, LEGAL_CITATION };
