import {
  User,
  AuthSession,
  Ticket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  UserRole,
  SystemMetrics,
  AuditLogEntry,
  SlaPolicy,
  DepartmentQueueRanking,
  TechnicianLeaderboardEntry,
  TicketAttachment,
} from '../types';
import { apiRequest, setAccessToken } from './api';

export const INITIAL_SLA_POLICIES: SlaPolicy[] = [
  { priority: 'URGENT', maxHours: 2, description: 'Interruption critique ou demande Chef de Service' },
  { priority: 'HIGH', maxHours: 8, description: 'Gêne opérationnelle majeure sans contournement' },
  { priority: 'MEDIUM', maxHours: 24, description: 'Demande standard de service ou matériel' },
  { priority: 'LOW', maxHours: 72, description: 'Demande mineure ou amélioration non bloquante' },
];

export const INITIAL_DEPARTMENTS: string[] = [
  'Direction des Systèmes d\'Information (DSI)',
  'Direction Financière & Comptabilité',
  'Direction des Ressources Humaines',
  'Direction Commerciale & Marketing',
  'Direction des Opérations & Logistique',
  'Support & Infrastructure IT',
  'Direction Juridique & Conformité',
  'Direction Audit & Contrôle de Gestion',
];

type APIUser = {
  id: string;
  full_name: string;
  email: string;
  matricule: string;
  role: UserRole;
  department: string;
  is_active: boolean;
  created_at: string;
  last_ip_address?: string;
  last_seen_at?: string;
};

type APITicket = {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  category: TicketCategory;
  request_language?: 'fr' | 'en';
  priority: TicketPriority;
  status: TicketStatus;
  created_by_id: string;
  assigned_to_id?: string;
  department: string;
  created_at: string;
  updated_at: string;
  sla_deadline: string;
  resolved_at?: string;
  estimated_cost: number;
  requires_approval: boolean;
  approval_notes?: string;
  created_by?: APIUser;
  assigned_to?: APIUser;
  attachments?: Array<{
    id: string;
    file_name: string;
    content_type: string;
    size: number;
  }>;
};

type APISLAPolicy = {
  priority: TicketPriority;
  max_hours: number;
  description: string;
};

type APIAuditLog = {
  id: string;
  timestamp: string;
  user_id: string;
  user_name: string;
  user_role: UserRole;
  action: string;
  target_type: AuditLogEntry['targetType'];
  target_id: string;
  details: string;
  ip_address: string;
};

function mapUser(user: APIUser): User {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    matricule: user.matricule,
    role: user.role,
    department: user.department,
    isActive: user.is_active,
    createdAt: user.created_at,
    lastIPAddress: user.last_ip_address,
    lastSeenAt: user.last_seen_at,
  };
}

function mapTicket(ticket: APITicket, slaPolicies: SlaPolicy[] = INITIAL_SLA_POLICIES): Ticket {
  const maxHours = slaPolicies.find((policy) => policy.priority === ticket.priority)?.maxHours || 24;
  return {
    id: ticket.id,
    ticketNumber: ticket.ticket_number,
    title: ticket.title,
    description: ticket.description,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    createdById: ticket.created_by_id,
    createdByName: ticket.created_by?.full_name || '',
    createdByRole: ticket.created_by?.role,
    department: ticket.department,
    requestLanguage: ticket.request_language === 'en' ? 'en' : 'fr',
    assignedToId: ticket.assigned_to_id,
    assignedToName: ticket.assigned_to?.full_name,
    estimatedCost: ticket.estimated_cost,
    requiresApproval: ticket.requires_approval,
    approvalNotes: ticket.approval_notes,
    slaDeadline: ticket.sla_deadline || new Date(new Date(ticket.created_at).getTime() + maxHours * 3600000).toISOString(),
    resolvedAt: ticket.resolved_at,
    comments: [],
    history: [],
    attachments: (ticket.attachments || []).map((attachment): TicketAttachment => ({
      id: attachment.id,
      fileName: attachment.file_name,
      contentType: attachment.content_type,
      size: attachment.size,
    })),
    createdAt: ticket.created_at,
    updatedAt: ticket.updated_at,
  };
}

