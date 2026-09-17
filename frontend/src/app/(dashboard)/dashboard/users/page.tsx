'use client';

import { useEffect, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { 
  userService, 
  type User, 
  type PermissionModule, 
  type PermissionsListResponse 
} from '@/lib/services/user.service';
import { USER_ROLE_LABELS, USER_ROLE_COLORS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DataTable, type TableHeader } from '@/components/ui/data-table';
import { TableRow, TableCell } from '@/components/ui/table';
import { PageHeader } from '@/components/ui/page-header';
import { SearchFilterBar } from '@/components/ui/search-filter-bar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { 
  UserPlus, 
  ShieldCheck, 
  Key, 
  CheckSquare, 
  Square, 
  Settings2,
  Lock,
  Layers,
  ChevronDown,
  ChevronRight,
  Sparkles
} from 'lucide-react';

export default function UsersPage() {
  const { user: currentUser, hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [permissionsMeta, setPermissionsMeta] = useState<PermissionsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Edit Permissions Modal State
  const [selectedUserForPerms, setSelectedUserForPerms] = useState<User | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<string[]>([]);
  const [isSavingPerms, setIsSavingPerms] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  // Reset Password Modal State (Admin direct reset)
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Deactivate State
  const [deactivateConfirmUserId, setDeactivateConfirmUserId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'agent',
    permissions: [] as string[],
  });

  const fetchUsersAndMeta = async () => {
    try {
      setLoading(true);
      const [usersData, permsData] = await Promise.all([
        userService.listUsers(search, 'operational'),
        userService.getPermissionsList().catch(() => null),
      ]);
      setUsers(usersData);
      if (permsData) {
        setPermissionsMeta(permsData);
        // Expand first two modules by default
        const initExpanded: Record<string, boolean> = {};
        permsData.modules.forEach((m, idx) => {
          initExpanded[m.module] = idx < 3;
        });
        setExpandedModules(initExpanded);
      }
    } catch (err: any) {
      console.error('Failed to load user management data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchUsersAndMeta(); 
  }, [search]);

  // When role changes in create form, pre-populate default permissions for that role
  const handleRoleChangeInCreate = (newRole: string) => {
    const defaultPerms = permissionsMeta?.roleDefaults?.[newRole] || [];
    setFormData((prev) => ({
      ...prev,
      role: newRole,
      permissions: defaultPerms,
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await userService.createUser({
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName || undefined,
        role: formData.role,
        permissions: formData.permissions,
      });
      setSuccessMsg(`User created! Temporary password: ${res.tempPassword}`);
      setFormData({ email: '', firstName: '', lastName: '', role: 'agent', permissions: [] });
      setIsCreateModalOpen(false);
      fetchUsersAndMeta();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPermissionEditor = (user: User) => {
    setSelectedUserForPerms(user);
    // If user already has custom permissions stored, use them; otherwise populate from role defaults
    const currentPerms = (user.permissions && user.permissions.length > 0)
      ? user.permissions
      : (permissionsMeta?.roleDefaults?.[user.role] || []);
    setEditingPermissions(currentPerms);
  };

  const handleSavePermissions = async () => {
    if (!selectedUserForPerms) return;
    try {
      setIsSavingPerms(true);
      await userService.updateUser(selectedUserForPerms.id, {
        permissions: editingPermissions,
      });
      toast.success(`Permissions updated for ${selectedUserForPerms.firstName}!`);
      setSelectedUserForPerms(null);
      fetchUsersAndMeta();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save permissions');
    } finally {
      setIsSavingPerms(false);
    }
  };

  const togglePermission = (permKey: string) => {
    setEditingPermissions((prev) => {
      if (prev.includes(permKey)) {
        return prev.filter((k) => k !== permKey);
      }
      return [...prev, permKey];
    });
  };

  const toggleModuleAll = (modulePerms: string[]) => {
    const allSelected = modulePerms.every((p) => editingPermissions.includes(p));
    if (allSelected) {
      // Unselect all
      setEditingPermissions((prev) => prev.filter((k) => !modulePerms.includes(k)));
    } else {
      // Select all
      setEditingPermissions((prev) => Array.from(new Set([...prev, ...modulePerms])));
    }
  };

  const toggleCreatePermission = (permKey: string) => {
    setFormData((prev) => {
      const exists = prev.permissions.includes(permKey);
      return {
        ...prev,
        permissions: exists
          ? prev.permissions.filter((p) => p !== permKey)
          : [...prev.permissions, permKey],
      };
    });
  };

  const handleRoleUpdate = async (userId: string, newRole: string) => {
    try {
      const defaultPerms = permissionsMeta?.roleDefaults?.[newRole] || [];
      await userService.updateUser(userId, { 
        role: newRole as User['role'],
        permissions: defaultPerms,
      });
      toast.success('Role and default permissions updated');
      fetchUsersAndMeta();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update role');
    }
  };

  const openPasswordResetModal = (user: User) => {
    setSelectedUserForPassword(user);
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordError(null);
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPassword) return;

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    try {
      setIsSavingPassword(true);
      setPasswordError(null);
      await userService.resetPassword(selectedUserForPassword.id, newPassword);
      toast.success(`Password reset successfully for ${selectedUserForPassword.firstName}`);
      setSelectedUserForPassword(null);
    } catch (err: any) {
      setPasswordError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const promptDeactivate = (userId: string) => {
    setDeactivateConfirmUserId(userId);
  };

  const executeDeactivate = async () => {
    if (!deactivateConfirmUserId) return;
    try {
      await userService.deactivateUser(deactivateConfirmUserId);
      toast.success('User deactivated');
      fetchUsersAndMeta();
      setDeactivateConfirmUserId(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to deactivate user');
    }
  };

  const roleHierarchy: Record<string, number> = { viewer: 0, customer: 0, agent: 1, accountant: 2, manager: 3, admin: 4, owner: 5 };
  const currentUserRoleLevel = currentUser?.role ? roleHierarchy[currentUser.role] || 0 : 0;
  const canManageRoles = currentUserRoleLevel >= 4 || hasPermission('roles:manage') || hasPermission('users:update');
  const canCreateUser = currentUserRoleLevel >= 4 || hasPermission('users:create');

  const tableHeaders: TableHeader[] = [
    { key: 'user', label: 'Team Member' },
    { key: 'role', label: 'Assigned Role' },
    { key: 'permissions', label: 'Active Permissions' },
    { key: 'status', label: 'Status' },
    { key: 'lastLogin', label: 'Last Login' },
    ...(canManageRoles ? [{ key: 'actions', label: 'Actions', align: 'right' as const }] : []),
  ];

  const statusVariantMap: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    invited: 'bg-blue-50 text-blue-700 border-blue-200',
    inactive: 'bg-zinc-100 text-zinc-500 border-zinc-200',
    suspended: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <PageHeader 
        title="Team & Access Permissions" 
        subtitle="Manage organization staff, assign security roles, and customize granular module permissions."
      >
        {canCreateUser && (
          <Button 
            onClick={() => {
              setFormData({
                email: '',
                firstName: '',
                lastName: '',
                role: 'agent',
                permissions: permissionsMeta?.roleDefaults?.['agent'] || [],
              });
              setIsCreateModalOpen(true);
            }} 
            className="bg-amber-600 text-white hover:bg-amber-700 font-semibold shadow-sm rounded-xl text-xs h-9"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add Member
          </Button>
        )}
      </PageHeader>

      {successMsg && <Alert variant="success">{successMsg}</Alert>}
      {errorMsg && <Alert variant="destructive">{errorMsg}</Alert>}

      <SearchFilterBar>
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Input
            placeholder="Search team members by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs h-9 bg-white"
          />
        </div>
      </SearchFilterBar>

      <DataTable
        headers={tableHeaders}
        isLoading={loading}
        isEmpty={users.length === 0}
        emptyMessage="No team members found matching your search."
      >
        {users.map((u) => {
          const effectiveCount = u.role === 'owner' 
            ? 'All (*)' 
            : (u.permissions && u.permissions.length > 0)
              ? `${u.permissions.length} Custom`
              : `${permissionsMeta?.roleDefaults?.[u.role]?.length || 0} Default`;

          return (
            <TableRow key={u.id} className="hover:bg-zinc-50/80 transition-colors">
              <TableCell className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-600/20 text-amber-800 font-bold uppercase text-sm flex-shrink-0 border border-amber-200/50">
                    {u.firstName?.[0] || 'U'}{u.lastName?.[0] || ''}
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-900 text-sm">{u.firstName} {u.lastName}</div>
                    <div className="text-xs text-zinc-500">{u.email}</div>
                  </div>
                </div>
              </TableCell>

              <TableCell className="px-6 py-4">
                {canManageRoles && u.id !== currentUser?.id && u.role !== 'owner' ? (
                  <Select
                    value={u.role}
                    onChange={(e) => handleRoleUpdate(u.id, e.target.value)}
                    className="w-36 h-8 text-xs font-medium bg-white"
                    options={[
                      { value: 'admin', label: 'Admin' },
                      { value: 'manager', label: 'Manager' },
                      { value: 'accountant', label: 'Accountant' },
                      { value: 'agent', label: 'Sales Agent' },
                      { value: 'viewer', label: 'Viewer' },
                    ]}
                  />
                ) : (
                  <Badge className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${USER_ROLE_COLORS[u.role] || 'bg-zinc-100 text-zinc-700 border-zinc-200'}`}>
                    {USER_ROLE_LABELS[u.role] || u.role}
                  </Badge>
                )}
              </TableCell>

              <TableCell className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-medium text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200/60">
                    {effectiveCount}
                  </span>
                  {canManageRoles && u.role !== 'owner' && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => openPermissionEditor(u)}
                      className="h-7 text-[11px] text-amber-700 hover:text-amber-800 hover:bg-amber-50 px-2 rounded-lg font-semibold flex items-center gap-1"
                    >
                      <Key className="w-3 h-3" />
                      Configure
                    </Button>
                  )}
                </div>
              </TableCell>

              <TableCell className="px-6 py-4">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${statusVariantMap[u.status] || 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}>
                  {u.status}
                </span>
              </TableCell>

              <TableCell className="px-6 py-4 text-zinc-500 text-xs font-medium">
                {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
              </TableCell>

              {canManageRoles && (
                <TableCell className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button 
                      variant="ghost"
                      size="sm"
                      onClick={() => openPasswordResetModal(u)}
                      className="text-zinc-600 hover:text-amber-700 hover:bg-amber-50 text-xs font-semibold h-8 rounded-lg flex items-center gap-1"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Reset Password
                    </Button>
                    {u.id !== currentUser?.id && u.role !== 'owner' && (
                      <Button 
                        variant="ghost"
                        size="sm"
                        onClick={() => promptDeactivate(u.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs font-semibold h-8 rounded-lg"
                      >
                        Deactivate
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </DataTable>

      {/* CREATE MEMBER MODAL */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-2xl bg-white rounded-2xl p-6 shadow-2xl border border-zinc-200/80 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-600" />
              Add Organization Member
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Email Address *</label>
              <Input
                type="email"
                required
                autoComplete="off"
                placeholder="user@company.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">First Name *</label>
                <Input
                  required
                  placeholder="Rahul"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Last Name</label>
                <Input
                  placeholder="Sharma"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Select Role Preset *</label>
              <Select
                value={formData.role}
                onChange={(e) => handleRoleChangeInCreate(e.target.value)}
                options={[
                  { value: 'admin', label: 'Admin (Full Management)' },
                  { value: 'manager', label: 'Manager (Department Operations)' },
                  { value: 'accountant', label: 'Accountant (Invoices & Payments)' },
                  { value: 'agent', label: 'Sales Agent (Orders & Contacts)' },
                  { value: 'viewer', label: 'Viewer (Read-Only Access)' },
                ]}
                className="h-9 text-xs bg-zinc-50 border-zinc-200 rounded-xl font-medium"
              />
              <p className="text-[11px] text-zinc-400 mt-1">
                Selecting a role automatically pre-fills standard permissions below.
              </p>
            </div>

            {/* Granular Permissions Section */}
            <div className="border border-zinc-200/80 rounded-xl p-4 bg-zinc-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  Granted Permissions ({formData.permissions.length})
                </span>
                <span className="text-[11px] text-zinc-400 font-medium">Click to toggle permissions</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {permissionsMeta?.modules.map((mod) => (
                  <div key={mod.module} className="bg-white border border-zinc-200/70 rounded-lg p-2.5 space-y-1.5 shadow-2xs">
                    <div className="text-[11px] font-bold text-zinc-800 border-b border-zinc-100 pb-1">
                      {mod.label}
                    </div>
                    <div className="space-y-1">
                      {mod.permissions.map((p) => {
                        const isChecked = formData.permissions.includes(p.key);
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => toggleCreatePermission(p.key)}
                            className={`w-full text-left flex items-center justify-between p-1 rounded text-xs transition-colors ${
                              isChecked 
                                ? 'bg-amber-500/10 text-amber-900 font-semibold' 
                                : 'text-zinc-600 hover:bg-zinc-100'
                            }`}
                          >
                            <span className="truncate pr-2">{p.label}</span>
                            {isChecked ? (
                              <CheckSquare className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-zinc-300 flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
              <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)} className="text-xs h-9">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting} 
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-6 rounded-xl shadow-sm h-9"
              >
                {isSubmitting ? 'Creating...' : 'Create Member'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* PERMISSION MATRIX CONFIGURATION MODAL */}
      <Dialog open={!!selectedUserForPerms} onOpenChange={(open) => !open && setSelectedUserForPerms(null)}>
        <DialogContent className="sm:max-w-3xl bg-white rounded-2xl p-6 shadow-2xl border border-zinc-200/80 max-h-[90vh] flex flex-col">
          <DialogHeader className="border-b border-zinc-100 pb-3 pr-8">
            <DialogTitle className="text-base font-bold text-zinc-900 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <span className="truncate">Customize Permissions: {selectedUserForPerms?.firstName} {selectedUserForPerms?.lastName}</span>
              </div>
              <Badge className={`text-xs flex-shrink-0 font-semibold ${USER_ROLE_COLORS[selectedUserForPerms?.role || 'agent']}`}>
                Role: {USER_ROLE_LABELS[selectedUserForPerms?.role || 'agent']}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">
            <div className="flex items-center justify-between bg-amber-50/60 border border-amber-200/70 p-3 rounded-xl">
              <div className="text-xs text-amber-900 font-medium">
                <span className="font-bold">{editingPermissions.length} permissions active</span> for this user.
                Custom toggles override default role restrictions.
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedUserForPerms) {
                    const defaults = permissionsMeta?.roleDefaults?.[selectedUserForPerms.role] || [];
                    setEditingPermissions(defaults);
                  }
                }}
                className="text-[11px] h-7 bg-white font-semibold text-amber-800 border-amber-300"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                Reset to Role Defaults
              </Button>
            </div>

            {/* Grouped Permission Accordion List */}
            <div className="space-y-3">
              {permissionsMeta?.modules.map((mod) => {
                const modulePermKeys = mod.permissions.map((p) => p.key);
                const activeInModule = modulePermKeys.filter((k) => editingPermissions.includes(k)).length;
                const isExpanded = expandedModules[mod.module] ?? false;

                return (
                  <div key={mod.module} className="border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                    <div 
                      className="flex items-center justify-between p-3.5 bg-zinc-50/70 hover:bg-zinc-100/70 cursor-pointer select-none transition-colors"
                      onClick={() => setExpandedModules((prev) => ({ ...prev, [mod.module]: !isExpanded }))}
                    >
                      <div className="flex items-center gap-2.5">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-zinc-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-zinc-500" />
                        )}
                        <span className="text-xs font-bold text-zinc-900">{mod.label}</span>
                        <span className="text-[11px] px-2 py-0.5 bg-zinc-200/70 text-zinc-700 rounded-full font-mono font-medium">
                          {activeInModule} / {mod.permissions.length}
                        </span>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleModuleAll(modulePermKeys);
                        }}
                        className="h-6 text-[11px] font-semibold text-amber-700 hover:text-amber-800 px-2 rounded"
                      >
                        {activeInModule === mod.permissions.length ? 'Unselect All' : 'Select All'}
                      </Button>
                    </div>

                    {isExpanded && (
                      <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2 border-t border-zinc-100 bg-white">
                        {mod.permissions.map((p) => {
                          const isChecked = editingPermissions.includes(p.key);
                          return (
                            <div
                              key={p.key}
                              onClick={() => togglePermission(p.key)}
                              className={`p-2.5 rounded-xl border flex items-start justify-between gap-3 cursor-pointer transition-all ${
                                isChecked
                                  ? 'bg-amber-500/10 border-amber-300 text-amber-950 font-medium'
                                  : 'bg-zinc-50/50 border-zinc-200/70 text-zinc-600 hover:bg-zinc-100/50'
                              }`}
                            >
                              <div className="space-y-0.5 overflow-hidden">
                                <div className="text-xs font-bold">{p.label}</div>
                                <div className="text-[11px] text-zinc-400 truncate">{p.description}</div>
                              </div>

                              <div className="pt-0.5 flex-shrink-0">
                                {isChecked ? (
                                  <CheckSquare className="w-4 h-4 text-amber-600" />
                                ) : (
                                  <Square className="w-4 h-4 text-zinc-300" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setSelectedUserForPerms(null)} 
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button 
              type="button"
              onClick={handleSavePermissions}
              disabled={isSavingPerms} 
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-6 rounded-xl shadow-sm h-9 flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              {isSavingPerms ? 'Saving Changes...' : 'Save Permissions'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ADMIN DIRECT RESET PASSWORD MODAL */}
      <Dialog open={!!selectedUserForPassword} onOpenChange={(open) => !open && setSelectedUserForPassword(null)}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-zinc-200/80">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-600" />
              Reset Password
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSavePassword} className="space-y-4 pt-2">
            <p className="text-xs text-zinc-500">
              Set a new password for <span className="font-bold text-zinc-800">{selectedUserForPassword?.firstName} {selectedUserForPassword?.lastName}</span> ({selectedUserForPassword?.email}).
            </p>

            {passwordError && (
              <Alert variant="destructive" className="py-2 text-xs">
                {passwordError}
              </Alert>
            )}

            <div className="space-y-3">
              <Input
                id="newPassword"
                type="password"
                label="New Password *"
                placeholder="Minimum 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="h-10 text-xs"
              />

              <Input
                id="confirmNewPassword"
                type="password"
                label="Confirm New Password *"
                placeholder="Re-enter password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
                className="h-10 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedUserForPassword(null)}
                className="text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingPassword}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-9 px-5 rounded-xl"
              >
                {isSavingPassword ? 'Resetting...' : 'Update Password'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* CONFIRM DEACTIVATE DIALOG */}
      <ConfirmDialog
        isOpen={!!deactivateConfirmUserId}
        title="Deactivate Team Member"
        description="Are you sure you want to deactivate this team member? They will lose access to the console immediately."
        confirmText="Deactivate"
        variant="destructive"
        onConfirm={executeDeactivate}
        onClose={() => setDeactivateConfirmUserId(null)}
      />
    </div>
  );
}
