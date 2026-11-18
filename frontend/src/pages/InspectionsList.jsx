import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { listInspections } from '../api/inspections';
import { StatusBadge } from '../components/common/StatusBadge';
import {
  FileText,
  Search,
  Filter,
  PlusCircle,
  RefreshCw,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';

export const InspectionsList = () => {
  const [inspections, setInspections] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' = newest first, 'asc' = oldest first
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchInspections = async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = {
        skip: page * pageSize,
        limit: pageSize,
      };
      if (statusFilter !== 'ALL') {
        params.status_filter = statusFilter;
      }
      const data = await listInspections(params);
      setInspections(data || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to retrieve inspections ledger.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInspections();
  }, [statusFilter, page]);

  // Client-side search and sorting on currently fetched list
  const filteredInspections = useMemo(() => {
    let result = [...inspections];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (ins) =>
          (ins.inspection_number || '').toLowerCase().includes(q) ||
          (ins.notes || '').toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [inspections, searchQuery, sortOrder]);

  const statusTabs = [
    { key: 'ALL', label: 'All Records' },
    { key: 'COMPLIANT', label: 'Compliant' },
    { key: 'POTENTIALLY_NON_COMPLIANT', label: 'Non-Compliant Flags' },
    { key: 'REQUIRES_MANUAL_REVIEW', label: 'Manual Review' },
    { key: 'PROCESSING', label: 'Processing' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Inspections Ledger</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Audit trail of packaged commodity labels analyzed under PCR 2011.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchInspections}
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
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={fetchInspections} className="underline text-xs font-bold ml-4">
            Retry
          </button>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
        {/* Status Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 border-b border-slate-100">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setStatusFilter(tab.key);
                setPage(0);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                statusFilter === tab.key
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Inspection # or notes..."
              className="block w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="inline-flex items-center space-x-1.5 px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition"
              title="Toggle sorting order by date"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Inspections Table */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center text-slate-400 text-sm">
            <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            Loading ledger records...
          </div>
        ) : filteredInspections.length === 0 ? (
          <div className="p-16 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Inspection Records Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              {searchQuery || statusFilter !== 'ALL'
                ? 'Try adjusting your status filter or search keywords.'
                : 'No packaged commodities have been audited yet.'}
            </p>
            {statusFilter !== 'ALL' && (
              <button
                onClick={() => setStatusFilter('ALL')}
                className="mt-3 text-xs font-bold text-brand-600 hover:underline"
              >
                Clear status filter
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/60">
                <tr>
                  <th className="px-6 py-3.5">Inspection #</th>
                  <th className="px-6 py-3.5">Panels Audited</th>
                  <th className="px-6 py-3.5">Outcome Status</th>
                  <th className="px-6 py-3.5">Score</th>
                  <th className="px-6 py-3.5">Manual Override</th>
                  <th className="px-6 py-3.5">Created Date</th>
                  <th className="px-6 py-3.5 text-right">Dossier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInspections.map((ins) => (
                  <tr key={ins.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-3.5">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {ins.inspection_number}
                      </span>
                      {ins.notes && (
                        <p className="text-[11px] text-slate-400 truncate max-w-xs">{ins.notes}</p>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-xs">
                      {ins.images ? `${ins.images.length} Panel(s)` : '0 Panels'}
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge status={ins.status} size="sm" />
                    </td>
                    <td className="px-6 py-3.5 text-xs font-bold text-slate-800">
                      {ins.overall_score !== undefined ? `${ins.overall_score}%` : '—'}
                    </td>
                    <td className="px-6 py-3.5 text-xs">
                      {ins.is_manual_override ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          Overridden
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-500">
                      {ins.created_at ? new Date(ins.created_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <Link
                        to={`/inspections/${ins.id}`}
                        className="inline-flex items-center space-x-1 text-xs font-semibold text-brand-600 hover:text-brand-800 hover:underline"
                      >
                        <span>View</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing Page <span className="font-semibold text-slate-800">{page + 1}</span> (
            {filteredInspections.length} records)
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0 || isLoading}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={filteredInspections.length < pageSize || isLoading}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
