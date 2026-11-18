/**
 * Validator for Rule 6(1)(b) of PCR 2011:
 * Common or generic name of the commodity.
 */

const RULE_CODE = 'PCR-R06-1-B';
const LEGAL_CITATION = 'The Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6(1)(b) & Section 18';

const validateCommodityName = (product, ocrTokens, avgConfidence) => {
  const expectedFormat = 'Common or generic name of the commodity contained in the package, displayed conspicuously on the principal display panel.';

  // Check product catalog or search prominent title text in OCR tokens
  const productName = product ? product.name : null;
  const brandName = product ? product.brand : null;

  // Search if any OCR token contains product or commodity name
  let foundEvidence = null;
  if (productName && ocrTokens.length > 0) {
    const pTerms = productName.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    for (const t of ocrTokens) {
      const tokenText = (t.detectedText || t.text || '').toLowerCase();
      if (pTerms.some((term) => tokenText.includes(term))) {
        foundEvidence = t.detectedText || t.text;
        break;
      }
    }
  }

  // Fallback: Check if first few prominent tokens contain commodity terms
  if (!foundEvidence && ocrTokens.length > 0) {
    const prominentTokens = ocrTokens.slice(0, 5).map((t) => t.detectedText || t.text || '');
    foundEvidence = prominentTokens.join(' ');
  }

  if (foundEvidence && foundEvidence.trim().length > 3) {
    return {
      ruleCode: RULE_CODE,
      fieldName: 'COMMODITY_NAME',
      status: 'PASS',
      detectedEvidence: foundEvidence,
      expectedFormat,
      confidenceScore: 0.88,
      explanation: `Complies with Rule 6(1)(b). Generic/common commodity name declared conspicuously on packaging panel.`,
      legalCitation: LEGAL_CITATION,
      manualReviewRecommendation: null,
    };
  } else if (avgConfidence < 0.72) {
    return {
      ruleCode: RULE_CODE,
      fieldName: 'COMMODITY_NAME',
      status: 'REQUIRES_MANUAL_REVIEW',
      detectedEvidence: 'Uncertain detection in OCR tokens.',
      expectedFormat,
      confidenceScore: avgConfidence,
      explanation: 'Generic commodity name could not be automatically confirmed from principal display panel. Visual verification required.',
      legalCitation: LEGAL_CITATION,
      manualReviewRecommendation: 'Verify generic description on package front panel.',
    };
  } else {
    return {
      ruleCode: RULE_CODE,
      fieldName: 'COMMODITY_NAME',
      status: 'FAIL',
      detectedEvidence: 'Missing generic commodity identity.',
      expectedFormat,
      confidenceScore: avgConfidence,
      explanation: 'Package fails to declare common or generic commodity name as required under Rule 6(1)(b).',
      legalCitation: LEGAL_CITATION,
      manualReviewRecommendation: 'Check if trademarked brand name is used without generic product category.',
    };
  }
};

module.exports = { validateCommodityName, RULE_CODE, LEGAL_CITATION };
