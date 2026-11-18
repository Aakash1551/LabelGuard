/**
 * Validator for Net Quantity declarations under:
 * - Rule 6(1)(c): Net quantity declaration in standard units of weight, measure, or count.
 * - Rule 12 & 13: Standard metric SI symbols and syntax (prohibiting non-standard symbols like gms, kilos).
 */

const RULE_CODE_QUANTITY = 'PCR-R06-1-C';
const RULE_CODE_UNIT = 'PCR-R06-1-C-UNIT';
const LEGAL_CITATION_QUANTITY = 'The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(c) & Section 11';
const LEGAL_CITATION_UNIT = 'The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 12 & Rule 13 (Second Schedule)';

const validateNetQuantity = (extractedDeclarations, ocrTokens, avgConfidence) => {
  const qtyDecl = extractedDeclarations.find(
    (d) => d.fieldType === 'NET_QUANTITY' || d.field_type === 'NET_QUANTITY'
  );

  const expectedFormatQuantity = 'Net quantity declared in terms of standard unit of weight (g, kg), measure (ml, l), length (m, cm), or number (N, U).';
  const expectedFormatUnit = "Metric SI unit symbol strictly adhering to 'g' or 'kg' for mass, 'ml', 'mL', or 'l', 'L' for volume. Non-standard abbreviations such as 'gms', 'gm', 'kilos', 'ltrs' are strictly prohibited.";

  if (!qtyDecl) {
    if (avgConfidence < 0.72) {
      return [
        {
          ruleCode: RULE_CODE_QUANTITY,
          fieldName: 'NET_QUANTITY',
          status: 'REQUIRES_MANUAL_REVIEW',
          detectedEvidence: 'None detected in OCR stream.',
          expectedFormat: expectedFormatQuantity,
          confidenceScore: avgConfidence,
          explanation: 'Net quantity declaration was not detected, but image OCR confidence is below the threshold for definitive absence. Inspector verification required.',
          legalCitation: LEGAL_CITATION_QUANTITY,
          manualReviewRecommendation: 'Inspect packaging panels for net quantity stamp or declaration.',
        },
        {
          ruleCode: RULE_CODE_UNIT,
          fieldName: 'NET_QUANTITY_UNIT',
          status: 'REQUIRES_MANUAL_REVIEW',
          detectedEvidence: 'Unit undetermined.',
          expectedFormat: expectedFormatUnit,
          confidenceScore: avgConfidence,
          explanation: 'Standard metric unit could not be verified because net quantity was not detected in OCR text.',
          legalCitation: LEGAL_CITATION_UNIT,
          manualReviewRecommendation: 'Verify unit symbol when reviewing net quantity.',
        },
      ];
    } else {
      return [
        {
          ruleCode: RULE_CODE_QUANTITY,
          fieldName: 'NET_QUANTITY',
          status: 'FAIL',
          detectedEvidence: 'Missing across all legible packaging panels.',
          expectedFormat: expectedFormatQuantity,
          confidenceScore: avgConfidence,
          explanation: 'Mandatory declaration of net quantity missing despite legible label text, violating Rule 6(1)(c).',
          legalCitation: LEGAL_CITATION_QUANTITY,
          manualReviewRecommendation: 'Issue non-compliance query for omitted net weight/volume.',
        },
        {
          ruleCode: RULE_CODE_UNIT,
          fieldName: 'NET_QUANTITY_UNIT',
          status: 'FAIL',
          detectedEvidence: 'No unit declared.',
          expectedFormat: expectedFormatUnit,
          confidenceScore: avgConfidence,
          explanation: 'No metric unit symbol found on package.',
          legalCitation: LEGAL_CITATION_UNIT,
          manualReviewRecommendation: null,
        },
      ];
    }
  }

  const parsed = qtyDecl.parsedValue || qtyDecl.parsed_value || {};
  const rawText = qtyDecl.rawText || qtyDecl.raw_text || '';
  const confidence = qtyDecl.confidence || 0.88;
  const rawUnit = parsed.unit || '';
  const standardUnit = parsed.standard_unit || parsed.standardUnit || '';
  const isStandard = parsed.is_standard_unit !== undefined ? parsed.is_standard_unit : (parsed.isStandardUnit !== undefined ? parsed.isStandardUnit : true);

  // 1. Evaluate Net Quantity Presence (Rule 6(1)(c))
  const quantityFinding = {
    ruleCode: RULE_CODE_QUANTITY,
    fieldName: 'NET_QUANTITY',
    status: 'PASS',
    detectedEvidence: rawText,
    expectedFormat: expectedFormatQuantity,
    confidenceScore: confidence,
    explanation: `Complies with Rule 6(1)(c). Declared net quantity: ${parsed.value} ${rawUnit}.`,
    legalCitation: LEGAL_CITATION_QUANTITY,
    manualReviewRecommendation: null,
  };

  // 2. Evaluate Unit Symbol Syntax (Rule 12 & Rule 13)
  let unitFinding;
  if (isStandard) {
    unitFinding = {
      ruleCode: RULE_CODE_UNIT,
      fieldName: 'NET_QUANTITY_UNIT',
      status: 'PASS',
      detectedEvidence: rawUnit,
      expectedFormat: expectedFormatUnit,
      confidenceScore: confidence,
      explanation: `Complies with Rule 12 & 13. Unit symbol '${rawUnit}' is an approved metric SI standard.`,
      legalCitation: LEGAL_CITATION_UNIT,
      manualReviewRecommendation: null,
    };
  } else {
    unitFinding = {
      ruleCode: RULE_CODE_UNIT,
      fieldName: 'NET_QUANTITY_UNIT',
      status: 'FAIL',
      detectedEvidence: rawUnit,
      expectedFormat: expectedFormatUnit,
      confidenceScore: confidence,
      explanation: `Statutory violation of Rule 12 & 13. Non-standard unit symbol '${rawUnit}' used instead of approved metric symbol '${standardUnit}'. Abbreviations such as 'gms', 'gm', 'kilos', 'ltrs' are prohibited.`,
      legalCitation: LEGAL_CITATION_UNIT,
      manualReviewRecommendation: `Require manufacturer to correct packaging artwork from '${rawUnit}' to '${standardUnit}'.`,
    };
  }

  return [quantityFinding, unitFinding];
};

module.exports = {
  validateNetQuantity,
  RULE_CODE_QUANTITY,
  RULE_CODE_UNIT,
  LEGAL_CITATION_QUANTITY,
  LEGAL_CITATION_UNIT,
};
