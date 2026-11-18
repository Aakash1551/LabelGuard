const Inspection = require('../models/Inspection');
const Product = require('../models/Product');
const { evaluateInspectionCompliance } = require('../services/compliance/decisionEngine');

// @desc    Evaluate statutory compliance for an inspection
// @route   POST /api/v1/inspections/:id/evaluate
const evaluateCompliance = async (req, res) => {
  try {
    const inspection = await Inspection.findById(req.params.id);
    if (!inspection) {
      return res.status(404).json({ detail: `Inspection '${req.params.id}' not found.` });
    }

    let product = null;
    if (inspection.productId) {
      product = await Product.findById(inspection.productId);
    }

    const evaluationResult = await evaluateInspectionCompliance(inspection, product);
    return res.status(200).json(evaluationResult);
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
};

// @desc    Get overall compliance evaluation summary
// @route   GET /api/v1/inspections/:id/compliance
const getComplianceSummary = async (req, res) => {
  try {
    const inspection = await Inspection.findById(req.params.id);
    if (!inspection) {
      return res.status(404).json({ detail: `Inspection '${req.params.id}' not found.` });
    }

    const json = inspection.toJSON();
    const findings = json.findings || [];

    const passedCount = findings.filter((f) => f.status === 'PASS' || f.status === 'EXEMPTED').length;
    const failedCount = findings.filter((f) => f.status === 'FAIL').length;
    const manualReviewCount = findings.filter((f) => f.status === 'REQUIRES_MANUAL_REVIEW').length;

    return res.status(200).json({
      inspection_id: json.id,
      inspection_number: json.inspection_number,
      overall_status: json.status,
      overall_score: json.overall_score,
      is_manual_override: json.is_manual_override,
      manual_override_reason: inspection.manualOverrideReason,
      total_rules_evaluated: findings.length,
      passed_count: passedCount,
      failed_count: failedCount,
      manual_review_count: manualReviewCount,
      findings,
    });
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
};

// @desc    Get detailed compliance rule findings
// @route   GET /api/v1/inspections/:id/findings
const getInspectionFindings = async (req, res) => {
  try {
    const inspection = await Inspection.findById(req.params.id);
    if (!inspection) {
      return res.status(404).json({ detail: `Inspection '${req.params.id}' not found.` });
    }

    const json = inspection.toJSON();
    return res.status(200).json(json.findings);
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
};

// @desc    Audited manual review override by inspector
// @route   PUT /api/v1/inspections/:id/override
const overrideCompliance = async (req, res) => {
  try {
    const { override_status, reason } = req.body;
    if (!override_status || !reason) {
      return res.status(400).json({ detail: 'Both override_status and reason are required for an audited manual override.' });
    }

    const validStatuses = ['COMPLIANT', 'POTENTIALLY_NON_COMPLIANT', 'REQUIRES_MANUAL_REVIEW'];
    if (!validStatuses.includes(override_status)) {
      return res.status(400).json({ detail: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const inspection = await Inspection.findById(req.params.id);
    if (!inspection) {
      return res.status(404).json({ detail: `Inspection '${req.params.id}' not found.` });
    }

    inspection.status = override_status;
    inspection.isManualOverride = true;
    inspection.manualOverrideById = req.user._id;
    inspection.manualOverrideReason = reason;

    await inspection.save();
    return res.status(200).json(inspection.toJSON());
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
};

module.exports = {
  evaluateCompliance,
  getComplianceSummary,
  getInspectionFindings,
  overrideCompliance,
};
