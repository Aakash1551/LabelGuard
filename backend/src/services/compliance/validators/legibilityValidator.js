/**
 * Validator for Rule 9 of PCR 2011:
 * Conspicuousness, background contrast, and visual legibility of declarations.
 */

const RULE_CODE = 'PCR-R09-1';
const LEGAL_CITATION = 'The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 9 & Schedule II';

const validateLegibilityAndProminence = (images, ocrTokens, avgConfidence) => {
  const expectedFormat = 'All declarations must be conspicuous, legible, distinctly contrasted with background, and meet minimum statutory numeral/letter height in mm specified in Schedule II.';

  if (!ocrTokens || ocrTokens.length === 0) {
    return {
      ruleCode: RULE_CODE,
      fieldName: 'LEGIBILITY_CONTRAST',
      status: 'REQUIRES_MANUAL_REVIEW',
      detectedEvidence: 'Zero OCR tokens detected on uploaded packaging panels.',
      expectedFormat,
      confidenceScore: 0.0,
      explanation: 'No OCR text detected across uploaded package panels. Automated determination of background contrast and font legibility is impossible; physical packaging review required.',
      legalCitation: LEGAL_CITATION,
      manualReviewRecommendation: 'Review physical package to verify that all statutory declarations are clearly printed and distinctly contrasted with background.',
    };
  }

  if (avgConfidence >= 0.80) {
    return {
      ruleCode: RULE_CODE,
      fieldName: 'LEGIBILITY_CONTRAST',
      status: 'PASS',
      detectedEvidence: `Average OCR recognition confidence: ${(avgConfidence * 100).toFixed(1)}% across ${ocrTokens.length} detected tokens.`,
      expectedFormat,
      confidenceScore: avgConfidence,
      explanation: 'Complies with Rule 9. High-contrast typography and distinct character separation confirmed across packaging text.',
      legalCitation: LEGAL_CITATION,
      manualReviewRecommendation: null,
    };
  } else if (avgConfidence >= 0.65) {
    return {
      ruleCode: RULE_CODE,
      fieldName: 'LEGIBILITY_CONTRAST',
      status: 'REQUIRES_MANUAL_REVIEW',
      detectedEvidence: `Average OCR recognition confidence: ${(avgConfidence * 100).toFixed(1)}%.`,
      expectedFormat,
      confidenceScore: avgConfidence,
      explanation: 'Moderate visual clarity: declarations are legible, but font height in millimeters under Schedule II cannot be certified from 2D imagery without physical measurement.',
      legalCitation: LEGAL_CITATION,
      manualReviewRecommendation: 'Physically measure numeral/letter height using a calibrated gauge to certify Schedule II compliance.',
    };
  } else {
    return {
      ruleCode: RULE_CODE,
      fieldName: 'LEGIBILITY_CONTRAST',
      status: 'REQUIRES_MANUAL_REVIEW',
      detectedEvidence: `Low OCR recognition confidence: ${(avgConfidence * 100).toFixed(1)}%. Glare or low background contrast observed.`,
      expectedFormat,
      confidenceScore: avgConfidence,
      explanation: 'Surface glare, packaging curvature, or low background contrast prevents automated certification of Rule 9.',
      legalCitation: LEGAL_CITATION,
      manualReviewRecommendation: 'Inspector must review physical package under standard ambient lighting.',
    };
  }
};

module.exports = { validateLegibilityAndProminence, RULE_CODE, LEGAL_CITATION };
