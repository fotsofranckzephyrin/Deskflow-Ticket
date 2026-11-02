import React, { useState, useMemo } from 'react';
import { Search, Plus, Download, RefreshCw, ArrowUpDown, CheckCircle } from 'lucide-react';
import { Ticket, TicketStatus, TicketPriority, UserRole } from '../../types';
import { useLanguage } from '../../traduction';

interface TicketListProps {
  tickets: Ticket[];
  onSelectTicket: (ticket: Ticket) => void;
  onOpenCreateModal: () => void;
  onTakeTicket?: (ticketId: string) => void;
  onAcceptTicket?: (ticketId: string) => void;
  onReassignToAvailableColleague?: (ticketId: string) => void;
  userRole?: UserRole;
  currentUserId?: string;
  isOnlyAssignedToMe?: boolean;
}

export const TicketList: React.FC<TicketListProps> = ({
  tickets,
  onSelectTicket,
  onOpenCreateModal,
  onTakeTicket,
  onAcceptTicket,
  onReassignToAvailableColleague,
  userRole = 'USER',
  currentUserId,
  isOnlyAssignedToMe = false,
}) => {
  const { language, t } = useLanguage();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'DATE' | 'SLA'>('SLA');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');

  const isUserRole = userRole === 'USER';

  // Extract distinct departments from ticket list
  const departments = useMemo(() => {
    const set = new Set<string>();
    tickets.forEach((t) => {
      if (t.department) set.add(t.department);
    });
    return Array.from(set).sort();
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const list = tickets.filter((ticket) => {
      if (isOnlyAssignedToMe && ticket.assignedToId !== currentUserId) {
        return false;
      }

      const matchSearch =
        ticket.title.toLowerCase().includes(search.toLowerCase()) ||
        ticket.ticketNumber.toLowerCase().includes(search.toLowerCase()) ||
        ticket.createdByName.toLowerCase().includes(search.toLowerCase()) ||
        ticket.department.toLowerCase().includes(search.toLowerCase());

      const matchStatus = selectedStatus === 'ALL' || ticket.status === selectedStatus;
      const matchPriority = selectedPriority === 'ALL' || ticket.priority === selectedPriority;
      const matchCategory = selectedCategory === 'ALL' || ticket.category === selectedCategory;
      const matchDepartment = selectedDepartment === 'ALL' || ticket.department === selectedDepartment;

      return matchSearch && matchStatus && matchPriority && matchCategory && matchDepartment;
    });

    // Sorting: Default by Priority (Urgent first), then Date
    return list.sort((a, b) => {
      if (sortBy === 'DATE') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'SLA') {
        return new Date(a.slaDeadline).getTime() - new Date(b.slaDeadline).getTime();
      }
      return 0;
    });
  }, [
    tickets,
    search,
    sortBy,
    selectedStatus,
    selectedPriority,
    selectedCategory,
    selectedDepartment,
    isOnlyAssignedToMe,
    currentUserId,
  ]);

  const nextTicketInQueue = useMemo(() => tickets
    .filter((ticket) => ticket.status === 'PENDING' && !ticket.assignedToId)
    .sort((a, b) => {
      const priorityOrder: Record<TicketPriority, number> = {
        URGENT: 4,
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1,
      };
      return priorityOrder[b.priority] - priorityOrder[a.priority] ||
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
        a.ticketNumber.localeCompare(b.ticketNumber);
    })[0]?.id, [tickets]);

  const exportCSV = () => {
    const headers = [
      'Numero',
      'Objet_Demande',
      'Categorie',
      'Priorite',
      'Statut_Demande',
      'Demandeur',
      'Departement',
      'Technicien_Assigne',
      'Cout_Estime_FCFA',
      'Date_Creation',
      'Temps_Max_Attente',
    ];
    const rows = filteredTickets.map((t) => [
      t.ticketNumber,
      `"${t.title.replace(/"/g, '""')}"`,
      t.category,
      t.priority,
      t.status,
      `"${t.createdByName.replace(/"/g, '""')}"`,
      `"${t.department.replace(/"/g, '""')}"`,
      `"${(t.assignedToName || 'Non assigné').replace(/"/g, '""')}"`,
      t.estimatedCost ? `${t.estimatedCost} FCFA` : '0 FCFA',
      t.createdAt,
      t.slaDeadline,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `demandes_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusText = (status: TicketStatus) => {
    if (isUserRole) {
      switch (status) {
        case 'PENDING_APPROVAL':
          return t('En attente d\'approbation budget');
        case 'PENDING':
        case 'ASSIGNED':
          return t('En attente de prise en charge');
        case 'IN_PROGRESS':
          return t('En cours de traitement');
        case 'RESOLVED':
          return t('Demande traitée (Résolue)');
        case 'CLOSED':
          return t('Demande clôturée');
        case 'REJECTED':
          return t('Demande non retenue');
      }
    }
    switch (status) {
      case 'PENDING_APPROVAL':
        return t('En attente approbation');
      case 'PENDING':
        return t('En file d\'attente');
      case 'ASSIGNED':
        return t('Assigné (À valider)');
      case 'IN_PROGRESS':
        return t('En cours de traitement');
      case 'RESOLVED':
        return t('Résolu');
      case 'CLOSED':
        return t('Clôturé');
      case 'REJECTED':
        return t('Refusé');
    }
  };

  /**
   * Règle métier stricte demandée par l'utilisateur :
   * Statut traité en VERT, statut en attente en ORANGE, refusé en rouge
   */
  const getStatusBadgeStyle = (status: TicketStatus) => {
    if (status === 'RESOLVED' || status === 'CLOSED') {
      return 'bg-emerald-50 text-emerald-800 border-emerald-300';
    }
    if (status === 'IN_PROGRESS') {
      return 'bg-sky-50 text-sky-800 border-sky-300';
    }
    if (status === 'ASSIGNED') {
      return 'bg-violet-50 text-violet-800 border-violet-300';
    }
    if (status === 'PENDING' || status === 'PENDING_APPROVAL') {
      return 'bg-amber-50 text-amber-800 border-amber-300';
    }
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  const formatTicketDate = (dateStr: string) => {
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

  const getSlaIndicator = (ticket: Ticket) => {
    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      return <span className="text-emerald-700 font-medium font-sans text-xs">{t('Traité')}</span>;
    }
    const now = Date.now();
    const deadline = new Date(ticket.slaDeadline).getTime();
    const diffHours = (deadline - now) / (3600 * 1000);

    if (diffHours < 0) {
      const pastMinutes = Math.abs(Math.round(diffHours * 60));
      return (
        <div>
          <span className="font-semibold text-neutral-900 block text-xs">
            {t('Dépassé')} (+{pastMinutes > 60 ? `${Math.round(pastMinutes / 60)}h` : `${pastMinutes} min`})
          </span>
          <span className="text-[10px] text-neutral-400 font-mono block">
            {t('Échéance :')} {formatTicketDate(ticket.slaDeadline)}
          </span>
        </div>
      );
    }

    const remainingMinutes = Math.max(1, Math.round(diffHours * 60));
    return (
      <div>
        <span className="text-neutral-800 font-medium block text-xs">
          {t('Reste')} {remainingMinutes > 60 ? `${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60}m` : `${remainingMinutes} min`}
        </span>
        <span className="text-[10px] text-neutral-400 font-mono block">
          {t('Délai max :')} {formatTicketDate(ticket.slaDeadline)}
        </span>
      </div>
    );
  };

  // Seul le Chef de Service (ou Chef de Support / Admin) peut réaffecter une demande
  const canReassign =
    userRole === 'CHEF_DE_SERVICE' || userRole === 'CHEF_DE_SUPPORT' || userRole === 'ADMIN';

  return (
    <div className="space-y-6">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900 tracking-tight flex items-center gap-2">
            <span>
              {t(isUserRole
                ? 'Mes Demandes d\'Assistance'
                : userRole === 'CHEF_DE_SERVICE'
                ? 'Demandes du Service & Priorités'
                : isOnlyAssignedToMe
                ? 'Mes Interventions en Charge'
                : userRole === 'CHEF_DE_SUPPORT'
                ? 'Supervision & Dispatching du Support'
                : userRole === 'TECHNICIAN'
                ? 'File d\'Intervention Support'
                : 'Toutes les Demandes de l\'Entreprise')}
            </span>
            {userRole === 'CHEF_DE_SERVICE' && (
              <span className="font-mono text-[10px] bg-neutral-900 text-white px-2 py-0.5 rounded font-medium">
                CHEF DE SERVICE
              </span>
            )}
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            {t(isUserRole
              ? 'Suivi de vos demandes en cours. Vous visualisez l\'état d\'avancement de votre prise en charge.'
              : userRole === 'CHEF_DE_SERVICE'
              ? 'Demandes de votre direction avec priorité automatique. Vous êtes habilité à réaffecter les demandes.'
              : 'Système d\'attribution automatique : une seule demande active par technicien pour une efficacité maximale.')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isUserRole && (
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-50 rounded transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('Exporter CSV')}</span>
            </button>
          )}

          <button
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{userRole === 'CHEF_DE_SERVICE' ? t('Demande urgente') : t('Nouveau ticket')}</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 sm:p-4 rounded-md bg-white border border-neutral-200 flex flex-col md:flex-row items-stretch md:items-center gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Rechercher par objet, numéro, demandeur ou direction...')}
            className="w-full bg-neutral-50 border border-neutral-200 rounded pl-9 pr-3 py-1.5 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Tri */}
          <div className="flex items-center gap-1 bg-neutral-50 border border-neutral-200 rounded px-2 py-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-neutral-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'DATE' | 'SLA')}
              className="bg-transparent text-neutral-800 focus:outline-none font-medium text-xs cursor-pointer"
            >
              <option value="DATE">{t('Tri : Date création')}</option>
              <option value="SLA">{t('Tri : Échéance la plus proche')}</option>
            </select>
          </div>

          {/* Filtre Département */}
          {!isUserRole && (
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1.5 text-neutral-800 focus:outline-none focus:border-neutral-400 text-xs cursor-pointer"
            >
              <option value="ALL">{t('Toutes les directions')}</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          )}

          {/* Filtre Statut */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1.5 text-neutral-800 focus:outline-none focus:border-neutral-400 text-xs cursor-pointer"
          >
            <option value="ALL">{t('Tous statuts')}</option>
            <option value="PENDING_APPROVAL">{t('En attente approbation')}</option>
            <option value="PENDING">{t('En attente prise en charge')}</option>
            <option value="ASSIGNED">{t('Assigné')}</option>
            <option value="IN_PROGRESS">{t('En cours')}</option>
            <option value="RESOLVED">{t('Résolu')} ({t('Traité')})</option>
            <option value="CLOSED">{t('Clôturé')} ({t('Traité')})</option>
            <option value="REJECTED">{t('Refusé')}</option>
          </select>

          {/* Filtre Priorité */}
          {!isUserRole && (
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="bg-neutral-50 border border-neutral-200 rounded px-2.5 py-1.5 text-neutral-800 focus:outline-none focus:border-neutral-400 text-xs cursor-pointer"
            >
              <option value="ALL">{t('Toutes priorités')}</option>
              <option value="URGENT">{t('Urgente')}</option>
              <option value="HIGH">{t('Haute')}</option>
              <option value="MEDIUM">{t('Moyenne')}</option>
              <option value="LOW">{t('Basse')}</option>
            </select>
          )}
        </div>
      </div>

      {/* Vue Mobile (Cartes interactives compactes sans rupture d'affichage) */}
      <div className="block lg:hidden space-y-3">
        {filteredTickets.length === 0 ? (
          <div className="p-8 text-center bg-white border border-neutral-200 rounded-md">
            <p className="text-neutral-500 text-xs">
              {isUserRole
                ? t('Vous n’avez actuellement aucune demande en cours.')
                : t('Aucune demande ne correspond à vos filtres.')}
            </p>
          </div>
        ) : (
          filteredTickets.map((ticket) => {
            const isUnassigned = !ticket.assignedToId && ticket.status === 'PENDING';
            const isNextInQueue = nextTicketInQueue === ticket.id;
            const canTake = userRole === 'TECHNICIAN' && isUnassigned && isNextInQueue;
            const isAssignedToMe = ticket.assignedToId === currentUserId;
            const canAccept =
              (userRole === 'TECHNICIAN' || userRole === 'ADMIN') &&
              ticket.status === 'ASSIGNED' &&
              (isAssignedToMe || userRole === 'ADMIN');

            return (
              <div
                key={ticket.id}
                onClick={() => onSelectTicket(ticket)}
                className={`p-4 bg-white border border-neutral-200 rounded-md shadow-xs active:bg-neutral-50 transition-colors cursor-pointer space-y-2.5 ${
                  ticket.status === 'IN_PROGRESS' ? 'border-l-4 border-l-sky-500' :
                  ticket.status === 'ASSIGNED' ? 'border-l-4 border-l-violet-500' :
                  ticket.status === 'PENDING' ? 'border-l-4 border-l-amber-400' : ''
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-neutral-900">{ticket.ticketNumber}</span>
                    {!isUserRole && ticket.priority === 'URGENT' && (
                      <span className="font-semibold text-neutral-900 text-[10px] bg-neutral-100 px-1.5 py-0.2 rounded">
                        URGENT
                      </span>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${getStatusBadgeStyle(
                      ticket.status
                    )}`}
                  >
                    {getStatusText(ticket.status)}
                  </span>
                </div>

                <div>
                  <div className="font-semibold text-neutral-900 text-xs leading-snug">{ticket.title}</div>
                  <div className="text-[11px] text-neutral-500 line-clamp-2 mt-0.5">{ticket.description}</div>
                  <div className="text-[10px] text-neutral-500 mt-1">
                    Date création : {formatTicketDate(ticket.createdAt)}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[10px] text-neutral-500 pt-1.5 border-t border-neutral-100 font-mono">
                  <span>{t('Catégorie :')} {t(ticket.category)}</span>
                  {ticket.estimatedCost && ticket.estimatedCost > 0 && (
                    <span>· Matériel : {ticket.estimatedCost.toLocaleString('fr-FR')} FCFA</span>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1">
                  <div className="truncate max-w-[180px]">
                    <span className="text-neutral-900 font-medium">{ticket.createdByName}</span>
                    <span className="block text-[10px] text-neutral-400 truncate">{ticket.department}</span>
                  </div>
                  <div className="text-right">
                    {getSlaIndicator(ticket)}
                  </div>
                </div>

                {/* Actions contextuelles sur mobile */}
                <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-neutral-100">
                  {canAccept && onAcceptTicket && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAcceptTicket(ticket.id);
                      }}
                      className="px-2.5 py-1 text-[11px] font-medium text-white bg-neutral-900 rounded inline-flex items-center gap-1"
                    >
                      <CheckCircle className="w-3 h-3" />
                      <span>{t('Accepter')}</span>
                    </button>
                  )}

                  {canTake && onTakeTicket && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTakeTicket(ticket.id);
                      }}
                      className="px-2.5 py-1 text-[11px] font-medium text-white bg-neutral-900 rounded"
                    >
                      {t('Prendre en charge')}
                    </button>
                  )}

                  {canReassign && onReassignToAvailableColleague && ticket.assignedToId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onReassignToAvailableColleague(ticket.id);
                      }}
                      className="px-2 py-1 text-[11px] text-neutral-800 bg-white border border-neutral-300 rounded inline-flex items-center gap-1"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>{t('Réaffecter')}</span>
                    </button>
                  )}

                  <span className="px-2 py-1 text-[11px] text-neutral-700 bg-neutral-50 border border-neutral-200 rounded">
                    {t('Détails →')}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Vue Desktop : Tableau Sobre et Rigoureux */}
      <div className="hidden lg:block rounded-md bg-white border border-neutral-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-medium uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-3.5">{t(isUserRole ? 'Référence & suivi' : 'Réf & Urgence')}</th>
                <th className="py-3 px-4">{t('Objet de la demande')}</th>
                <th className="py-3 px-3.5">{t("Temps max d'attente")}</th>
                <th className="py-3 px-3.5">{t('Statut de la demande')}</th>
                {!isUserRole && <th className="py-3 px-3.5">{t('Demandeur & Direction')}</th>}
                <th className="py-3 px-3.5">{t('Technicien assigné')}</th>
                <th className="py-3 px-4 text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 text-neutral-700">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={isUserRole ? 6 : 7} className="py-12 text-center text-neutral-400">
                    <div className="max-w-xs mx-auto space-y-1">
                      <p className="font-medium text-neutral-600">{t('Aucune demande trouvée')}</p>
                      <p className="text-[11px] text-neutral-400">
                        {isUserRole
                          ? t('Vous n’avez actuellement aucune demande en cours. Cliquez sur « Nouveau ticket » pour ouvrir une assistance.')
                          : t('La file d’attente est vide ou aucun ticket ne correspond aux filtres appliqués.')}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket) => {
                        const isUnassigned = !ticket.assignedToId && ticket.status === 'PENDING';
                        const isNextInQueue = nextTicketInQueue === ticket.id;
                        const canTake = userRole === 'TECHNICIAN' && isUnassigned && isNextInQueue;
                  const isAssignedToMe = ticket.assignedToId === currentUserId;
                  const canAccept =
                    (userRole === 'TECHNICIAN' || userRole === 'ADMIN') &&
                    ticket.status === 'ASSIGNED' &&
                    (isAssignedToMe || userRole === 'ADMIN');

                  const isUrgent = ticket.priority === 'URGENT';
                  const isHigh = ticket.priority === 'HIGH';

                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => onSelectTicket(ticket)}
                      className={`cursor-pointer hover:bg-neutral-50 transition-colors ${
                        ticket.status === 'IN_PROGRESS' ? 'bg-sky-50/50' :
                        ticket.status === 'ASSIGNED' ? 'bg-violet-50/40' : ''
                      }`}
                    >
                      {/* Réf & Priorité Usager */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap align-top">
                        <div className="font-mono text-[11px] font-semibold text-neutral-900">
                          {ticket.ticketNumber}
                        </div>
                        <div className="text-[10px] text-neutral-500 mt-1">
                          {t('Date création :')} {formatTicketDate(ticket.createdAt)}
                        </div>
                        {!isUserRole && <div className="text-[11px] text-neutral-600 mt-0.5">
                          {isUrgent ? (
                            <span className="font-semibold text-neutral-900">{t('Urgente')}</span>
                          ) : isHigh ? (
                            <span>{t('Haute')}</span>
                          ) : ticket.priority === 'MEDIUM' ? (
                            <span className="text-neutral-500">{t('Moyenne')}</span>
                          ) : (
                            <span className="text-neutral-400">{t('Basse')}</span>
                          )}
                        </div>}
                      </td>

                      {/* Objet de la demande */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-neutral-900 text-xs">
                              {ticket.title}
                            </span>
                            {ticket.isChefDeServiceRequest && (
                              <span className="text-[10px] text-neutral-500 font-mono">
                                [Direction]
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-neutral-500 line-clamp-1">
                            {ticket.description}
                          </div>

                          <div className="text-[10px] text-neutral-400 font-mono">
                            {t('Catégorie :')} {t(ticket.category)}
                            {ticket.estimatedCost && ticket.estimatedCost > 0 ? ` · ${t('Matériel :')} ${ticket.estimatedCost.toLocaleString(language === 'en' ? 'en-GB' : 'fr-FR')} FCFA` : ''}
                          </div>
                        </div>
                      </td>

                      {/* Temps max d'attente de traitement */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap align-top">
                        {getSlaIndicator(ticket)}
                      </td>

                      {/* Statut de la demande (Vert = Traité, Orange = En attente) */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap align-top">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${getStatusBadgeStyle(
                            ticket.status
                          )}`}
                        >
                          {getStatusText(ticket.status)}
                        </span>
                        {ticket.requiresApproval && ticket.status === 'PENDING_APPROVAL' && (
                          <div className="text-[10px] text-neutral-500 mt-1 font-mono">
                            Validation budgétaire requise
                          </div>
                        )}
                      </td>

                      {/* Demandeur & Direction */}
                      {!isUserRole && (
                        <td className="py-3.5 px-3.5 align-top">
                          <div className="font-medium text-neutral-900">{ticket.createdByName}</div>
                          <div className="text-[10px] text-neutral-500 font-mono truncate max-w-[150px]" title={ticket.department}>
                            {ticket.department}
                          </div>
                        </td>
                      )}

                      {/* Intervenant assigné */}
                      <td className="py-3.5 px-3.5 whitespace-nowrap align-top">
                        {ticket.assignedToName ? (
                          <div className="space-y-0.5">
                            <span className="font-medium text-neutral-900 block">{ticket.assignedToName}</span>
                            {ticket.status === 'ASSIGNED' && (
                              <span className="text-[10px] text-neutral-400 font-mono block">En attente de validation</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-neutral-400 font-normal italic">En attente d'affectation</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right align-top whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {canAccept && onAcceptTicket && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onAcceptTicket(ticket.id);
                              }}
                              className="px-2.5 py-1 text-[11px] font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors inline-flex items-center gap-1"
                              title="Valider la prise en charge pour démarrer l'intervention"
                            >
                              <CheckCircle className="w-3 h-3" />
                              <span>Accepter</span>
                            </button>
                          )}

                          {canTake && onTakeTicket && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onTakeTicket(ticket.id);
                              }}
                              className="px-2.5 py-1 text-[11px] font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors"
                            >
                              Prendre
                            </button>
                          )}

                          {canReassign && onReassignToAvailableColleague && ticket.assignedToId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onReassignToAvailableColleague(ticket.id);
                              }}
                              title="Réaffecter au collègue disponible"
                              className="px-2 py-1 text-[11px] text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-100 rounded transition-colors inline-flex items-center gap-1 font-medium"
                            >
                              <RefreshCw className="w-2.5 h-2.5" />
                              <span>Réaffecter</span>
                            </button>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectTicket(ticket);
                            }}
                            className="px-2.5 py-1 text-[11px] text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded transition-colors"
                          >
                            Consulter
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