export const sortTicketsByDeadline = (a: Ticket, b: Ticket): number => {
  return new Date(a.slaDeadline).getTime() - new Date(b.slaDeadline).getTime();
};

export const computeTechnicalQualification = (
  category: TicketCategory,
  userPriority: TicketPriority,
  isChefDeService: boolean
): { technicalQualification: string; technicalLevel: 'P1' | 'P2' | 'P3' | 'P4' } => {
  if (isChefDeService) {
    return { technicalQualification: 'P1 - Urgence Hiérarchique Direction (Priorité Absolue)', technicalLevel: 'P1' };
  }
  if (category === 'ACCESS') {
    return userPriority === 'URGENT' || userPriority === 'HIGH'
      ? { technicalQualification: 'P1 - Incident Critique Sécurité & Identités Numériques', technicalLevel: 'P1' }
      : { technicalQualification: 'P3 - Habilitations & Gestion des Droits Applicatifs', technicalLevel: 'P3' };
  }
  if (category === 'NETWORK') {
    return userPriority === 'URGENT' || userPriority === 'HIGH'
      ? { technicalQualification: 'P1 - Incident Majeur Infrastructure & Passerelle Réseau', technicalLevel: 'P1' }
      : { technicalQualification: 'P2 - Connectivité Locale & Équipements Réseau', technicalLevel: 'P2' };
  }
  if (category === 'HARDWARE') {
    return userPriority === 'URGENT' || userPriority === 'HIGH'
      ? { technicalQualification: 'P2 - Défaillance Matérielle Poste Métier Bloquante', technicalLevel: 'P2' }
      : { technicalQualification: 'P3 - Demande d\'Équipement & Approvisionnement Matériel', technicalLevel: 'P3' };
  }
  if (category === 'SOFTWARE') {
    if (userPriority === 'URGENT') {
      return { technicalQualification: 'P1 - Interruption Applicatif Métier de Production', technicalLevel: 'P1' };
    }
    return userPriority === 'HIGH'
      ? { technicalQualification: 'P2 - Dysfonctionnement Logiciel Majeur', technicalLevel: 'P2' }
      : { technicalQualification: 'P3 - Support Applicatif & Outils Bureautiques', technicalLevel: 'P3' };
  }
  return userPriority === 'URGENT' || userPriority === 'HIGH'
    ? { technicalQualification: 'P2 - Demande d\'Assistance Opérationnelle Prioritaire', technicalLevel: 'P2' }
    : { technicalQualification: 'P4 - Requête Standard & Maintenance Courante', technicalLevel: 'P4' };
};

class DeskFlowStore {
  private users: User[] = [];
  private tickets: Ticket[] = [];
  private departments: string[] = [];
  private auditLogs: AuditLogEntry[] = [];
  private slaPolicies: SlaPolicy[] = [];
  private session: AuthSession | null = null;
  private listeners = new Set<() => void>();
  private isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

  constructor() {
    this.initNetworkListeners();
    this.loadSession();
  }

  public async initialize() {
    await this.refreshDepartments();
    if (!this.session || this.session.expiresAt <= Date.now()) {
      this.session = null;
      setAccessToken(null);
      this.saveSession();
      return;
    }

    setAccessToken(this.session.token);
    try {
      const { user } = await apiRequest<{ user: APIUser }>('/auth/me');
      this.session.user = mapUser(user);
      await this.refreshFromAPI();
      this.saveSession();
    } catch (error) {
      this.session = null;
      setAccessToken(null);
      this.saveSession();
      throw error;
    }
  }

