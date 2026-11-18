import React, { useState, useEffect } from 'react';
import { listUsers, updateUser } from '../api/users';
import { useAuth } from '../context/AuthContext';
import {
  Users as UsersIcon,
  Shield,
  RefreshCw,
  Edit2,
  Check,
  X,
  AlertCircle,
  UserCheck,
  UserX,
} from 'lucide-react';

export const Users = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Editing state
  const [editingUserId, setEditingUserId] = useState(null);
  const [selectedRole, setSelectedRole] = useState('INSPECTOR');
  const [isUpdating, setIsUpdating] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const roles = ['INSPECTOR', 'COMPLIANCE_OFFICER', 'VIEWER', 'ADMIN', 'SUPER_ADMIN'];

  const fetchUsers = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await listUsers();
      setUsers(data || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to retrieve system user accounts.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleUpdate = async (userId) => {
    setIsUpdating(true);
    setError('');
    setActionMessage('');
    try {
      await updateUser(userId, { role: selectedRole });
      setActionMessage('Role updated successfully.');
      setEditingUserId(null);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update user role.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleStatus = async (user) => {
    if (user.id === currentUser.id) {
      alert('You cannot deactivate your own administrative account.');
      return;
    }

    const nextStatus = !user.is_active;
    const confirmMsg = nextStatus
      ? `Activate user account for ${user.email}?`
      : `Deactivate user account for ${user.email}? They will not be able to log in.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await updateUser(user.id, { is_active: nextStatus });
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to modify account status.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">User & Role Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Administrative access control for Legal Metrology officers, auditors, and staff.
          </p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={isLoading}
          className="inline-flex items-center space-x-1.5 px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={fetchUsers} className="underline text-xs font-bold ml-4">
            Retry
          </button>
        </div>
      )}

      {actionMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
          {actionMessage}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-16 text-center text-slate-400 text-sm">
            <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            Loading user directory...
          </div>
        ) : users.length === 0 ? (
          <div className="p-16 text-center">
            <UsersIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Users Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Registered inspector and compliance officer accounts will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/60">
                <tr>
                  <th className="px-6 py-3.5">Officer / User</th>
                  <th className="px-6 py-3.5">Email Address</th>
                  <th className="px-6 py-3.5">Assigned Role</th>
                  <th className="px-6 py-3.5">Account Status</th>
                  <th className="px-6 py-3.5">Created Date</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  const isEditing = editingUserId === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center border border-slate-200">
                            {u.full_name ? u.full_name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 text-xs">{u.full_name}</p>
                            {isSelf && (
                              <span className="text-[10px] text-brand-600 font-bold">(You)</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-xs font-mono text-slate-600">{u.email}</td>
                      <td className="px-6 py-3.5">
                        {isEditing ? (
                          <div className="flex items-center space-x-2">
                            <select
                              value={selectedRole}
                              onChange={(e) => setSelectedRole(e.target.value)}
                              className="px-2 py-1 text-xs border border-slate-300 rounded bg-white font-semibold outline-none"
                            >
                              {roles.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleRoleUpdate(u.id)}
                              disabled={isUpdating}
                              className="p-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              title="Confirm role update"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingUserId(null)}
                              className="p-1 rounded bg-slate-100 text-slate-600 hover:bg-slate-200"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${
                              ['ADMIN', 'SUPER_ADMIN'].includes(u.role)
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : u.role === 'INSPECTOR'
                                ? 'bg-sky-50 text-sky-700 border-sky-200'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            {u.role}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5">
                        {u.is_active ? (
                          <span className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-700">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-xs font-semibold text-slate-400">
                            <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                            <span>Deactivated</span>
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-500">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => {
                              setEditingUserId(u.id);
                              setSelectedRole(u.role);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-medium inline-flex items-center space-x-1"
                            title="Modify User Role"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Role</span>
                          </button>
                          {!isSelf && (
                            <button
                              onClick={() => handleToggleStatus(u)}
                              className={`p-1.5 rounded-lg border text-xs font-medium inline-flex items-center space-x-1 ${
                                u.is_active
                                  ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                                  : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={u.is_active ? 'Deactivate Account' : 'Activate Account'}
                            >
                              {u.is_active ? (
                                <UserX className="w-3 h-3" />
                              ) : (
                                <UserCheck className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
