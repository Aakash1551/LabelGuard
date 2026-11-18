import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Filter,
  Scale,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Info,
  CheckCircle2,
  Calendar,
  Layers,
  FileText
} from 'lucide-react';
import { listRules } from '../api/rules';

const CATEGORIES = [
  { id: 'ALL', label: 'All Categories' },
  { id: 'MANUFACTURER', label: 'Manufacturer & Packer' },
  { id: 'ORIGIN', label: 'Country of Origin' },
  { id: 'COMMODITY', label: 'Commodity Name' },
  { id: 'QUANTITY', label: 'Net Quantity & Units' },
  { id: 'DATE', label: 'Mfg / Packing Date' },
  { id: 'MRP', label: 'MRP & Unit Sale Price' },
  { id: 'CONSUMER_CARE', label: 'Consumer Care Cell' },
  { id: 'LEGIBILITY', label: 'Legibility & Contrast' },
];

export const RulesCatalog = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedRule, setSelectedRule] = useState(null);

  const fetchRules = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (selectedCategory !== 'ALL') {
        params.category = selectedCategory;
      }
      const data = await listRules(params);
      setRules(data);
    } catch (err) {
      console.error('Failed to load compliance rules:', err);
      setError(err.response?.data?.detail || 'Failed to connect to statutory rules registry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, [selectedCategory]);

  const filteredRules = rules.filter((r) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      r.rule_code?.toLowerCase().includes(q) ||
      r.title?.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.act_reference?.toLowerCase().includes(q) ||
      r.rule_reference?.toLowerCase().includes(q)
    );
  });

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'MANDATORY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Mandatory
          </span>
        );
      case 'CONDITIONAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Conditional
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Recommendation
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <Scale className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Statutory Rules Catalog</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Codified provisions of Legal Metrology Act, 2009 & Packaged Commodities Rules, 2011 (as amended).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-semibold text-indigo-800 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>PCR 2011 Registry: Active ({rules.length} Rules Enforced)</span>
          </div>
        </div>
      </div>

      {/* Legal Metrology Act Notice Banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3 text-xs text-blue-900">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-blue-950">Statutory Legal Framework (Legal Metrology Act, 2009 § 18):</p>
          <p className="text-blue-800 leading-relaxed">
            No person shall manufacture, pack, sell, distribute, deliver, offer, expose or possess for sale by wholesale or retail any pre-packaged commodity unless such package complies with the provisions of the Act and the Legal Metrology (Packaged Commodities) Rules, 2011. Every declaration verified by LabelGuard AI maps to these exact statutory codifications.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by rule code, title, legal reference, section..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Category Badges */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rules Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-pulse space-y-4">
              <div className="flex justify-between items-center">
                <div className="h-5 bg-slate-200 rounded w-28"></div>
                <div className="h-5 bg-slate-200 rounded w-20"></div>
              </div>
              <div className="h-6 bg-slate-200 rounded w-3/4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-slate-200 rounded w-full"></div>
                <div className="h-4 bg-slate-200 rounded w-5/6"></div>
              </div>
              <div className="h-10 bg-slate-100 rounded-lg p-2"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-white p-8 rounded-xl border border-rose-200 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="text-base font-semibold text-slate-800">Unable to Load Statutory Rules</h3>
          <p className="text-xs text-rose-600 max-w-md mx-auto">{error}</p>
          <button
            onClick={fetchRules}
            className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700"
          >
            Retry Connection
          </button>
        </div>
      ) : filteredRules.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-3">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-semibold text-slate-800">No Regulatory Rules Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No codified rules match your current filter criteria &quot;{search}&quot;. Try adjusting your search keywords or category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRules.map((rule) => (
            <div
              key={rule.id || rule.rule_code}
              className="bg-white rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
            >
              <div className="p-5 space-y-3">
                {/* Rule Header Bar */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-slate-900 text-slate-100 tracking-wider">
                    {rule.rule_code}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                      {rule.category}
                    </span>
                    {getSeverityBadge(rule.severity)}
                  </div>
                </div>

                {/* Rule Title */}
                <h3 className="text-base font-bold text-slate-900 leading-snug">
                  {rule.title}
                </h3>

                {/* Rule Description */}
                <p className="text-xs text-slate-600 leading-relaxed">
                  {rule.description}
                </p>

                {/* Statutory References Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-slate-700 shrink-0 w-24">Act Ref:</span>
                    <span className="text-slate-800 font-medium">{rule.act_reference}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-slate-700 shrink-0 w-24">Rule Ref:</span>
                    <span className="text-slate-800 font-mono text-[11px] bg-slate-200 px-1.5 py-0.5 rounded">
                      {rule.rule_reference}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-medium text-slate-700">Enforced by AI Engine</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400">Ver: {rule.version || '2011'}</span>
                  <button
                    onClick={() => setSelectedRule(rule)}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold hover:underline flex items-center gap-1"
                  >
                    View Details
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rule Detail Modal */}
      {selectedRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-6">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                    {selectedRule.rule_code}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {selectedRule.category}
                  </span>
                  {getSeverityBadge(selectedRule.severity)}
                </div>
                <h2 className="text-lg font-bold text-slate-900 mt-1">{selectedRule.title}</h2>
              </div>
              <button
                onClick={() => setSelectedRule(null)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Statutory Rule Description
                </label>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-800 leading-relaxed">
                  {selectedRule.description}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Act Reference
                  </label>
                  <p className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-800 font-medium">
                    {selectedRule.act_reference}
                  </p>
                </div>
                <div>
                  <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Rule Reference
                  </label>
                  <p className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-mono text-slate-800 font-medium">
                    {selectedRule.rule_reference}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                <div className="bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                  <span className="text-slate-500 block text-[11px]">Enforcement Status</span>
                  <span className="font-bold text-indigo-700">ACTIVE</span>
                </div>
                <div className="bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                  <span className="text-slate-500 block text-[11px]">Regulatory Version</span>
                  <span className="font-bold text-slate-800">{selectedRule.version || '2011.amended'}</span>
                </div>
                <div className="bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100">
                  <span className="text-slate-500 block text-[11px]">Validation Method</span>
                  <span className="font-bold text-slate-800">Deterministic Engine</span>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex items-start gap-2 text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  Failure to comply with this mandatory declaration triggers Section 36 of the Legal Metrology Act, 2009. The rule engine marks missing or non-compliant occurrences as <span className="font-semibold text-rose-700">POTENTIALLY_NON_COMPLIANT</span> and compiles documentary evidence for regulatory officers.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                onClick={() => setSelectedRule(null)}
                className="px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-lg hover:bg-slate-900"
              >
                Close Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default RulesCatalog;