  private loadSession() {
    try {
      const stored = sessionStorage.getItem('deskflow_session_v4');
      this.session = stored ? JSON.parse(stored) : null;
      for (const key of [
        'deskflow_users_v3',
        'deskflow_tickets_v3',
        'deskflow_audit_v3',
        'deskflow_session_v3',
      ]) {
        localStorage.removeItem(key);
      }
      if (this.session) setAccessToken(this.session.token);
    } catch (error) {
      console.error('Erreur de lecture de la session:', error);
      this.session = null;
      setAccessToken(null);
    }
  }

  private saveSession() {
    if (this.session) sessionStorage.setItem('deskflow_session_v4', JSON.stringify(this.session));
    else sessionStorage.removeItem('deskflow_session_v4');
    this.notify();
  }

  private async refreshFromAPI() {
    if (this.session?.user.role === 'ADMIN') {
      const [userResponse, slaResponse, auditResponse] = await Promise.all([
        apiRequest<{ users: APIUser[] }>('/admin/users'),
        apiRequest<{ policies: APISLAPolicy[] }>('/admin/sla'),
        apiRequest<{ logs: APIAuditLog[] }>('/admin/audit'),
      ]);
      this.users = userResponse.users.map(mapUser);
      this.slaPolicies = slaResponse.policies.map((policy) => ({
        priority: policy.priority,
        maxHours: policy.max_hours,
        description: policy.description,
      }));
      this.auditLogs = auditResponse.logs.map((log) => ({
        id: log.id,
        timestamp: log.timestamp,
        userId: log.user_id,
        userName: log.user_name,
        userRole: log.user_role,
        action: log.action,
        targetType: log.target_type,
        targetId: log.target_id,
        details: log.details,
        ipAddress: log.ip_address,
      }));
    } else if (this.session?.user.role === 'CHEF_DE_SUPPORT') {
      const userResponse = await apiRequest<{ users: APIUser[] }>('/admin/technicians');
      this.users = [this.session.user, ...userResponse.users.map(mapUser)];
    } else if (this.session) {
      this.users = [this.session.user];
    }
    const ticketResponse = await apiRequest<{ tickets: APITicket[] }>('/tickets');
    this.tickets = ticketResponse.tickets.map((ticket) => mapTicket(ticket, this.slaPolicies));
    this.users = this.users.map((user) => {
      if (user.role !== 'TECHNICIAN') return user;
      return {
        ...user,
        isBusy: this.tickets.some(
          (ticket) =>
            ticket.assignedToId === user.id &&
            (ticket.status === 'ASSIGNED' || ticket.status === 'IN_PROGRESS')
        ),
      };
    });
    this.notify();
  }

  public async refresh(): Promise<void> {
    await this.refreshFromAPI();
    await this.refreshDepartments();
  }

  public async refreshTickets(): Promise<void> {
    await this.refreshFromAPI();
  }

  private async refreshDepartments(): Promise<void> {
    const response = await apiRequest<{ departments: Array<{ name: string }> }>('/departments');
    this.departments = response.departments.map((department) => department.name);
    this.notify();
  }

  public getDepartments(): string[] {
    return [...this.departments];
  }

