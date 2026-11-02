/**
 * DeskFlow - Type Definitions
 * Strict RBAC & Enterprise Service Management
 */

export type UserRole = 'ADMIN' | 'CHEF_DE_SUPPORT' | 'TECHNICIAN' | 'CHEF_DE_SERVICE' | 'USER';

export interface User {
  id: string;
  fullName: string;
  email: string;
  password?: string;
  matricule?: string; // Matricule professionnel de l'agent
  role: UserRole;
  department: string;
  isActive: boolean;
  mustChangePassword?: boolean; // Mot de passe temporaire devant être modifié à la 1ère connexion
  createdAt: string;
  lastLoginAt?: string;
  isBusy?: boolean; // Indique si le technicien a atteint sa capacité maximale
  lastIPAddress?: string;
  lastSeenAt?: string;
}

export interface Department {
  id: string;
  name: string;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  user: User;
  expiresAt: number;
}

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TicketStatus =
  | 'PENDING_APPROVAL'  // Requiert approbation admin (ex: budget/matériel)
  | 'PENDING'           // En attente d'assignation
  | 'ASSIGNED'          // Assigne a un technicien
  | 'IN_PROGRESS'       // En cours de résolution
  | 'RESOLVED'          // Résolu par le technicien
  | 'CLOSED'            // Clôturé par le demandeur ou l'admin
  | 'REJECTED';         // Refusé par l'admin

export type TicketCategory = 'HARDWARE' | 'SOFTWARE' | 'NETWORK' | 'ACCESS' | 'GENERAL';

export interface TicketComment {
  id: string;
  ticketId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  content: string;
  createdAt: string;
}

export interface TicketAttachment {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
}

export interface TicketHistory {
  id: string;
  ticketId: string;
  userId: string;
  userName: string;
  action: string;
  oldStatus?: TicketStatus;
  newStatus?: TicketStatus;
  notes: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  category: TicketCategory;
  requestLanguage?: 'fr' | 'en';
  priority: TicketPriority;
  status: TicketStatus;
  createdById: string;
  createdByName: string;
  createdByRole?: UserRole;
  isChefDeServiceRequest?: boolean; // Priorité hiérarchique automatique
  department: string;
  assignedToId?: string;
  assignedToName?: string;
  technicalQualification?: string; // Qualification technique opérationnelle
  technicalLevel?: 'P1' | 'P2' | 'P3' | 'P4'; // Niveau d'incident support (P1 critique à P4 standard)
  acceptedByTechnicianAt?: string; // Date de validation & acceptation par le technicien
  estimatedCost?: number; // Pour les demandes de matériel en FCFA
  requiresApproval?: boolean;
  approvalNotes?: string;
  slaDeadline: string; // ISO Date pour calcul du respect SLA
  resolvedAt?: string;
  comments: TicketComment[];
  history: TicketHistory[];
  attachments: TicketAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  targetType: 'USER' | 'TICKET' | 'SETTINGS' | 'AUTH';
  targetId: string;
  details: string;
  ipAddress: string;
}

export interface SlaPolicy {
  priority: TicketPriority;
  maxHours: number;
  description: string;
}

export interface DepartmentQueueRanking {
  department: string;
  queueCount: number; // Tickets non résolus
  urgentCount: number;
  totalHistorical: number;
  percentageOfQueue: number;
}

export interface TechnicianLeaderboardEntry {
  technicianId: string;
  technicianName: string;
  resolvedCount: number;
  activeCount: number;
  isBusy: boolean; // true si activeCount >= 2
  slaComplianceRate: number;
}

export interface SystemMetrics {
  totalTickets: number;
  pendingApprovalTickets: number;
  unassignedTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  slaBreachedTickets: number;
  totalUsers: number;
  activeUsers: number;
  averageResolutionHours: number;
  ticketsByDepartment: Record<string, number>;
  ticketsByCategory: Record<string, number>;
  departmentQueueRanking: DepartmentQueueRanking[];
  technicianLeaderboard: TechnicianLeaderboardEntry[];
}
