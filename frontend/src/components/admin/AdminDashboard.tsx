import React, { useState, useMemo } from 'react';
import {
  Users,
  Check,
  X,
  AlertTriangle,
  Download,
  Plus,
  Shield,
  Clock,
  Building2,
  FileText,
  Sliders,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Search,
  Zap,
  Award,
  Layers,
  Eye,
  KeyRound,
} from 'lucide-react';
import {
  Ticket,
  User,
  SystemMetrics,
  UserRole,
  AuditLogEntry,
  SlaPolicy,
  TicketPriority,
} from '../../types';
import { useLanguage } from '../../traduction';

interface AdminDashboardProps {
  metrics: SystemMetrics;
  tickets: Ticket[];
  users: User[];
  auditLogs: AuditLogEntry[];
  slaPolicies: SlaPolicy[];
  departments: string[];
  currentUserRole?: UserRole;
  onAssignTicket: (ticketId: string, technicianId: string) => void;
  onReassignToAvailableColleague?: (ticketId: string) => void;
  onApproveBudget: (ticketId: string, notes: string) => void;
  onRejectTicket: (ticketId: string, reason: string) => void;
  onCreateUser: (params: { fullName: string; email: string; department: string; role: UserRole }) => Promise<User>;
  onUpdateUserRole: (userId: string, role: UserRole) => void;
  onUpdateUserDepartment: (userId: string, department: string) => void;
  onToggleUserActive: (userId: string) => void;
  onSetUserPassword: (userId: string, password: string) => Promise<void>;
  onUpdateSla: (priority: TicketPriority, hours: number) => void;
  onCreateDepartment: (name: string) => Promise<void>;
  onRenameDepartment: (oldName: string, newName: string) => Promise<void>;
  onDeleteDepartment: (name: string) => Promise<void>;
  onSelectTicket: (ticket: Ticket) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  metrics,
  tickets,
  users,
  auditLogs,
  slaPolicies,
  departments,
  currentUserRole = 'ADMIN',
  onAssignTicket,
  onReassignToAvailableColleague,
  onApproveBudget,
  onRejectTicket,
  onCreateUser,
  onUpdateUserRole,
  onUpdateUserDepartment,
  onToggleUserActive,
  onSetUserPassword,
  onUpdateSla,
  onCreateDepartment,
  onRenameDepartment,
  onDeleteDepartment,
  onSelectTicket,
}) => {
  const { language, t } = useLanguage();
  const [activeAdminTab, setActiveAdminTab] = useState<
    'overview' | 'tickets' | 'approvals' | 'users' | 'departments' | 'audit' | 'sla'
  >('overview');

  // Fast technician selection for assignment
  const [selectedTech, setSelectedTech] = useState<Record<string, string>>({});

  // User creation form modal state
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDepartment, setNewDepartment] = useState(departments[0] || '');
  const [departmentName, setDepartmentName] = useState('');
  const [editingDepartment, setEditingDepartment] = useState<string | null>(null);
  const [editedDepartmentName, setEditedDepartmentName] = useState('');
  const [departmentError, setDepartmentError] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('CHEF_DE_SERVICE');
  const [newUserError, setNewUserError] = useState<string | null>(null);

  // Approval action notes state
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});

  // Audit filter state
  const [auditFilterUser, setAuditFilterUser] = useState<string>('ALL');

  // Users Filter states
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');
  const [userDeptFilter, setUserDeptFilter] = useState<string>('ALL');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newUserPassword, setNewUserPassword] = useState('');
  const [confirmUserPassword, setConfirmUserPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Unassigned Tickets Dispatch filter
  const [dispatchDeptFilter, setDispatchDeptFilter] = useState<string>('ALL');
  const [dispatchPriorityFilter, setDispatchPriorityFilter] = useState<string>('ALL');
  const [ticketDepartmentFilter, setTicketDepartmentFilter] = useState('ALL');
  const [ticketStatusFilter, setTicketStatusFilter] = useState('ALL');
  const [ticketSlaFilter, setTicketSlaFilter] = useState('ALL');
  const [ticketStartDate, setTicketStartDate] = useState('');
  const [ticketEndDate, setTicketEndDate] = useState('');

  const technicians = users.filter((u) => u.role === 'TECHNICIAN' && u.isActive);
  const availableTechnicians = technicians.filter((technician) => !technician.isBusy);
  const pendingApprovals = tickets.filter((t) => t.status === 'PENDING_APPROVAL');
  const unassignedTickets = tickets.filter((t) => !t.assignedToId && t.status === 'PENDING');

  // Extract distinct departments for user & ticket filters
  const allDepartments = useMemo(() => {
    const set = new Set<string>(departments);
    users.forEach((u) => u.department && set.add(u.department));
    tickets.forEach((t) => t.department && set.add(t.department));
    return Array.from(set).sort();
  }, [users, tickets, departments]);

  React.useEffect(() => {
    if (!departments.includes(newDepartment)) setNewDepartment(departments[0] || '');
  }, [departments, newDepartment]);

  const handleCreateDepartment = async (event: React.FormEvent) => {
    event.preventDefault();
    setDepartmentError(null);
    try {
      await onCreateDepartment(departmentName);
      setDepartmentName('');
    } catch (error: unknown) {
      setDepartmentError(error instanceof Error ? error.message : 'La création du département a échoué.');
    }
  };

  const handleRenameDepartment = async (oldName: string) => {
    setDepartmentError(null);
    try {
      await onRenameDepartment(oldName, editedDepartmentName);
      setEditingDepartment(null);
      setEditedDepartmentName('');
    } catch (error: unknown) {
      setDepartmentError(error instanceof Error ? error.message : 'Le renommage du département a échoué.');
    }
  };

  const handleDeleteDepartment = async (name: string) => {
    if (!window.confirm(`Supprimer le département « ${name} » ?`)) return;
    setDepartmentError(null);
    try {
      await onDeleteDepartment(name);
    } catch (error: unknown) {
      setDepartmentError(error instanceof Error ? error.message : 'La suppression du département a échoué.');
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        u.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.department.toLowerCase().includes(userSearch.toLowerCase());

      const matchRole = userRoleFilter === 'ALL' || u.role === userRoleFilter;
      const matchDept = userDeptFilter === 'ALL' || u.department === userDeptFilter;

      return matchSearch && matchRole && matchDept;
    });
  }, [users, userSearch, userRoleFilter, userDeptFilter]);

  const filteredUnassignedTickets = useMemo(() => {
    return unassignedTickets.filter((t) => {
      const matchDept = dispatchDeptFilter === 'ALL' || t.department === dispatchDeptFilter;
      const matchPriority = dispatchPriorityFilter === 'ALL' || t.priority === dispatchPriorityFilter;
      return matchDept && matchPriority;
    });
  }, [unassignedTickets, dispatchDeptFilter, dispatchPriorityFilter]);

  const filteredAllTickets = useMemo(() => {
    const now = Date.now();
    return tickets
      .filter((ticket) => {
        const createdAt = new Date(ticket.createdAt).getTime();
        const deadline = new Date(ticket.slaDeadline).getTime();
        const isFinished = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
        const isLate = isFinished
          ? new Date(ticket.resolvedAt || ticket.updatedAt).getTime() > deadline
          : now > deadline;
        const matchDepartment = ticketDepartmentFilter === 'ALL' || ticket.department === ticketDepartmentFilter;
        const matchStatus = ticketStatusFilter === 'ALL' || ticket.status === ticketStatusFilter;
        const matchStart = !ticketStartDate || createdAt >= new Date(`${ticketStartDate}T00:00:00`).getTime();
        const matchEnd = !ticketEndDate || createdAt < new Date(`${ticketEndDate}T23:59:59.999`).getTime();
        const matchSla =
          ticketSlaFilter === 'ALL' ||
          (ticketSlaFilter === 'RESOLVED_LATE' && isFinished && isLate) ||
          (ticketSlaFilter === 'RESOLVED_ON_TIME' && isFinished && !isLate) ||
          (ticketSlaFilter === 'OPEN_OVERDUE' && !isFinished && ticket.status !== 'REJECTED' && isLate);
        return matchDepartment && matchStatus && matchStart && matchEnd && matchSla;
      })
      .sort((a, b) => new Date(a.slaDeadline).getTime() - new Date(b.slaDeadline).getTime());
  }, [tickets, ticketDepartmentFilter, ticketStatusFilter, ticketSlaFilter, ticketStartDate, ticketEndDate]);

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewUserError(null);
    if (!newFullName.trim() || !newEmail.trim() || !newDepartment.trim()) {
      setNewUserError('Le nom, l\'email et le département sont obligatoires.');
      return;
    }
    try {
      const createdUser = await onCreateUser({
        fullName: newFullName,
        email: newEmail,
        department: newDepartment,
        role: newRole,
      });
      window.alert(`Compte créé pour ${createdUser.email}.\nMot de passe temporaire : ${createdUser.password}`);
      setNewFullName('');
      setNewEmail('');
      setIsNewUserModalOpen(false);
    } catch (err: unknown) {
      setNewUserError(err instanceof Error ? err.message : 'Erreur lors de la création');
    }
  };

  const handleSetUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    if (newUserPassword.length < 8) {
      setPasswordError('Le mot de passe doit comporter au moins 8 caractères.');
      return;
    }
    if (newUserPassword !== confirmUserPassword) {
      setPasswordError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (!selectedUser) return;

    setIsChangingPassword(true);
    try {
      await onSetUserPassword(selectedUser.id, newUserPassword);
      setNewUserPassword('');
      setConfirmUserPassword('');
      setPasswordSuccess(`Le mot de passe de ${selectedUser.fullName} a été mis à jour.`);
    } catch (error: unknown) {
      setPasswordError(error instanceof Error ? error.message : 'La modification du mot de passe a échoué.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const exportAuditCSV = () => {
    const headers = ['ID', 'Horodatage_UTC', 'Auteur', 'Role', 'Action', 'Cible', 'Details', 'IP'];
    const rows = auditLogs.map((log) => [
      log.id,
      log.timestamp,
      `"${log.userName.replace(/"/g, '""')}"`,
      log.userRole,
      log.action,
      log.targetId,
      `"${log.details.replace(/"/g, '""')}"`,
      log.ipAddress,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `deskflow_audit_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportTopEmployeesCSV = () => {
    const escapeCSV = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const headers = ['Rang', 'Technicien', 'Demandes résolues', 'Demandes actives', 'Conformité SLA (%)', 'Disponibilité'];
    const rows = metrics.technicianLeaderboard.map((entry, index) => [
      index + 1,
      entry.technicianName,
      entry.resolvedCount,
      entry.activeCount,
      entry.slaComplianceRate,
      entry.isBusy ? 'Occupé' : 'Disponible',
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCSV).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `deskflow-palmares-techniciens-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const filteredAuditLogs = auditLogs.filter(
    (log) => auditFilterUser === 'ALL' || log.userId === auditFilterUser
  );

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">
            {currentUserRole === 'CHEF_DE_SUPPORT'
              ? t('Console de Supervision Support & Dispatching')
              : t('Suite d\'Administration & Gouvernance IT')}
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            {currentUserRole === 'CHEF_DE_SUPPORT'
              ? 'Supervision en temps réel des files d\'attente par département, palmarès techniciens, équilibrage de charge et réaffectation exclusive des demandes.'
              : 'Supervision des files d\'attente par département, palmarès techniciens, équilibrage de charge, arbitrage budgétaire et sécurité.'}
          </p>
        </div>

      </div>

      <div className="flex items-center gap-1 border-b border-neutral-200 pb-px overflow-x-auto text-xs">
          <button
            onClick={() => setActiveAdminTab('overview')}
            className={`px-3 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeAdminTab === 'overview'
                ? 'border-neutral-900 text-neutral-900 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            {t('Vue générale')}
          </button>
          <button
            onClick={() => setActiveAdminTab('tickets')}
            className={`px-3 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeAdminTab === 'tickets'
                ? 'border-neutral-900 text-neutral-900 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            {t('Toutes les demandes')} ({tickets.length})
          </button>
          {currentUserRole === 'ADMIN' && <>
          <button
            onClick={() => setActiveAdminTab('approvals')}
            className={`px-3 py-2 font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeAdminTab === 'approvals'
                ? 'border-neutral-900 text-neutral-900 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <span>Approbations Budgétaires</span>
            {pendingApprovals.length > 0 && (
              <span className="font-mono text-[10px] bg-neutral-900 text-white px-1.5 py-0.2 rounded font-semibold">
                {pendingApprovals.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveAdminTab('users')}
            className={`px-3 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeAdminTab === 'users'
                ? 'border-neutral-900 text-neutral-900 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            Utilisateurs, Départements & Rôles ({users.length})
          </button>

          <button
            onClick={() => setActiveAdminTab('departments')}
            className={`px-3 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeAdminTab === 'departments'
                ? 'border-neutral-900 text-neutral-900 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            {t('Gérer les départements')} ({departments.length})
          </button>

          <button
            onClick={() => setActiveAdminTab('audit')}
            className={`px-3 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeAdminTab === 'audit'
                ? 'border-neutral-900 text-neutral-900 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            Journal d'Audit Global ({auditLogs.length})
          </button>

          <button
            onClick={() => setActiveAdminTab('sla')}
            className={`px-3 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeAdminTab === 'sla'
                ? 'border-neutral-900 text-neutral-900 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            Politiques SLA & Délais
          </button>
          </>}
        </div>

      {activeAdminTab === 'tickets' && (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 rounded-md border border-neutral-200 bg-white p-4">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">Suivi global des demandes</h2>
              <p className="mt-1 text-xs text-neutral-500">Historique complet par département, échéance SLA et état de résolution.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <select value={ticketDepartmentFilter} onChange={(e) => setTicketDepartmentFilter(e.target.value)} className="rounded border border-neutral-300 bg-white px-2.5 py-2 text-xs">
                <option value="ALL">Tous les départements</option>
                {allDepartments.map((department) => <option key={department} value={department}>{department}</option>)}
              </select>
              <select value={ticketStatusFilter} onChange={(e) => setTicketStatusFilter(e.target.value)} className="rounded border border-neutral-300 bg-white px-2.5 py-2 text-xs">
                <option value="ALL">Tous les statuts</option>
                {['PENDING_APPROVAL', 'PENDING', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED'].map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
              </select>
              <select value={ticketSlaFilter} onChange={(e) => setTicketSlaFilter(e.target.value)} className="rounded border border-neutral-300 bg-white px-2.5 py-2 text-xs">
                <option value="ALL">Tous les délais</option>
                <option value="RESOLVED_LATE">Résolues en retard</option>
                <option value="RESOLVED_ON_TIME">Résolues dans les délais</option>
                <option value="OPEN_OVERDUE">En retard, non résolues</option>
              </select>
              <label className="flex items-center gap-2 rounded border border-neutral-300 px-2.5 py-1.5 text-xs text-neutral-600">
                Du <input aria-label="Date de début" type="date" value={ticketStartDate} onChange={(e) => setTicketStartDate(e.target.value)} className="min-w-0 flex-1 text-neutral-900" />
              </label>
              <label className="flex items-center gap-2 rounded border border-neutral-300 px-2.5 py-1.5 text-xs text-neutral-600">
                Au <input aria-label="Date de fin" type="date" value={ticketEndDate} onChange={(e) => setTicketEndDate(e.target.value)} className="min-w-0 flex-1 text-neutral-900" />
              </label>
            </div>
          </div>
          <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-[10px] uppercase text-neutral-600">
                <tr>
                  <th className="px-3 py-3">Référence / création</th>
                  <th className="px-3 py-3">Demande</th>
                  <th className="px-3 py-3">Demandeur / département</th>
                  <th className="px-3 py-3">Technicien</th>
                  <th className="px-3 py-3">Statut</th>
                  <th className="px-3 py-3">Échéance / SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredAllTickets.map((ticket) => {
                  const finished = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED';
                  const isLate = new Date(finished ? (ticket.resolvedAt || ticket.updatedAt) : Date.now()).getTime() > new Date(ticket.slaDeadline).getTime();
                  return (
                    <tr key={ticket.id} onClick={() => onSelectTicket(ticket)} className="cursor-pointer hover:bg-neutral-50">
                      <td className="px-3 py-3 align-top">
                        <div className="font-mono font-semibold text-neutral-900">{ticket.ticketNumber}</div>
                        <div className="mt-1 text-[10px] text-neutral-500">Date création : {formatDate(ticket.createdAt)}</div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="font-medium text-neutral-900">{ticket.title}</div>
                        <div className="mt-1 text-[10px] text-neutral-500">{ticket.category}</div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div>{ticket.createdByName}</div>
                        <div className="mt-1 text-[10px] text-neutral-500">{ticket.department}</div>
                      </td>
                      <td className="px-3 py-3 align-top">{ticket.assignedToName || 'Non assigné'}</td>
                      <td className="px-3 py-3 align-top">{ticket.status.replaceAll('_', ' ')}</td>
                      <td className="px-3 py-3 align-top">
                        <div>{formatDate(ticket.slaDeadline)}</div>
                        <div className={`mt-1 text-[10px] font-medium ${isLate ? 'text-rose-700' : 'text-emerald-700'}`}>
                          {isLate ? (finished ? 'Résolue en retard' : 'Délai dépassé') : (finished ? 'Résolue dans les délais' : 'Dans les délais')}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredAllTickets.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-neutral-500">Aucune demande ne correspond aux filtres.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 1: OVERVIEW & KPIS AVEC CLASSEMENT DES DÉPARTEMENTS ET PALMARÈS TECHNICIENS */}
      {activeAdminTab === 'overview' && (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-md bg-white border border-neutral-200 space-y-1">
              <div className="text-xs text-neutral-500 font-medium">Demandes Totales</div>
              <div className="text-2xl font-semibold font-mono tabular-nums text-neutral-900">
                {metrics.totalTickets}
              </div>
              <div className="text-xs text-neutral-500">
                {metrics.resolvedTickets} résolues · {metrics.activeUsers} utilisateurs actifs
              </div>
            </div>

            <div className="p-4 rounded-md bg-white border border-neutral-200 space-y-1">
              <div className="text-xs text-neutral-500 font-medium">En Attente d'Approbation</div>
              <div className="text-2xl font-semibold font-mono tabular-nums text-neutral-900">
                {metrics.pendingApprovalTickets}
              </div>
              <div className="text-xs text-neutral-500">
                Arbitrage budgétaire requis (&gt; 500 000 FCFA)
              </div>
            </div>

            <div className="p-4 rounded-md bg-white border border-neutral-200 space-y-1">
              <div className="text-xs text-neutral-500 font-medium">File d'Attente Active</div>
              <div className="text-2xl font-semibold font-mono tabular-nums text-neutral-900">
                {metrics.unassignedTickets + metrics.inProgressTickets}
              </div>
              <div className="text-xs text-neutral-500">
                {metrics.unassignedTickets} non assignées · {metrics.inProgressTickets} en cours
              </div>
            </div>

            <div className="p-4 rounded-md bg-white border border-neutral-200 space-y-1">
              <div className="text-xs text-neutral-500 font-medium">Dépassements SLA</div>
              <div className="text-2xl font-semibold font-mono tabular-nums text-neutral-900">
                {metrics.slaBreachedTickets}
              </div>
              <div className="text-xs text-neutral-500">
                Délai moyen constaté : {metrics.averageResolutionHours}h
              </div>
            </div>
          </div>

          {/* TWO COLUMN GRID: 1. CLASSEMENT DES DÉPARTEMENTS AVEC LE PLUS DE QUEUE & 2. TECHNICIENS AYANT LE PLUS ASSISTÉ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CLASSEMENT DES DÉPARTEMENTS PAR FILE D'ATTENTE (QUEUE BACKLOG) */}
            <div className="p-5 rounded-md bg-white border border-neutral-200 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-neutral-700" />
                  <h2 className="text-sm font-semibold text-neutral-900">
                    Départements par volume de demandes en attente
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-neutral-400">
                  Tickets en cours de traitement
                </span>
              </div>

              <p className="text-xs text-neutral-500">
                Visualisation des services ayant la charge de tickets en attente la plus élevée.
              </p>

              <div className="space-y-3">
                {metrics.departmentQueueRanking.length === 0 ? (
                  <div className="py-6 text-center text-xs text-neutral-500">
                    Aucune file d'attente active détectée.
                  </div>
                ) : (
                  metrics.departmentQueueRanking.map((deptData) => (
                    <div
                      key={deptData.department}
                      className="p-3 bg-neutral-50 border border-neutral-200 rounded-md text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-900">
                            {deptData.department}
                          </span>
                          {deptData.urgentCount > 0 && (
                            <span className="font-mono text-[9px] bg-neutral-900 text-white px-1.5 py-0.2 rounded font-semibold inline-flex items-center gap-0.5">
                              <Zap className="w-2.5 h-2.5" /> {deptData.urgentCount} urgent(s)
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[11px]">
                          <strong className="text-neutral-900 text-sm">{deptData.queueCount}</strong>
                          <span className="text-neutral-500 ml-1">en attente</span>
                        </div>
                      </div>

                      {/* Minimal Queue percentage bar */}
                      <div className="w-full bg-neutral-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-neutral-900 h-1.5 rounded-full transition-all"
                          style={{ width: `${Math.max(5, deptData.percentageOfQueue)}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
                        <span>{deptData.percentageOfQueue}% de la file d'attente globale</span>
                        <span>{deptData.totalHistorical} tickets historiques</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* PALMARÈS DES TECHNICIENS : QUI A LE PLUS ASSISTÉ & ÉTAT DE CHARGE */}
            <div className="p-5 rounded-md bg-white border border-neutral-200 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-neutral-700" />
                  <h2 className="text-sm font-semibold text-neutral-900">
                    Top Techniciens : Volume d'Assistance & Résolution
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={exportTopEmployeesCSV}
                  disabled={metrics.technicianLeaderboard.length === 0}
                  className="inline-flex items-center gap-1.5 rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t('Exporter le palmarès')}
                </button>
              </div>

              <p className="text-xs text-neutral-500">
                Classement des techniciens ayant résolu le plus de demandes et état de disponibilité en temps réel.
              </p>

              <div className="space-y-3">
                {metrics.technicianLeaderboard.length === 0 ? (
                  <div className="py-6 text-center text-xs text-neutral-500">
                    Aucun technicien enregistré pour le moment.
                  </div>
                ) : (
                  metrics.technicianLeaderboard.map((techData) => (
                    <div
                      key={techData.technicianId}
                      className="p-3 bg-neutral-50 border border-neutral-200 rounded-md text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-900">
                            {techData.technicianName}
                          </span>
                        </div>

                        <span
                          className={`font-mono text-[10px] px-2 py-0.5 rounded font-semibold border ${
                            techData.isBusy
                              ? 'bg-neutral-200 text-neutral-900 border-neutral-400'
                              : 'bg-white text-neutral-700 border-neutral-300'
                          }`}
                        >
                          {techData.isBusy ? 'Occupé (Charge max)' : 'Disponible'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 border-t border-neutral-200">
                        <div>
                          <span className="text-neutral-500 block text-[10px]">Demandes résolues</span>
                          <strong className="text-neutral-900 font-mono text-xs">{techData.resolvedCount}</strong>
                        </div>
                        <div>
                          <span className="text-neutral-500 block text-[10px]">En cours (Actifs)</span>
                          <strong className="text-neutral-900 font-mono text-xs">{techData.activeCount}</strong>
                        </div>
                        <div>
                          <span className="text-neutral-500 block text-[10px]">Conformité SLA</span>
                          <strong className="text-neutral-900 font-mono text-xs">{techData.slaComplianceRate}%</strong>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Unassigned Quick Dispatcher avec Filtres Département & Priorité */}
          <div className="p-5 rounded-md bg-white border border-neutral-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-neutral-200">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">
                  File d'Attente de Dispatching & Réaffectation ({unassignedTickets.length} non assignés)
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Affectez ou réaffectez rapidement les tickets aux techniciens disponibles.
                </p>
              </div>

              {/* Filtres de la file d'attente */}
              <div className="flex items-center gap-2">
                <select
                  value={dispatchDeptFilter}
                  onChange={(e) => setDispatchDeptFilter(e.target.value)}
                  className="bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1 text-xs text-neutral-800"
                >
                  <option value="ALL">Tous les départements</option>
                  {allDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>

                <select
                  value={dispatchPriorityFilter}
                  onChange={(e) => setDispatchPriorityFilter(e.target.value)}
                  className="bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1 text-xs text-neutral-800"
                >
                  <option value="ALL">Toutes priorités</option>
                  <option value="URGENT">Urgente</option>
                  <option value="HIGH">Haute</option>
                  <option value="MEDIUM">Moyenne</option>
                  <option value="LOW">Basse</option>
                </select>
              </div>
            </div>

            {filteredUnassignedTickets.length === 0 ? (
              <div className="py-4 text-center text-xs text-neutral-500">
                Aucun ticket en attente dans les critères de filtre sélectionnés.
              </div>
            ) : (
              <div className="divide-y divide-neutral-200 text-xs">
                {filteredUnassignedTickets.map((t) => (
                  <div key={t.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-neutral-500 text-[11px]">{t.ticketNumber}</span>
                        <span className="font-semibold text-neutral-900">{t.title}</span>
                        {t.isChefDeServiceRequest && (
                          <span className="font-mono text-[9px] bg-neutral-900 text-white px-1.5 py-0.2 rounded font-semibold inline-flex items-center gap-0.5">
                            <Zap className="w-2.5 h-2.5" /> Chef de Service
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-neutral-400">
                          {formatDate(t.createdAt)}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">
                        Demandeur : {t.createdByName} · Département : <strong>{t.department}</strong> · Priorité : {t.priority}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={selectedTech[t.id] || technicians[0]?.id || ''}
                        onChange={(e) => setSelectedTech({ ...selectedTech, [t.id]: e.target.value })}
                        className="bg-white border border-neutral-300 rounded px-2.5 py-1 text-xs text-neutral-900"
                      >
                        {technicians.map((tech) => (
                          <option key={tech.id} value={tech.id} disabled={tech.isBusy}>
                            {tech.fullName} ({tech.isBusy ? 'Occupé' : 'Libre'})
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => {
                          const selectedIsAvailable = availableTechnicians.some((tech) => tech.id === selectedTech[t.id]);
                          const techId = selectedIsAvailable ? selectedTech[t.id] : availableTechnicians[0]?.id;
                          if (techId) onAssignTicket(t.id, techId);
                        }}
                        disabled={availableTechnicians.length === 0}
                        className="px-3 py-1 font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors whitespace-nowrap"
                      >
                        Assigner
                      </button>

                      <button
                        onClick={() => onSelectTicket(t)}
                        className="px-2.5 py-1 text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded transition-colors whitespace-nowrap"
                      >
                        Détails
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: BUDGET & EXPENSIVE ASSET APPROVALS */}
      {activeAdminTab === 'approvals' && (
        <div className="p-5 rounded-md bg-white border border-neutral-200 space-y-4">
          <div className="pb-2 border-b border-neutral-200">
            <h2 className="text-sm font-semibold text-neutral-900">
              Arbitrage des Demandes Soumises à Approbation Budgétaire
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Les demandes de matériel supérieur à 500 000 FCFA ou d'acquisitions spécifiques doivent être approuvées par un administrateur avant prise en charge technique.
            </p>
          </div>

          {pendingApprovals.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-500">
              Aucune demande en attente d'approbation administrative pour le moment.
            </div>
          ) : (
            <div className="divide-y divide-neutral-200 space-y-4 text-xs">
              {pendingApprovals.map((t) => (
                <div key={t.id} className="pt-4 first:pt-0 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-neutral-500">{t.ticketNumber}</span>
                        <span className="font-semibold text-neutral-900 text-sm">{t.title}</span>
                      </div>
                      <div className="text-neutral-500">
                        Demandeur : <strong>{t.createdByName}</strong> · Département : {t.department} · Date : {formatDate(t.createdAt)}
                      </div>
                      <div className="p-2.5 bg-neutral-50 border border-neutral-200 rounded text-neutral-800 mt-1">
                        {t.description}
                      </div>
                    </div>

                    <div className="text-right shrink-0 bg-neutral-50 border border-neutral-200 p-3 rounded">
                      <span className="text-[11px] text-neutral-500 block">Montant Estimé</span>
                      <strong className="text-base font-mono tabular-nums text-neutral-900">
                        {(t.estimatedCost || 0).toLocaleString('fr-FR')} FCFA
                      </strong>
                    </div>
                  </div>

                  {/* Approval Actions */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                    <input
                      type="text"
                      placeholder="Commentaire de décision / Imputation budgétaire..."
                      value={approvalNotes[t.id] || ''}
                      onChange={(e) => setApprovalNotes({ ...approvalNotes, [t.id]: e.target.value })}
                      className="flex-1 bg-white border border-neutral-300 rounded px-3 py-1.5 text-xs text-neutral-900"
                    />

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onApproveBudget(t.id, approvalNotes[t.id] || 'Budget approuvé par la direction')}
                        className="px-3.5 py-1.5 font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors inline-flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approuver le Budget
                      </button>

                      <button
                        onClick={() => {
                          const reason = approvalNotes[t.id] || 'Demande refusée pour contrainte budgétaire';
                          onRejectTicket(t.id, reason);
                        }}
                        className="px-3.5 py-1.5 font-medium text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded transition-colors inline-flex items-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" />
                        Refuser la Demande
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: USERS & RBAC ROLES AVEC FILTRES COMPLETS ET SUPPORT CHEF DE SERVICE */}
      {activeAdminTab === 'users' && (
        <div className="p-5 rounded-md bg-white border border-neutral-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">
                Annuaire, Départements & Contrôle d'Accès (RBAC)
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Contrôle des permissions, affectation de direction et enregistrement des Chefs de Service.
              </p>
            </div>

            <button
              onClick={() => setIsNewUserModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Créer un Utilisateur / Chef de Service
            </button>
          </div>

          {/* User Filtering Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Filtrer par nom, email ou département..."
                className="w-full bg-neutral-50 border border-neutral-200 rounded pl-9 pr-3 py-1.5 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400"
              />
            </div>

            <select
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value)}
              className="bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1.5 text-neutral-800 focus:outline-none"
            >
              <option value="ALL">Tous les rôles</option>
              <option value="ADMIN">ADMIN (Supervision globale)</option>
              <option value="CHEF_DE_SUPPORT">CHEF_DE_SUPPORT (Chef de Support)</option>
              <option value="TECHNICIAN">TECHNICIAN (Support)</option>
              <option value="CHEF_DE_SERVICE">CHEF_DE_SERVICE (Prioritaire)</option>
              <option value="USER">USER (Collaborateur)</option>
            </select>

            <select
              value={userDeptFilter}
              onChange={(e) => setUserDeptFilter(e.target.value)}
              className="bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1.5 text-neutral-800 focus:outline-none"
            >
              <option value="ALL">Tous les départements</option>
              {allDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-md border border-neutral-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-600 font-mono text-[11px] uppercase border-b border-neutral-200">
                <tr>
                  <th className="py-2.5 px-3">Collaborateur</th>
                  <th className="py-2.5 px-3">Email Professionnel</th>
                  <th className="py-2.5 px-3">Département</th>
                  <th className="py-2.5 px-3">Dernière IP / activité</th>
                  <th className="py-2.5 px-3">Rôle RBAC</th>
                  <th className="py-2.5 px-3 text-center">Statut Compte</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-neutral-700">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-neutral-500">
                      Aucun utilisateur ne correspond aux critères de filtre.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-neutral-900">{u.fullName}</span>
                          {u.role === 'CHEF_DE_SERVICE' && (
                            <span className="font-mono text-[9px] bg-neutral-900 text-white px-1.5 py-0.2 rounded font-semibold inline-flex items-center gap-0.5">
                              <Zap className="w-2.5 h-2.5" /> Chef de Service
                            </span>
                          )}
                          {u.role === 'CHEF_DE_SUPPORT' && (
                            <span className="font-mono text-[9px] bg-neutral-900 text-white px-1.5 py-0.2 rounded font-semibold inline-flex items-center gap-0.5">
                              Chef de Support
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono">
                          {u.matricule ? `Matricule : ${u.matricule} · ` : ''}Inscrit le {formatDate(u.createdAt)}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-600">
                        {u.email}
                      </td>

                      <td className="py-2.5 px-3">
                        <select
                          value={u.department}
                          onChange={(e) => onUpdateUserDepartment(u.id, e.target.value)}
                          className="bg-transparent border border-transparent hover:border-neutral-300 focus:border-neutral-500 focus:bg-white rounded px-2 py-0.5 text-xs text-neutral-800"
                          title="Modifier le département"
                        >
                          {!departments.includes(u.department) && <option value={u.department}>{u.department}</option>}
                          {departments.map((department) => <option key={department} value={department}>{department}</option>)}
                        </select>
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="font-mono text-[11px] text-neutral-700">{u.lastIPAddress || '—'}</div>
                        <div className="mt-1 text-[10px] text-neutral-500">
                          {u.lastSeenAt ? formatDate(u.lastSeenAt) : 'Aucune activité enregistrée'}
                        </div>
                      </td>

                      <td className="py-2.5 px-3">
                        <select
                          value={u.role}
                          onChange={(e) => onUpdateUserRole(u.id, e.target.value as UserRole)}
                          className="bg-white border border-neutral-300 rounded px-2 py-1 text-xs text-neutral-900 font-medium"
                        >
                          <option value="USER">USER (Collaborateur)</option>
                          <option value="CHEF_DE_SERVICE">CHEF_DE_SERVICE (Demandes prioritaires)</option>
                          <option value="TECHNICIAN">TECHNICIAN (Support)</option>
                          <option value="CHEF_DE_SUPPORT">CHEF_DE_SUPPORT (Chef de Support & Réaffectation)</option>
                          <option value="ADMIN">ADMIN (Super Administrateur)</option>
                        </select>
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`text-[11px] font-medium ${
                            u.isActive ? 'text-neutral-900' : 'text-neutral-400 line-through'
                          }`}
                        >
                          {u.isActive ? 'Actif' : 'Suspendu'}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {currentUserRole === 'ADMIN' && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedUser(u);
                                  setNewUserPassword('');
                                  setConfirmUserPassword('');
                                  setPasswordError(null);
                                  setPasswordSuccess(null);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-50 rounded transition-colors"
                              >
                                <Eye className="w-3 h-3" />
                                Détails
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedUser(u);
                                  setNewUserPassword('');
                                  setConfirmUserPassword('');
                                  setPasswordError(null);
                                  setPasswordSuccess(null);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors"
                              >
                                <KeyRound className="w-3 h-3" />
                                Mot de passe
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => onToggleUserActive(u.id)}
                            className="px-2.5 py-1 text-[11px] font-medium text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded transition-colors"
                          >
                            {u.isActive ? 'Suspendre' : 'Réactiver'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOGS & COMPLIANCE */}
      {activeAdminTab === 'departments' && currentUserRole === 'ADMIN' && (
        <section className="space-y-4">
          <div className="rounded-md border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-semibold">{t('Départements / directions')}</h2>
            <p className="mt-1 text-xs text-neutral-500">{t('Le renommage est répercuté sur les comptes et les demandes. Un département utilisé ne peut pas être supprimé.')}</p>
            {departmentError && <p role="alert" className="mt-3 rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">{departmentError}</p>}
            <form onSubmit={handleCreateDepartment} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={departmentName}
                onChange={(event) => setDepartmentName(event.target.value)}
                maxLength={100}
                placeholder={t('Nom du département')}
                aria-label={t('Nom du département')}
                className="min-w-0 flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
                required
              />
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800">
                <Plus className="h-4 w-4" /> {t('Ajouter')}
              </button>
            </form>
          </div>
          <div className="divide-y divide-neutral-200 overflow-hidden rounded-md border border-neutral-200 bg-white">
            {departments.map((department) => (
              <div key={department} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                {editingDepartment === department ? (
                  <>
                    <input
                      value={editedDepartmentName}
                      onChange={(event) => setEditedDepartmentName(event.target.value)}
                      maxLength={100}
                      aria-label={`Nouveau nom pour ${department}`}
                      className="min-w-0 flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void handleRenameDepartment(department)} className="rounded bg-neutral-900 px-3 py-2 text-xs text-white">{t('Enregistrer')}</button>
                      <button type="button" onClick={() => setEditingDepartment(null)} className="rounded border border-neutral-300 px-3 py-2 text-xs">{t('Annuler')}</button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 text-sm">{department}</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setEditingDepartment(department); setEditedDepartmentName(department); }} className="rounded border border-neutral-300 px-3 py-2 text-xs hover:bg-neutral-50">{t('Modifier')}</button>
                      <button type="button" onClick={() => void handleDeleteDepartment(department)} className="rounded border border-rose-200 px-3 py-2 text-xs text-rose-700 hover:bg-rose-50">{t('Supprimer')}</button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {departments.length === 0 && <p className="p-5 text-center text-sm text-neutral-500">{t('Aucun département configuré.')}</p>}
          </div>
        </section>
      )}

      {/* TAB 4: AUDIT LOGS & COMPLIANCE */}
      {activeAdminTab === 'audit' && (
        <div className="p-5 rounded-md bg-white border border-neutral-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-200">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">
                Journal d'Audit Immuable de l'Entreprise (Security Log)
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Traçabilité des connexions, modifications de rôles, approbations budgétaires, réaffectations et résolutions.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={auditFilterUser}
                onChange={(e) => setAuditFilterUser(e.target.value)}
                className="bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1 text-xs text-neutral-800"
              >
                <option value="ALL">Tous les collaborateurs</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
              </select>

              <button
                onClick={exportAuditCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-50 rounded transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Exporter CSV
              </button>
            </div>
          </div>

          <div className="rounded-md border border-neutral-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 text-neutral-600 font-mono text-[11px] uppercase border-b border-neutral-200">
                <tr>
                  <th className="py-2.5 px-3">Horodatage</th>
                  <th className="py-2.5 px-3">Opérateur</th>
                  <th className="py-2.5 px-3">Rôle</th>
                  <th className="py-2.5 px-3">Action Système</th>
                  <th className="py-2.5 px-3">Détails de l'Événement</th>
                  <th className="py-2.5 px-3 text-right">Adresse IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-neutral-700">
                {filteredAuditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-500 whitespace-nowrap">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-neutral-900">
                      {log.userName}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-500">
                      {log.userRole}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] font-semibold text-neutral-900">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-800">
                      {log.details}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-[11px] text-neutral-400">
                      {log.ipAddress}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SLA POLICIES */}
      {activeAdminTab === 'sla' && (
        <div className="p-5 rounded-md bg-white border border-neutral-200 space-y-4">
          <div className="pb-2 border-b border-neutral-200">
            <h2 className="text-sm font-semibold text-neutral-900">
              Engagements de Service (SLA - Service Level Agreement)
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Délais maximaux de résolution contractuelle selon la gravité de la demande ou le statut du demandeur.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {slaPolicies.map((pol) => (
              <div key={pol.priority} className="p-4 bg-neutral-50 border border-neutral-200 rounded-md space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-900">Priorité : {pol.priority}</span>
                  <span className="text-neutral-500 font-mono text-[11px]">Objectif d'équipe</span>
                </div>

                <p className="text-neutral-600 text-[11px]">{pol.description}</p>

                <div className="flex items-center gap-2 pt-2 border-t border-neutral-200">
                  <label className="text-neutral-600 font-medium">Délai max :</label>
                  <input
                    type="number"
                    min="1"
                    defaultValue={pol.maxHours}
                    onBlur={(e) => onUpdateSla(pol.priority, parseInt(e.target.value) || pol.maxHours)}
                    className="w-20 bg-white border border-neutral-300 rounded px-2 py-1 font-mono text-xs text-neutral-900"
                  />
                  <span className="text-neutral-600">heures ouvrées</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Create User / Chef de Service */}
      {isNewUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-md bg-white border border-neutral-300 rounded-md shadow-sm overflow-hidden text-neutral-900">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200">
              <h2 className="text-sm font-semibold text-neutral-900">
                Créer un Utilisateur ou Chef de Service
              </h2>
              <button onClick={() => setIsNewUserModalOpen(false)} className="text-neutral-400 hover:text-neutral-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="p-5 space-y-3.5 text-xs">
              {newUserError && (
                <div className="p-2 rounded bg-neutral-100 border border-neutral-300 text-neutral-800">
                  {newUserError}
                </div>
              )}

              <div>
                <label className="block text-neutral-600 font-medium mb-1">Nom complet</label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="Ex: David Meunier"
                  className="w-full bg-white border border-neutral-300 rounded px-3 py-1.5 text-neutral-900"
                  required
                />
              </div>

              <div>
                <label className="block text-neutral-600 font-medium mb-1">Email professionnel</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="david@deskflow.io"
                  className="w-full bg-white border border-neutral-300 rounded px-3 py-1.5 font-mono text-neutral-900"
                  required
                />
              </div>

              <div>
                <label className="block text-neutral-600 font-medium mb-1">Département / Direction</label>
                <select
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  className="w-full bg-white border border-neutral-300 rounded px-3 py-1.5 text-neutral-900"
                  required
                >
                  {departments.map((department) => <option key={department} value={department}>{department}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-neutral-600 font-medium mb-1">Rôle initial attribué</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full bg-white border border-neutral-300 rounded px-3 py-1.5 text-neutral-900"
                >
                  <option value="USER">USER (Collaborateur)</option>
                  <option value="CHEF_DE_SERVICE">CHEF DE SERVICE (Demandes prioritaires automatiques)</option>
                  <option value="TECHNICIAN">TECHNICIAN (Technicien support)</option>
                  <option value="CHEF_DE_SUPPORT">CHEF DE SUPPORT (Supervision & Réaffectation)</option>
                  <option value="ADMIN">ADMIN (Super Administrateur IT)</option>
                </select>
                {newRole === 'CHEF_DE_SERVICE' && (
                  <p className="mt-1 text-[10px] text-neutral-500">
                    ⚡ Toutes les demandes déclarées par ce chef de service seront automatiquement enregistrées avec une priorité URGENT.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
                <button
                  type="button"
                  onClick={() => setIsNewUserModalOpen(false)}
                  className="px-3.5 py-1.5 text-neutral-600 hover:text-neutral-900 font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors"
                >
                  Créer le Compte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedUser && currentUserRole === 'ADMIN' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-md border border-neutral-300 bg-white text-neutral-900 shadow-lg">
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3.5">
              <div>
                <h2 className="text-sm font-semibold">Informations du compte</h2>
                <p className="mt-0.5 text-xs text-neutral-500">{selectedUser.fullName}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                aria-label="Fermer"
                className="text-neutral-400 hover:text-neutral-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-5 text-xs">
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><dt className="text-neutral-500">Identifiant du compte</dt><dd className="mt-0.5 break-all font-mono">{selectedUser.id}</dd></div>
                <div><dt className="text-neutral-500">Matricule</dt><dd className="mt-0.5">{selectedUser.matricule || 'Non renseigné'}</dd></div>
                <div><dt className="text-neutral-500">Nom complet</dt><dd className="mt-0.5">{selectedUser.fullName}</dd></div>
                <div><dt className="text-neutral-500">E-mail</dt><dd className="mt-0.5 break-all">{selectedUser.email}</dd></div>
                <div><dt className="text-neutral-500">Département</dt><dd className="mt-0.5">{selectedUser.department}</dd></div>
                <div><dt className="text-neutral-500">Rôle</dt><dd className="mt-0.5">{selectedUser.role}</dd></div>
                <div><dt className="text-neutral-500">État du compte</dt><dd className="mt-0.5">{selectedUser.isActive ? 'Actif' : 'Suspendu'}</dd></div>
                <div><dt className="text-neutral-500">Date de création</dt><dd className="mt-0.5">{formatDate(selectedUser.createdAt)}</dd></div>
              </dl>
              <p className="rounded border border-neutral-200 bg-neutral-50 p-2 text-[11px] text-neutral-600">
                Le mot de passe actuel et son empreinte ne sont jamais affichés.
              </p>
              <form onSubmit={handleSetUserPassword} className="space-y-3 border-t border-neutral-200 pt-4">
                <h3 className="font-semibold">Définir un nouveau mot de passe</h3>
                {passwordError && <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-2 text-rose-800">{passwordError}</p>}
                {passwordSuccess && <p role="status" className="rounded border border-emerald-200 bg-emerald-50 p-2 text-emerald-800">{passwordSuccess}</p>}
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newUserPassword}
                  onChange={(event) => setNewUserPassword(event.target.value)}
                  placeholder="Nouveau mot de passe (8 caractères minimum)"
                  className="w-full rounded border border-neutral-300 px-3 py-2 font-mono"
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmUserPassword}
                  onChange={(event) => setConfirmUserPassword(event.target.value)}
                  placeholder="Confirmer le nouveau mot de passe"
                  className="w-full rounded border border-neutral-300 px-3 py-2 font-mono"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setSelectedUser(null)} className="rounded border border-neutral-300 px-3 py-1.5">
                    Fermer
                  </button>
                  <button type="submit" disabled={isChangingPassword} className="rounded bg-neutral-900 px-3 py-1.5 font-medium text-white disabled:opacity-60">
                    {isChangingPassword ? 'Enregistrement…' : 'Mettre à jour'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
