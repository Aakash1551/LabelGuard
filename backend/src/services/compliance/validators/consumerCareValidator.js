/**
 * Validator for Rule 6(1)(n) of PCR 2011:
 * Consumer Care details (Telephone number and E-mail address of grievance officer).
 */

const RULE_CODE = 'PCR-R06-1-N';
const LEGAL_CITATION = 'The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(n) & Sub-rule (10)';

const validateConsumerCare = (extractedDeclarations, ocrTokens, avgConfidence) => {
  const careDecl = extractedDeclarations.find(
    (d) => d.fieldType === 'CONSUMER_CARE' || d.field_type === 'CONSUMER_CARE'
  );

  const expectedFormat = 'Consumer Care Cell details including telephone number (toll-free/STD/mobile) and e-mail address for consumer complaints.';

  if (!careDecl) {
    if (avgConfidence < 0.72) {
      return {
        ruleCode: RULE_CODE,
        fieldName: 'CONSUMER_CARE',
        status: 'REQUIRES_MANUAL_REVIEW',
        detectedEvidence: 'None detected in OCR stream.',
        expectedFormat,
        confidenceScore: avgConfidence,
        explanation: 'Consumer care cell details not detected, but label OCR confidence is below the verification threshold. Manual check required.',
        legalCitation: LEGAL_CITATION,
        manualReviewRecommendation: 'Inspect packaging back panel for consumer care helpline and email.',
      };
    } else {
      return {
        ruleCode: RULE_CODE,
        fieldName: 'CONSUMER_CARE',
        status: 'FAIL',
        detectedEvidence: 'Missing across all legible packaging panels.',
        expectedFormat,
        confidenceScore: avgConfidence,
        explanation: 'Mandatory consumer care telephone and e-mail address not found, violating Rule 6(1)(n).',
        legalCitation: LEGAL_CITATION,
        manualReviewRecommendation: 'Issue non-compliance notice under Rule 6(1)(n).',
      };
    }
  }

  const parsed = careDecl.parsedValue || careDecl.parsed_value || {};
  const rawText = careDecl.rawText || careDecl.raw_text || '';
  const confidence = careDecl.confidence || 0.88;
  const hasPhone = Boolean(parsed.phone || parsed.has_phone);
  const hasEmail = Boolean(parsed.email || parsed.has_email);

  if (hasPhone && hasEmail) {
    return {
      ruleCode: RULE_CODE,
      fieldName: 'CONSUMER_CARE',
      status: 'PASS',
      detectedEvidence: rawText,
      expectedFormat,
      confidenceScore: confidence,
      explanation: `Complies with Rule 6(1)(n). Consumer care helpline (${parsed.phone}) and email (${parsed.email}) declared.`,
      legalCitation: LEGAL_CITATION,
      manualReviewRecommendation: null,
    };
  } else if (hasPhone || hasEmail) {
    const present = hasPhone ? `phone (${parsed.phone})` : `email (${parsed.email})`;
    const missing = hasPhone ? 'email address' : 'telephone number';
    return {
      ruleCode: RULE_CODE,
      fieldName: 'CONSUMER_CARE',
      status: 'REQUIRES_MANUAL_REVIEW',
      detectedEvidence: rawText,
      expectedFormat,
      confidenceScore: confidence,
      explanation: `Partial compliance: Consumer care ${present} detected, but ${missing} could not be confirmed automatically. Rule 6(1)(n) requires both.`,
      legalCitation: LEGAL_CITATION,
      manualReviewRecommendation: `Verify physical package to check if ${missing} is printed elsewhere.`,
    };
  } else {
    return {
      ruleCode: RULE_CODE,
      fieldName: 'CONSUMER_CARE',
      status: 'REQUIRES_MANUAL_REVIEW',
      detectedEvidence: rawText,
      expectedFormat,
      confidenceScore: confidence,
      explanation: 'Consumer care anchor detected, but specific phone number or email could not be parsed unambiguously.',
      legalCitation: LEGAL_CITATION,
      manualReviewRecommendation: 'Manually inspect consumer care contact block.',
    };
  }
};

module.exports = { validateConsumerCare, RULE_CODE, LEGAL_CITATION };
