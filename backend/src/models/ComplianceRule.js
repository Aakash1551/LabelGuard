const mongoose = require('mongoose');

const complianceRuleSchema = new mongoose.Schema(
  {
    ruleCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    actReference: {
      type: String,
      required: true,
    },
    ruleReference: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ['MANDATORY', 'CONDITIONAL', 'RECOMMENDATION'],
      default: 'MANDATORY',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    version: {
      type: String,
      default: '2011.amended',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        // Provide both snake_case and camelCase aliases for exact compatibility with existing API contracts
        ret.rule_code = ret.ruleCode;
        ret.act_reference = ret.actReference;
        ret.rule_reference = ret.ruleReference;
        ret.is_active = ret.isActive;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('ComplianceRule', complianceRuleSchema);
