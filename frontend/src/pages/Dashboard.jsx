import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getInspectionStats, listInspections } from '../api/inspections';
import { StatCard } from '../components/common/StatCard';
import { StatusBadge } from '../components/common/StatusBadge';
import {
  FileText,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  PlusCircle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

export const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentInspections, setRecentInspections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboardData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [statsData, listData] = await Promise.all([
        getInspectionStats(),
        listInspections({ limit: 5 }),
      ]);
      setStats(statsData);
      setRecentInspections(listData || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to connect to LabelGuard backend services.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Compliance Terminal</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Legal Metrology (PCR 2011) statutory verification and enforcement overview.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={loadDashboardData}
            disabled={isLoading}
            className="inline-flex items-center space-x-1.5 px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <Link
            to="/inspections/new"
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Inspection</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadDashboardData} className="underline text-xs font-bold ml-4">
            Retry
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Inspections"
          value={stats?.total_inspections}
          subtitle="Conducted packaging audits"
          icon={FileText}
          color="slate"
        />
        <StatCard
          title="Compliant Ratio"
          value={stats ? `${stats.compliance_rate}%` : '—'}
          subtitle={`${stats?.compliant_count || 0} packages fully verified`}
          icon={ShieldCheck}
          color="emerald"
        />
        <StatCard
          title="Statutory Flags"
          value={stats?.potentially_non_compliant_count}
          subtitle="Potential Rule 6 violations"
          icon={AlertTriangle}
          color="rose"
        />
        <StatCard
          title="Manual Review"
          value={stats?.requires_manual_review_count}
          subtitle="Legibility / Physical check"
          icon={HelpCircle}
          color="amber"
        />
      </div>

      {/* Recent Inspections Table */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Recent Packaging Dossiers
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Latest inspections audited against Legal Metrology Rules.
            </p>
          </div>
          <Link
            to="/inspections"
            className="text-xs font-semibold text-brand-700 hover:text-brand-800 flex items-center space-x-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            Loading inspection records...
          </div>
        ) : recentInspections.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-500 text-sm">No inspections recorded yet.</p>
            <Link
              to="/inspections/new"
              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-brand-600 mt-2 hover:underline"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create your first inspection</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/60">
                <tr>
                  <th className="px-6 py-3">Inspection #</th>
                  <th className="px-6 py-3">Panels Audited</th>
                  <th className="px-6 py-3">Legal Outcome</th>
                  <th className="px-6 py-3">Score</th>
                  <th className="px-6 py-3">Timestamp</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentInspections.map((ins) => (
                  <tr key={ins.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-3.5 font-semibold text-slate-900 font-mono text-xs">
                      {ins.inspection_number}
                    </td>
                    <td className="px-6 py-3.5 text-xs">
                      {ins.images ? `${ins.images.length} Panel(s)` : '0 Panels'}
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge status={ins.status} size="sm" />
                    </td>
                    <td className="px-6 py-3.5 text-xs font-semibold text-slate-800">
                      {ins.overall_score !== undefined ? `${ins.overall_score}%` : '—'}
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-500">
                      {ins.created_at ? new Date(ins.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <Link
                        to={`/inspections/${ins.id}`}
                        className="text-xs font-semibold text-brand-700 hover:text-brand-800 hover:underline"
                      >
                        View Dossier
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