  public async createDepartment(name: string): Promise<void> {
    await apiRequest('/admin/departments', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim() }),
    });
    await this.refreshDepartments();
  }

  public async renameDepartment(oldName: string, newName: string): Promise<void> {
    await apiRequest(`/admin/departments/${encodeURIComponent(oldName)}`, {
      method: 'PUT',
      body: JSON.stringify({ new_name: newName.trim() }),
    });
    await this.refreshDepartments();
    await this.refreshFromAPI();
  }

  public async deleteDepartment(name: string): Promise<void> {
    await apiRequest(`/admin/departments/${encodeURIComponent(name)}`, { method: 'DELETE' });
    await this.refreshDepartments();
  }

  private initNetworkListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notify();
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notify();
    });
  }

  public getIsOnline(): boolean {
    return this.isOnline;
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  public getSession(): AuthSession | null {
    return this.session;
  }

  public getCurrentUser(): User | null {
    return this.session?.user || null;
  }

  public async updateProfile(updates: {
    fullName: string;
    email: string;
  }): Promise<void> {
    if (!this.session) throw new Error('Authentification requise.');
    const response = await apiRequest<{ user: APIUser }>('/auth/me/profile', {
      method: 'PUT',
      body: JSON.stringify({
        full_name: updates.fullName.trim(),
        email: updates.email.trim().toLowerCase(),
      }),
    });
    const user = mapUser(response.user);
    this.session.user = user;
    this.users = this.users.map((candidate) => (candidate.id === user.id ? user : candidate));
    this.saveSession();
  }

  public async setUserPassword(userId: string, password: string): Promise<void> {
    const admin = this.getCurrentUser();
    if (!admin || admin.role !== 'ADMIN') throw new Error('Action réservée aux administrateurs.');
    await apiRequest(`/admin/users/${userId}/password`, {
      method: 'PUT',
      body: JSON.stringify({ password }),
    });
  }

  public async requestPasswordReset(email: string): Promise<void> {
    await apiRequest('/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
  }

  public async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    await apiRequest('/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        code: code.trim(),
        new_password: newPassword,
      }),
    });
  }

  public async getCategorySLA(category: TicketCategory): Promise<SlaPolicy> {
    const response = await apiRequest<{ policy: APISLAPolicy }>(`/tickets/sla/${category}`);
    return {
      priority: response.policy.priority,
      maxHours: response.policy.max_hours,
      description: response.policy.description,
    };
  }

  public async login(identifier: string, password?: string): Promise<boolean> {
    try {
      const { user, token } = await apiRequest<{ user: APIUser; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim(), password: password || '' }),
      });
      setAccessToken(token);
      this.session = {
        token,
        user: mapUser(user),
        expiresAt: Date.now() + 12 * 60 * 60 * 1000,
      };
      await this.refreshFromAPI();
      this.saveSession();
      return true;
    } catch (error) {
      if (error instanceof Error && error.message !== 'identifiants invalides' && error.message !== 'compte utilisateur inactif') {
        throw error;
      }
      return false;
    }
  }

  public async register(
    fullName: string,
    email: string,
    department: string,
    password: string,
    matricule?: string
  ): Promise<User> {
    const { user, token } = await apiRequest<{ user: APIUser; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        department: department.trim(),
        matricule: matricule?.trim().toUpperCase(),
      }),
    });
    setAccessToken(token);
    this.session = {
      token,
      user: mapUser(user),
      expiresAt: Date.now() + 12 * 60 * 60 * 1000,
    };
    await this.refreshFromAPI();
    this.saveSession();
    return this.session.user;
  }

  public logout() {
    this.session = null;
    setAccessToken(null);
    this.users = [];
    this.tickets = [];
    this.saveSession();
  }

  public getTickets(): Ticket[] {
    const user = this.getCurrentUser();
    if (!user) return [];
    if (user.role === 'ADMIN' || user.role === 'CHEF_DE_SUPPORT') {
      return [...this.tickets].sort(sortTicketsByDeadline);
    }

    if (user.role === 'TECHNICIAN') {
      return this.tickets
        .filter((ticket) => ticket.assignedToId === user.id || ticket.status === 'PENDING')
        .sort(sortTicketsByDeadline);
    }
    if (user.role === 'CHEF_DE_SERVICE') {
      return this.tickets
        .filter(
          (ticket) =>
            ticket.createdById === user.id ||
            ticket.department.trim().toLowerCase() === user.department.trim().toLowerCase()
        )
        .sort(sortTicketsByDeadline);
    }
    return this.tickets
      .filter((ticket) => ticket.createdById === user.id)
      .sort(sortTicketsByDeadline);
  }

  public async getTicket(ticketId: string): Promise<Ticket> {
    const response = await apiRequest<{
      ticket: APITicket;
      comments: Array<{ id: string; ticket_id: string; user_id: string; content: string; created_at: string; user?: APIUser }>;
      history: Array<{
        id: string;
        ticket_id: string;
        user_id: string;
        action: string;
        old_status?: TicketStatus;
        new_status?: TicketStatus;
        notes: string;
        created_at: string;
        user?: APIUser;
      }>;
    }>(`/tickets/${ticketId}`);
    const ticket = mapTicket(response.ticket, this.slaPolicies);
    ticket.comments = response.comments.map((comment) => ({
      id: comment.id,
      ticketId: comment.ticket_id,
      userId: comment.user_id,
      userName: comment.user?.full_name || '',
      userRole: comment.user?.role || 'USER',
      content: comment.content,
      createdAt: comment.created_at,
    }));
    ticket.history = response.history.map((entry) => ({
      id: entry.id,
      ticketId: entry.ticket_id,
      userId: entry.user_id,
      userName: entry.user?.full_name || '',
      action: entry.action,
      oldStatus: entry.old_status,
      newStatus: entry.new_status,
      notes: entry.notes,
      createdAt: entry.created_at,
    }));
    return ticket;
  }

  public getTechnicianWorkload(technicianId: string): { activeCount: number; isBusy: boolean } {
    const activeCount = this.tickets.filter(
      (ticket) =>
        ticket.assignedToId === technicianId &&
        (ticket.status === 'ASSIGNED' || ticket.status === 'IN_PROGRESS')
    ).length;
    return { activeCount, isBusy: activeCount >= 1 };
  }

  public findAvailableTechnician(excludeTechId?: string): User | null {
    const candidates = this.users.filter(
      (user) =>
        user.isActive &&
        user.role === 'TECHNICIAN' &&
        user.id !== excludeTechId &&
        !this.getTechnicianWorkload(user.id).isBusy
    );
    return candidates[0] || null;
  }

  public async reassignToAvailableColleague(ticketId: string): Promise<{
    success: boolean;
    reassignedTo?: User;
    message: string;
  }> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Authentification requise');
    if (!['CHEF_DE_SERVICE', 'CHEF_DE_SUPPORT', 'ADMIN'].includes(user.role)) {
      throw new Error('Action non autorisée.');
    }
    const ticket = this.tickets.find((candidate) => candidate.id === ticketId);
    if (!ticket) throw new Error('Ticket introuvable');
    const technician = this.findAvailableTechnician(ticket.assignedToId);
    if (!technician) {
      return { success: false, message: 'Aucun technicien disponible.' };
    }

    await apiRequest(`/admin/tickets/${ticketId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ technician_id: technician.id }),
    });
    await this.refreshFromAPI();
    return { success: true, reassignedTo: technician, message: `Réaffecté à ${technician.fullName}.` };
  }

  public async acceptTicket(ticketId: string) {
    const user = this.getCurrentUser();
    if (!user || user.role !== 'TECHNICIAN') {
      throw new Error('Action réservée aux techniciens.');
    }
    const ticket = this.tickets.find((candidate) => candidate.id === ticketId);
    if (!ticket) throw new Error('Ticket introuvable');
    if (ticket.status !== 'ASSIGNED') throw new Error('Ce ticket n’est pas en attente de validation.');
    if (ticket.assignedToId && ticket.assignedToId !== user.id) {
      throw new Error('Ce ticket est assigné à un autre collaborateur.');
    }
    await apiRequest(`/tickets/${ticketId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'IN_PROGRESS' }),
    });
    await this.refreshFromAPI();
  }

  public async createTicket(params: {
    title: string;
    description: string;
    category: TicketCategory;
    estimatedCost?: number;
    images?: File[];
  }): Promise<Ticket> {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Authentification requise');
    const formData = new FormData();
    formData.append('title', params.title.trim());
    formData.append('description', params.description.trim());
    formData.append('category', params.category);
    formData.append('request_language', localStorage.getItem('deskflow-language') === 'en' ? 'en' : 'fr');
    formData.append('request_utc_offset_minutes', String(new Date().getTimezoneOffset()));
    formData.append('estimated_cost', String(params.estimatedCost || 0));
    params.images?.forEach((image) => formData.append('images', image));
    const response = await apiRequest<{ ticket: APITicket }>('/tickets', {
      method: 'POST',
      body: formData,
    });
    await this.refreshFromAPI();
    return mapTicket(response.ticket, this.slaPolicies);
  }

  public async approveBudget(ticketId: string, approvalNotes: string) {
    const user = this.getCurrentUser();
    if (!user || user.role !== 'ADMIN') throw new Error('Action réservée aux administrateurs.');
    const ticket = this.tickets.find((candidate) => candidate.id === ticketId);
    if (!ticket) throw new Error('Ticket introuvable');
    if (ticket.status !== 'PENDING_APPROVAL') throw new Error('Ce ticket ne nécessite pas d’approbation.');
    await apiRequest(`/admin/tickets/${ticketId}/approval`, {
      method: 'POST',
      body: JSON.stringify({ approved: true, notes: approvalNotes }),
    });
    await this.refreshFromAPI();
  }

  public async rejectTicket(ticketId: string, reason: string) {
    const user = this.getCurrentUser();
    if (!user || user.role !== 'ADMIN') throw new Error('Action réservée aux administrateurs.');
    const ticket = this.tickets.find((candidate) => candidate.id === ticketId);
    if (!ticket) throw new Error('Ticket introuvable');
    await apiRequest(`/admin/tickets/${ticketId}/approval`, {
      method: 'POST',
      body: JSON.stringify({ approved: false, notes: reason }),
    });
    await this.refreshFromAPI();
  }

  public async updateTicketStatus(ticketId: string, newStatus: TicketStatus, notes: string) {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Authentification requise');
    const ticket = this.tickets.find((candidate) => candidate.id === ticketId);
    if (!ticket) throw new Error('Ticket introuvable');
    if (user.role === 'USER' || user.role === 'CHEF_DE_SERVICE') {
      const canClose = ticket.status === 'RESOLVED' && newStatus === 'CLOSED';
      const canReopen = (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') && newStatus === 'PENDING';
      if (ticket.createdById !== user.id || (!canClose && !canReopen)) {
        throw new Error('Vous ne pouvez clôturer ou relancer que vos propres demandes résolues.');
      }
    } else if (user.role === 'TECHNICIAN' && ticket.assignedToId !== user.id) {
      throw new Error('Vous ne pouvez modifier que les tickets qui vous sont assignés.');
    }
    await apiRequest(`/tickets/${ticketId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus, notes }),
    });
    await this.refreshFromAPI();
  }

  public async takeTicket(ticketId: string) {
    const user = this.getCurrentUser();
    if (!user || (user.role !== 'TECHNICIAN' && user.role !== 'ADMIN')) {
      throw new Error('Action réservée aux techniciens et administrateurs.');
    }
    const ticket = this.tickets.find((candidate) => candidate.id === ticketId);
    if (!ticket) throw new Error('Ticket introuvable');
    if (ticket.status !== 'PENDING' || ticket.assignedToId) throw new Error('Ce ticket n’est plus disponible.');
    try {
      await apiRequest(`/tickets/${ticketId}/take`, { method: 'POST' });
    } catch (error) {
      if (error instanceof Error && error.message === 'ce technicien traite déjà une demande non résolue') {
        throw new Error('Vous devez terminer votre demande actuelle avant d’en prendre une autre.');
      }
      if (error instanceof Error && error.message === 'vous devez prendre la demande prioritaire la plus ancienne de la file') {
        throw new Error('Prenez d’abord la demande prioritaire la plus ancienne de la file.');
      }
      throw error;
    }
    await this.refreshFromAPI();
  }

  public async assignTicket(ticketId: string, technicianId: string) {
    const user = this.getCurrentUser();
    if (!user || (user.role !== 'ADMIN' && user.role !== 'CHEF_DE_SUPPORT')) {
      throw new Error('Seul le Chef de Support ou un Administrateur peut assigner un ticket.');
    }
    await apiRequest(`/admin/tickets/${ticketId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ technician_id: technicianId }),
    });
    await this.refreshFromAPI();
  }

  public async deleteTicket(ticketId: string) {
    const user = this.getCurrentUser();
    if (!user || user.role !== 'ADMIN') throw new Error('Action réservée aux administrateurs.');
    await apiRequest(`/admin/tickets/${ticketId}`, { method: 'DELETE' });
    await this.refreshFromAPI();
  }

  public async addComment(ticketId: string, content: string) {
    const user = this.getCurrentUser();
    if (!user) throw new Error('Authentification requise');
    if (!content.trim()) throw new Error('Le commentaire ne peut pas être vide.');
    await apiRequest(`/tickets/${ticketId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content: content.trim() }),
    });
    const updated = await this.getTicket(ticketId);
    this.tickets = this.tickets.map((ticket) => (ticket.id === ticketId ? updated : ticket));
    this.notify();
  }

  public getUsers(): User[] {
    return [...this.users];
  }

  public async createUser(params: {
    fullName: string;
    email: string;
    department: string;
    role: UserRole;
    matricule?: string;
  }): Promise<User> {
    const admin = this.getCurrentUser();
    if (!admin || admin.role !== 'ADMIN') throw new Error('Action réservée aux administrateurs.');
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    const temporaryPassword = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, 'x');
    const response = await apiRequest<{ user: APIUser }>('/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        full_name: params.fullName.trim(),
        email: params.email.trim().toLowerCase(),
        department: params.department.trim(),
        role: params.role,
        password: temporaryPassword,
        matricule: params.matricule,
      }),
    });
    await this.refreshFromAPI();
    return { ...mapUser(response.user), password: temporaryPassword };
  }

  public async updateUserRole(userId: string, newRole: UserRole) {
    const admin = this.getCurrentUser();
    if (!admin || admin.role !== 'ADMIN') throw new Error('Action réservée aux administrateurs.');
    await apiRequest(`/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role: newRole }),
    });
    await this.refreshFromAPI();
  }

  public async updateUserDepartment(userId: string, department: string) {
    const admin = this.getCurrentUser();
    if (!admin || admin.role !== 'ADMIN') throw new Error('Action réservée aux administrateurs.');
    await apiRequest(`/admin/users/${userId}/department`, {
      method: 'PUT',
      body: JSON.stringify({ department: department.trim() }),
    });
    await this.refreshFromAPI();
  }

  public async toggleUserActive(userId: string) {
    const admin = this.getCurrentUser();
    if (!admin || admin.role !== 'ADMIN') throw new Error('Action réservée aux administrateurs.');
    await apiRequest(`/admin/users/${userId}/active`, { method: 'PATCH' });
    await this.refreshFromAPI();
  }

  public getSlaPolicies(): SlaPolicy[] {
    return [...this.slaPolicies];
  }

  public async updateSlaPolicy(priority: TicketPriority, maxHours: number) {
    const admin = this.getCurrentUser();
    if (!admin || admin.role !== 'ADMIN') throw new Error('Action réservée aux administrateurs.');
    if (!Number.isFinite(maxHours) || maxHours <= 0) throw new Error('Durée SLA invalide.');
    const policy = this.slaPolicies.find((item) => item.priority === priority);
    if (!policy) throw new Error('Politique SLA introuvable.');
    await apiRequest(`/admin/sla/${priority}`, {
      method: 'PUT',
      body: JSON.stringify({ max_hours: maxHours, description: policy.description }),
    });
    await this.refreshFromAPI();
  }

  public getAuditLogs(): AuditLogEntry[] {
    return [...this.auditLogs];
  }

  public getMetrics(): SystemMetrics {
    const totalTickets = this.tickets.length;
    const activeTickets = this.tickets.filter(
      (ticket) => !['RESOLVED', 'CLOSED', 'REJECTED'].includes(ticket.status)
    );
    const unresolved = activeTickets.length;
    const now = Date.now();
    const slaBreachedTickets = activeTickets.filter(
      (ticket) => new Date(ticket.slaDeadline).getTime() < now
    ).length;
    const resolved = this.tickets.filter((ticket) => ticket.status === 'RESOLVED' || ticket.status === 'CLOSED');
    const resolutionHours = resolved
      .map((ticket) => (new Date(ticket.updatedAt).getTime() - new Date(ticket.createdAt).getTime()) / 3600000)
      .filter((hours) => hours >= 0);
    const byDepartment: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    for (const ticket of this.tickets) {
      byDepartment[ticket.department] = (byDepartment[ticket.department] || 0) + 1;
      byCategory[ticket.category] = (byCategory[ticket.category] || 0) + 1;
    }

    const departments = new Map<string, Ticket[]>();
    for (const ticket of activeTickets) {
      const queue = departments.get(ticket.department) || [];
      queue.push(ticket);
      departments.set(ticket.department, queue);
    }
    const departmentQueueRanking: DepartmentQueueRanking[] = Array.from(departments.entries())
      .map(([department, queue]) => ({
        department,
        queueCount: queue.length,
        urgentCount: queue.filter((ticket) => ticket.priority === 'URGENT').length,
        totalHistorical: this.tickets.filter((ticket) => ticket.department === department).length,
        percentageOfQueue: unresolved ? (queue.length / unresolved) * 100 : 0,
      }))
      .sort((a, b) => b.queueCount - a.queueCount);

    const technicians = this.users.filter((user) => user.role === 'TECHNICIAN' && user.isActive);
    const technicianLeaderboard: TechnicianLeaderboardEntry[] = technicians
      .map((technician) => {
        const assigned = this.tickets.filter((ticket) => ticket.assignedToId === technician.id);
        const activeCount = assigned.filter(
          (ticket) => ticket.status === 'ASSIGNED' || ticket.status === 'IN_PROGRESS'
        ).length;
        const technicianResolved = assigned.filter(
          (ticket) => ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'
        ).length;
        const breached = assigned.filter(
          (ticket) =>
            (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') &&
            new Date(ticket.resolvedAt || ticket.updatedAt).getTime() > new Date(ticket.slaDeadline).getTime()
        ).length;
        const done = technicianResolved;
        return {
          technicianId: technician.id,
          technicianName: technician.fullName,
          resolvedCount: technicianResolved,
          activeCount,
          isBusy: activeCount >= 1,
          slaComplianceRate: done ? ((done - breached) / done) * 100 : 100,
        };
      })
      .sort((a, b) => b.resolvedCount - a.resolvedCount);

    return {
      totalTickets,
      pendingApprovalTickets: this.tickets.filter((ticket) => ticket.status === 'PENDING_APPROVAL').length,
      unassignedTickets: this.tickets.filter((ticket) => ticket.status === 'PENDING').length,
      inProgressTickets: this.tickets.filter((ticket) => ticket.status === 'IN_PROGRESS').length,
      resolvedTickets: resolved.length,
      slaBreachedTickets,
      totalUsers: this.users.length,
      activeUsers: this.users.filter((user) => user.isActive).length,
      averageResolutionHours: resolutionHours.length
        ? resolutionHours.reduce((sum, hours) => sum + hours, 0) / resolutionHours.length
        : 0,
      ticketsByDepartment: byDepartment,
      ticketsByCategory: byCategory,
      departmentQueueRanking,
      technicianLeaderboard,
    };
  }

}

export const deskflowStore = new DeskFlowStore();
