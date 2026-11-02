import React, { useEffect, useState } from 'react';
import { X, Trash2, RefreshCw, Zap, CheckCircle, CheckCircle2 } from 'lucide-react';
import { Ticket, TicketStatus, User, UserRole } from '../../types';
import { useLanguage } from '../../traduction';
import { apiBlobRequest } from '../../services/api';

interface TicketDetailModalProps {
  ticket: Ticket | null;
  onClose: () => void;
  users: User[];
  currentRole?: UserRole;
  currentUserId?: string;
  onUpdateStatus: (ticketId: string, status: TicketStatus, notes: string) => void;
  onAssign: (ticketId: string, techId: string) => void;
  onTakeTicket?: (ticketId: string) => void;
  onAcceptTicket?: (ticketId: string) => void;
  onReassignToAvailableColleague?: (ticketId: string) => void;
  onApproveBudget?: (ticketId: string, notes: string) => void;
  onRejectTicket?: (ticketId: string, reason: string) => void;
  onDeleteTicket?: (ticketId: string) => void;
  onAddComment: (ticketId: string, content: string) => void;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({
  ticket,
  onClose,
  users,
  currentRole = 'USER',
  currentUserId,
  onUpdateStatus,
  onAssign,
  onTakeTicket,
  onAcceptTicket,
  onReassignToAvailableColleague,
  onApproveBudget,
  onRejectTicket,
  onDeleteTicket,
  onAddComment,
}) => {
  const { language, t } = useLanguage();
  const [newStatus, setNewStatus] = useState<TicketStatus>(ticket?.status || 'PENDING');
  const [statusNotes, setStatusNotes] = useState('');
  const [commentText, setCommentText] = useState('');
  const [selectedTechId, setSelectedTechId] = useState(ticket?.assignedToId || '');
  const [approvalDecisionNotes, setApprovalDecisionNotes] = useState('');
  const [reassignFeedback, setReassignFeedback] = useState<string | null>(null);
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const attachmentIds = ticket?.attachments.map((attachment) => attachment.id).join(',') || '';

  useEffect(() => {
    setNewStatus(ticket?.status || 'PENDING');
    setSelectedTechId(ticket?.assignedToId || '');
  }, [ticket?.id, ticket?.status, ticket?.assignedToId]);

  useEffect(() => {
    if (!ticket || ticket.attachments.length === 0) {
      setAttachmentUrls({});
      setAttachmentError(null);
      return;
    }

    let active = true;
    const objectUrls: string[] = [];
    setAttachmentError(null);
    void Promise.all(ticket.attachments.map(async (attachment) => {
      const blob = await apiBlobRequest(`/tickets/${ticket.id}/attachments/${attachment.id}`);
      const url = URL.createObjectURL(blob);
      objectUrls.push(url);
      return [attachment.id, url] as const;
    }))
      .then((entries) => {
        if (active) setAttachmentUrls(Object.fromEntries(entries));
        else objectUrls.forEach(URL.revokeObjectURL);
      })
      .catch((error: unknown) => {
        if (active) {
          setAttachmentError(error instanceof Error ? error.message : 'Impossible de charger les photos.');
        }
        objectUrls.forEach(URL.revokeObjectURL);
      });

    return () => {
      active = false;
      objectUrls.forEach(URL.revokeObjectURL);
    };
  }, [ticket?.id, attachmentIds]);

  if (!ticket) return null;

  const isAdmin = currentRole === 'ADMIN';
  const isChefDeSupport = currentRole === 'CHEF_DE_SUPPORT';
  const isChefDeService = currentRole === 'CHEF_DE_SERVICE';
  const isTechnician = currentRole === 'TECHNICIAN';
  const isUser = currentRole === 'USER';
  const isCreator = ticket.createdById === currentUserId;
  const canReassignDemands = isAdmin || isChefDeSupport || isChefDeService;
  const isAssignedToMe = ticket.assignedToId === currentUserId;

  const technicians = users.filter((u) => u.role === 'TECHNICIAN' && u.isActive);
  const assignedTechUser = users.find((u) => u.id === ticket.assignedToId);
  const isAssignedTechBusy = assignedTechUser?.isBusy;

  const isUrgent = ticket.priority === 'URGENT';

  const handleStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateStatus(ticket.id, newStatus, statusNotes);
    setStatusNotes('');
  };

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTechId) {
      onAssign(ticket.id, selectedTechId);
    }
  };

  const handleReassignClick = () => {
    if (!onReassignToAvailableColleague) return;
    try {
      const res: any = onReassignToAvailableColleague(ticket.id);
      setReassignFeedback(res?.message || 'Demande réaffectée.');
      setTimeout(() => setReassignFeedback(null), 5000);
    } catch (err: any) {
      setReassignFeedback(err.message || 'Erreur lors de la réaffectation');
    }
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (commentText.trim()) {
      onAddComment(ticket.id, commentText);
      setCommentText('');
    }
  };

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

  const getHumanStatusLabel = (status: TicketStatus) => {
    if (isUser) {
      switch (status) {
        case 'PENDING_APPROVAL':
          return t('En attente d\'approbation budgétaire');
        case 'PENDING':
        case 'ASSIGNED':
          return t('En attente de prise en charge');
        case 'IN_PROGRESS':
          return t('En cours de traitement par le support');
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
        return t('Assigné (En attente validation)');
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

  const getSlaInfo = () => {
    const now = Date.now();
    const deadline = new Date(ticket.slaDeadline).getTime();
    const diffHours = (deadline - now) / (3600 * 1000);

    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      const resolvedAt = new Date(ticket.resolvedAt || ticket.updatedAt).getTime();
      const isBreached = resolvedAt > deadline;
      return {
        text: t(isBreached ? 'Demande résolue après l’échéance' : 'Demande traitée dans les délais'),
        isBreached,
      };
    }
    if (diffHours < 0) {
      const pastMinutes = Math.abs(Math.round(diffHours * 60));
      return {
        text: t('Délai dépassé de {duration}').replace('{duration}', pastMinutes > 60 ? `${Math.round(pastMinutes / 60)}h` : `${pastMinutes} minutes`),
        isBreached: true,
      };
    }
    if (diffHours < 1) {
      return {
        text: t("Reste moins d'une heure ({minutes} min)").replace('{minutes}', String(Math.max(1, Math.round(diffHours * 60)))),
        isBreached: false,
      };
    }
    return {
      text: t('Reste environ {hours} heures').replace('{hours}', String(Math.round(diffHours))),
      isBreached: false,
    };
  };

  const slaInfo = getSlaInfo();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-5xl bg-white border border-neutral-300 rounded-md shadow-sm overflow-hidden text-neutral-900 max-h-[94vh] flex flex-col font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-neutral-600">{ticket.ticketNumber}</span>
              {isUrgent && !isUser && (
                <span className="font-mono text-[9px] bg-neutral-900 text-white px-2 py-0.5 rounded font-semibold inline-flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5" /> URGENT
                </span>
              )}
              {ticket.isChefDeServiceRequest && (
                <span className="font-mono text-[9px] bg-neutral-100 border border-neutral-300 text-neutral-900 px-1.5 py-0.2 rounded font-medium">
                  {t('Chef de Service')}
                </span>
              )}
            </div>
            <h2 className="text-sm font-semibold text-neutral-900 mt-1">{ticket.title}</h2>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto overscroll-contain space-y-5 text-xs">
          {/* Validation formelle pour le technicien avant traitement */}
          {ticket.status === 'ASSIGNED' && (isTechnician || isAdmin) && onAcceptTicket && (
            <div className="p-3.5 bg-neutral-900 text-white rounded-md space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs">{t('Validation de la prise en charge')}</span>
                <span className="font-mono text-[10px] text-neutral-300">{t('Statut : Assigné')}</span>
              </div>
              <p className="text-[11px] text-neutral-300">
                {t("Vous devez valider et accepter la demande pour démarrer l'intervention.")}
              </p>
              <div>
                <button
                  onClick={() => onAcceptTicket(ticket.id)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-neutral-900 bg-white hover:bg-neutral-100 rounded transition-colors inline-flex items-center gap-1.5"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{t('Valider & Accepter la prise en charge')}</span>
                </button>
              </div>
            </div>
          )}

          {/* Informations principales */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-neutral-50 border border-neutral-200 rounded-md">
            <div>
              <span className="text-neutral-500 block text-[11px]">{t('Statut de la demande')}</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border mt-0.5 ${
                  ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : ticket.status === 'REJECTED'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}
              >
                {getHumanStatusLabel(ticket.status)}
              </span>
            </div>
            {!isUser && <div>
              <span className="text-neutral-500 block text-[11px]">{t("Niveau d'urgence")}</span>
              <strong className="text-neutral-900 font-semibold">{ticket.priority}</strong>
            </div>}
            <div>
              <span className="text-neutral-500 block text-[11px]">{t('Demandeur')}</span>
              <span className="text-neutral-900 font-medium block">{ticket.createdByName}</span>
              <span className="text-[10px] text-neutral-500 block font-mono">{ticket.department}</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[11px]">{t('Intervenant')}</span>
              <div className="mt-0.5">
                <span className="text-neutral-900 font-medium block">
                  {ticket.assignedToName || t('En attente d\'affectation')}
                </span>
                {isAssignedTechBusy && !isUser && (
                  <span className="text-[10px] text-neutral-500 font-mono">
                    (En intervention)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Délais & Temps max d'attente de traitement */}
          <div className="p-3 border border-neutral-200 rounded-md space-y-2">
            <span className="font-semibold text-neutral-900 block text-xs">
              {t("Temps max d'attente de traitement")}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
              <div>
                <span className="text-neutral-500 block">{t('Date de la demande')}</span>
                <span className="font-mono text-neutral-800">{formatDate(ticket.createdAt)}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">{t("Délai maximum d'attente")}</span>
                <span className="font-mono text-neutral-800">{formatDate(ticket.slaDeadline)}</span>
              </div>
              <div>
                <span className="text-neutral-500 block">{t('État du traitement')}</span>
                <span className="font-mono text-neutral-900 font-medium">{slaInfo.text}</span>
              </div>
            </div>
          </div>

          {/* RÈGLE MÉTIER : Seul le Chef de Service (ou Chef de Support / Admin) peut réaffecter */}
          {canReassignDemands && ticket.assignedToId && onReassignToAvailableColleague && (
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="font-semibold text-neutral-900 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 text-neutral-700" />
                    <span>{t('Réaffectation de la demande')}</span>
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    {t('Transférer cette demande vers un collègue libre (non occupé sur une autre intervention).')}
                  </p>
                </div>
                <button
                  onClick={handleReassignClick}
                  className="px-3 py-1.5 text-[11px] font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors whitespace-nowrap self-start sm:self-auto"
                >
                  {t('Réaffecter au collègue libre')}
                </button>
              </div>
              {reassignFeedback && (
                <div className="p-2 bg-neutral-100 border border-neutral-300 rounded text-[11px] text-neutral-800">
                  {reassignFeedback}
                </div>
              )}
            </div>
          )}

          {/* Description & Coût éventuel */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-medium text-neutral-700">{t('Description du besoin ou problème :')}</span>
              {ticket.estimatedCost && ticket.estimatedCost > 0 && (
                <span className="text-[11px] font-mono text-neutral-900 font-semibold">
                  {t('Coût estimé :')} {ticket.estimatedCost.toLocaleString(language === 'en' ? 'en-GB' : 'fr-FR')} FCFA
                </span>
              )}
            </div>
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded text-neutral-800 whitespace-pre-wrap leading-relaxed">
              {ticket.description}
            </div>
          </div>

          {ticket.attachments.length > 0 && (
            <section className="space-y-2">
              <h3 className="font-semibold text-neutral-800">{t('Photos jointes')} ({ticket.attachments.length})</h3>
              {attachmentError && <p role="alert" className="text-xs text-rose-700">{attachmentError}</p>}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {ticket.attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachmentUrls[attachment.id]}
                    target="_blank"
                    rel="noreferrer"
                    className="overflow-hidden rounded border border-neutral-200 bg-neutral-50"
                  >
                    {attachmentUrls[attachment.id] ? (
                      <img
                        src={attachmentUrls[attachment.id]}
                        alt={attachment.fileName}
                        className="h-32 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-32 items-center justify-center text-xs text-neutral-500">
                        {t('Chargement…')}
                      </div>
                    )}
                    <span className="block truncate px-2 py-1.5 text-[10px] text-neutral-600">{attachment.fileName}</span>
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Validation administrative du budget */}
          {ticket.status === 'PENDING_APPROVAL' && isAdmin && onApproveBudget && onRejectTicket && (
            <div className="p-3 bg-neutral-50 border border-neutral-300 rounded space-y-2.5">
              <div className="font-semibold text-neutral-900 flex items-center justify-between">
                <span>{t("Décision d'arbitrage budgétaire")}</span>
                <span className="font-mono text-xs text-neutral-900 font-bold">
                  {(ticket.estimatedCost || 0).toLocaleString('fr-FR')} FCFA
                </span>
              </div>
              <input
                type="text"
                placeholder="Note de décision ou validation..."
                value={approvalDecisionNotes}
                onChange={(e) => setApprovalDecisionNotes(e.target.value)}
                className="w-full bg-white border border-neutral-300 rounded px-2.5 py-1 text-xs text-neutral-900"
              />
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => onApproveBudget(ticket.id, approvalDecisionNotes || 'Budget validé')}
                  className="px-3 py-1 font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors"
                >
                  {t('Approuver le budget')}
                </button>
                <button
                  onClick={() => onRejectTicket(ticket.id, approvalDecisionNotes || 'Demande refusée')}
                  className="px-3 py-1 font-medium text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded transition-colors"
                >
                  {t('Refuser la demande')}
                </button>
              </div>
            </div>
          )}

          {/* Prise en charge rapide pour ticket libre */}
          {isTechnician && !ticket.assignedToId && onTakeTicket && ticket.status !== 'PENDING_APPROVAL' && (
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded flex items-center justify-between">
              <span className="text-neutral-700">{t("Ce ticket n'est pas encore attribué.")}</span>
              <button
                onClick={() => onTakeTicket(ticket.id)}
                className="px-3 py-1 font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors"
              >
                {t('Prendre en charge')}
              </button>
            </div>
          )}

          {/* Changement d'état technique pour les techniciens & administrateurs */}
          {(isAdmin || isChefDeSupport || isTechnician) && ticket.status !== 'PENDING_APPROVAL' && (
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded space-y-2.5">
              <div className="font-semibold text-neutral-900">
              {t('Mise à jour du statut')}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <form onSubmit={handleStatusSubmit} className="space-y-2">
                  <label className="block text-neutral-600 font-medium">{t('Nouveau statut')}</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as TicketStatus)}
                    className="w-full bg-white border border-neutral-300 rounded px-2.5 py-1 text-xs text-neutral-900"
                  >
                    <option value="ASSIGNED">{t('Assigné (En attente validation)')}</option>
                    <option value="IN_PROGRESS">{t('En cours de traitement')}</option>
                    <option value="RESOLVED">{t('Résolu')}</option>
                    {(isAdmin || isChefDeSupport) && <option value="REJECTED">{t('Refuser la demande')}</option>}
                    {(isAdmin || isChefDeSupport) && <option value="CLOSED">{t('Clôturé')}</option>}
                  </select>

                  <input
                    type="text"
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    placeholder={t('Note de traitement...')}
                    className="w-full bg-white border border-neutral-300 rounded px-2.5 py-1 text-xs text-neutral-900"
                  />

                  <button
                    type="submit"
                    className="px-3 py-1 font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors"
                  >
                    {t('Enregistrer la transition')}
                  </button>
                </form>

                {(isAdmin || isChefDeSupport) && (
                  <form onSubmit={handleAssignSubmit} className="space-y-2">
                    <label className="block text-neutral-600 font-medium">{t('Assigner à un technicien')}</label>
                    <select
                      value={selectedTechId}
                      onChange={(e) => setSelectedTechId(e.target.value)}
                      className="w-full bg-white border border-neutral-300 rounded px-2.5 py-1 text-xs text-neutral-900"
                    >
                      <option value="">{t('Sélectionner un agent')}</option>
                      {technicians.map((technician) => (
                        <option key={technician.id} value={technician.id} disabled={technician.isBusy && technician.id !== ticket.assignedToId}>
                          {technician.fullName} ({technician.isBusy ? t('Déjà sur une demande') : t('Libre')})
                        </option>
                      ))}
                    </select>

                    <div>
                      <button
                        type="submit"
                        disabled={!selectedTechId || (technicians.find((tech) => tech.id === selectedTechId)?.isBusy === true && selectedTechId !== ticket.assignedToId)}
                        className="px-3 py-1 font-medium text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-50 rounded transition-colors"
                      >
                        {t("Valider l'affectation")}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* Le demandeur peut confirmer la clôture ou relancer le ticket existant. */}
          {isCreator && ticket.status === 'RESOLVED' && (
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="font-semibold text-neutral-900 block flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-neutral-900" />
                  {t('Votre demande a été marquée comme résolue.')}
                </span>
                <span className="text-neutral-500 text-[11px]">{t("Si l'assistance est satisfaisante, confirmez la clôture.")}</span>
              </div>
              <button
                onClick={() => onUpdateStatus(ticket.id, 'CLOSED', t('Clôturé par le demandeur'))}
                className="px-3 py-1.5 font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors"
              >
                {t('Confirmer la clôture')}
              </button>
            </div>
          )}
          {isCreator && (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="font-semibold text-neutral-900 block">{t('Résolution insatisfaisante ?')}</span>
                <span className="text-neutral-600 text-[11px]">
                  {t('Relancez cette demande pour poursuivre le traitement sans créer un nouveau ticket.')}
                </span>
              </div>
              <button
                onClick={() => onUpdateStatus(ticket.id, 'PENDING', t('Relance demandée par le demandeur.'))}
                className="px-3 py-1.5 font-medium text-neutral-900 bg-white border border-amber-300 hover:bg-amber-100 rounded transition-colors whitespace-nowrap"
              >
                {t('Relancer cette demande')}
              </button>
            </div>
          )}


          {/* Échanges & Commentaires (Ouvert à tous pour communiquer) */}
          <div>
            <div className="font-semibold text-neutral-900 mb-2">
              {t('Échanges & Précisions')} ({ticket.comments.length})
            </div>

            <div className="space-y-2 mb-3">
              {ticket.comments.length === 0 ? (
                <div className="text-neutral-400 text-xs italic">
                  {t('Aucun message pour le moment.')}
                </div>
              ) : (
                ticket.comments.map((c) => (
                  <div key={c.id} className="p-3 bg-neutral-50 border border-neutral-200 rounded">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-medium text-neutral-900">
                        {c.userName} ({c.userRole})
                      </span>
                      <span className="font-mono text-neutral-400">
                        {formatDate(c.createdAt)}
                      </span>
                    </div>
                    <div className="text-neutral-800">{c.content}</div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleCommentSubmit} className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={t('Rédiger un message ou apporter une précision...')}
                className="flex-1 bg-white border border-neutral-300 rounded px-3 py-1.5 text-xs text-neutral-900 focus:outline-none focus:border-neutral-500"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors whitespace-nowrap"
              >
                {t('Envoyer')}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-200 flex items-center justify-between shrink-0">
          <div>
            {isAdmin && onDeleteTicket && (
              <button
                onClick={() => {
                  if (window.confirm(`Supprimer définitivement le ticket ${ticket.ticketNumber} ?`)) {
                    onDeleteTicket(ticket.id);
                    onClose();
                  }
                }}
                className="text-xs text-neutral-500 hover:text-neutral-800 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('Supprimer le ticket')}
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded transition-colors"
          >
            {t('Fermer')}
          </button>
        </div>
      </div>
    </div>
  );
};
