const ComplianceRule = require('../models/ComplianceRule');

// @desc    List legal metrology compliance rules
// @route   GET /api/v1/rules
const listRules = async (req, res) => {
  try {
    const { category, is_active } = req.query;
    const query = {};

    if (category) query.category = category.toUpperCase();
    if (is_active !== undefined) query.isActive = is_active === 'true' || is_active === true;

    const rules = await ComplianceRule.find(query).sort({ ruleCode: 1 });

    return res.status(200).json(
      rules.map((r) => ({
        id: r._id.toString(),
        rule_code: r.ruleCode,
        category: r.category,
        title: r.title,
        description: r.description,
        act_reference: r.actReference,
        rule_reference: r.ruleReference,
        severity: r.severity,
        is_active: r.isActive,
        version: r.version,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
      }))
    );
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
};

// @desc    Get specific rule by ruleCode
// @route   GET /api/v1/rules/:code
const getRuleByCode = async (req, res) => {
  try {
    const rule = await ComplianceRule.findOne({
      ruleCode: req.params.code.toUpperCase(),
    });

    if (!rule) {
      return res.status(404).json({
        detail: `Regulatory rule '${req.params.code}' not found in registry`,
      });
    }

    return res.status(200).json({
      id: rule._id.toString(),
      rule_code: rule.ruleCode,
      category: rule.category,
      title: rule.title,
      description: rule.description,
      act_reference: rule.actReference,
      rule_reference: rule.ruleReference,
      severity: rule.severity,
      is_active: rule.isActive,
      version: rule.version,
      created_at: rule.createdAt,
      updated_at: rule.updatedAt,
    });
  } catch (err) {
    return res.status(500).json({ detail: err.message });
  }
};

module.exports = { listRules, getRuleByCode };
