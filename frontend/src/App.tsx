import React, { useState, useEffect } from 'react';
import { deskflowStore } from './services/store';
import { Header } from './components/layout/Header';
import { AuthView } from './components/auth/AuthView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { TicketList } from './components/tickets/TicketList';
import { TicketCreateModal } from './components/tickets/TicketCreateModal';
import { TicketDetailModal } from './components/tickets/TicketDetailModal';
import { ProfileEditModal } from './components/profile/ProfileEditModal';
import { Ticket, TicketStatus } from './types';
import { useLanguage } from './traduction';
import { UserNotification } from './components/layout/Header';

type AuthMode = 'LOGIN' | 'REGISTER';

const getAuthModeFromPath = (): AuthMode =>
  window.location.pathname === '/register' || window.location.pathname === '/registersssss'
    ? 'REGISTER'
    : 'LOGIN';

const getTabFromPath = (): string => {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/admin') return 'admin';
  if (path === '/my-assigned') return 'my-assigned';
  return 'tickets';
};

const getPathForTab = (tab: string): string => {
  if (tab === 'admin') return '/admin';
  if (tab === 'my-assigned') return '/my-assigned';
  return '/tickets';
};

const notificationStorageKey = (userId: string) => `deskflow-notifications-${userId}`;
const ticketStatusStorageKey = (userId: string) => `deskflow-ticket-statuses-${userId}`;

function readNotifications(userId: string): UserNotification[] {
  try {
    const stored = localStorage.getItem(notificationStorageKey(userId));
    return stored ? JSON.parse(stored) as UserNotification[] : [];
  } catch {
    return [];
  }
}

function readTicketStatuses(userId: string): Record<string, TicketStatus> {
  try {
    const stored = localStorage.getItem(ticketStatusStorageKey(userId));
    return stored ? JSON.parse(stored) as Record<string, TicketStatus> : {};
  } catch {
    return {};
  }
}

export default function App() {
  const { t } = useLanguage();
  const [, setTick] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [notificationsReady, setNotificationsReady] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(getTabFromPath);
  const [authMode, setAuthMode] = useState<AuthMode>(getAuthModeFromPath);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/login' || path === '/register' || path === '/registersssss' || path === '/') {
        setAuthMode(getAuthModeFromPath());
      } else {
        setActiveTab(getTabFromPath());
      }
    };
    window.addEventListener('popstate', handlePopState);
    const unsub = deskflowStore.subscribe(() => {
      setTick((t) => t + 1);
    });
    deskflowStore
      .initialize()
      .catch((error: unknown) => {
        setStartupError(error instanceof Error ? error.message : 'Le serveur est indisponible.');
      })
      .finally(() => setIsReady(true));
    return () => {
      window.removeEventListener('popstate', handlePopState);
      unsub();
    };
  }, []);

  const navigate = (path: string, replace = false) => {
    if (window.location.pathname !== path) {
      if (replace) window.history.replaceState(null, '', path);
      else window.history.pushState(null, '', path);
    }
  };

  const handleAuthModeChange = (mode: AuthMode) => {
    setAuthMode(mode);
    navigate(mode === 'REGISTER' ? '/register' : '/login');
  };

  const runAction = (action: () => unknown) => {
    setActionError(null);
    try {
      const result = action();
      if (result instanceof Promise) {
        void result
          .then(() => {
            if (selectedTicket) {
              return deskflowStore.getTicket(selectedTicket.id).then(setSelectedTicket);
            }
          })
          .catch(async (error: unknown) => {
            setActionError(error instanceof Error ? error.message : 'L’opération a échoué.');
            try {
              await deskflowStore.refreshTickets();
              if (selectedTicket) {
                setSelectedTicket(await deskflowStore.getTicket(selectedTicket.id));
              }
            } catch (refreshError: unknown) {
              setActionError((previous) =>
                `${previous || 'L’opération a échoué.'} Actualisation impossible : ${
                  refreshError instanceof Error ? refreshError.message : 'erreur inconnue'
                }`
              );
            }
          });
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'L’opération a échoué.');
    }
  };

  const session = deskflowStore.getSession();
  const users = deskflowStore.getUsers();
  const tickets = deskflowStore.getTickets();
  const metrics = deskflowStore.getMetrics();
  const auditLogs = deskflowStore.getAuditLogs();
  const slaPolicies = deskflowStore.getSlaPolicies();
  const departments = deskflowStore.getDepartments();
  const sessionUserId = session?.user.id;

  useEffect(() => {
    if (!sessionUserId) {
      setNotifications([]);
      setNotificationsReady(false);
      return;
    }
    setNotifications(readNotifications(sessionUserId));
    setNotificationsReady(true);
  }, [sessionUserId]);

  useEffect(() => {
    if (!sessionUserId || !notificationsReady) return;
    try {
      localStorage.setItem(notificationStorageKey(sessionUserId), JSON.stringify(notifications));
    } catch {
      setActionError((previous) => previous || t('Impossible d’enregistrer les notifications sur cet appareil.'));
    }
  }, [notifications, notificationsReady, sessionUserId, t]);

  useEffect(() => {
    if (!isReady) return;

    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    if (!session) {
      if (path !== '/login' && path !== '/register') {
        navigate(authMode === 'REGISTER' ? '/register' : '/login', true);
      }
      return;
    }

    if (path !== '/tickets' && path !== '/my-assigned' && path !== '/admin') {
      setActiveTab('tickets');
      navigate('/tickets', true);
      return;
    }

    const role = session.user.role;
    if ((path === '/admin' && role !== 'ADMIN' && role !== 'CHEF_DE_SUPPORT') ||
        (path === '/my-assigned' && role !== 'TECHNICIAN')) {
      setActiveTab('tickets');
      navigate('/tickets', true);
    }
  }, [isReady, session?.token, authMode]);

  useEffect(() => {
    if (!isReady || !session) return;
    let knownStatuses = readTicketStatuses(session.user.id);
    if (Object.keys(knownStatuses).length === 0) {
      knownStatuses = Object.fromEntries(
        deskflowStore.getTickets().map((ticket) => [ticket.id, ticket.status])
      );
    }
    const pollForRequesterUpdates = async () => {
      if (!navigator.onLine) return;
      try {
        await deskflowStore.refresh();
        const tickets = deskflowStore.getTickets();
        for (const ticket of tickets) {
          const previousStatus = knownStatuses[ticket.id];
          if (
            ticket.createdById === session.user.id &&
            previousStatus !== undefined &&
            !['RESOLVED', 'REJECTED'].includes(previousStatus) &&
            ['RESOLVED', 'REJECTED'].includes(ticket.status)
          ) {
            const english = ticket.requestLanguage === 'en';
            const statusMessage = ticket.status === 'RESOLVED'
              ? (english ? 'Your request has been resolved.' : 'Votre demande a été résolue.')
              : (english ? 'Your request has been rejected.' : 'Votre demande a été rejetée.');
            const notification: UserNotification = {
              id: `${ticket.id}:${ticket.status}:${ticket.updatedAt}`,
              ticketId: ticket.id,
              ticketNumber: ticket.ticketNumber,
              title: ticket.title,
              description: ticket.description,
              message: statusMessage,
              createdAt: ticket.updatedAt,
              read: false,
            };
            setNotifications((current) => current.some((item) => item.id === notification.id)
              ? current
              : [notification, ...current]);
            setSuccessNotice(`${ticket.ticketNumber} — ${statusMessage}`);
          }
          knownStatuses[ticket.id] = ticket.status;
        }
        localStorage.setItem(ticketStatusStorageKey(session.user.id), JSON.stringify(knownStatuses));
      } catch (error: unknown) {
        setActionError(error instanceof Error ? error.message : t('Impossible de vérifier les mises à jour.'));
      }
    };
    const intervalId = window.setInterval(() => void pollForRequesterUpdates(), 5_000);
    return () => window.clearInterval(intervalId);
  }, [isReady, session?.token, session?.user.id]);

  if (!isReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-sm text-neutral-700">
        <span>{t('Connexion à DeskFlow…')}</span>
        {startupError && <span className="text-rose-700">{startupError}</span>}
      </div>
    );
  }

  // If unauthenticated, show the dedicated Auth page
  if (!session) {
    return (
      <>
        {startupError && (
          <div className="p-3 text-center text-sm text-rose-800 bg-rose-50 border-b border-rose-200">
            API indisponible : {startupError}
          </div>
        )}
        <AuthView
          mode={authMode}
          departments={departments}
          onModeChange={handleAuthModeChange}
          onLogin={async (identifier, password) => {
            const loggedIn = await deskflowStore.login(identifier, password);
            if (loggedIn) {
              setActiveTab('tickets');
              navigate('/tickets');
            }
            return loggedIn;
          }}
          onRequestPasswordReset={(email) => deskflowStore.requestPasswordReset(email)}
          onResetPassword={(email, code, newPassword) => deskflowStore.resetPassword(email, code, newPassword)}
          onRegister={async (name, email, dept, password, matricule) => {
            await deskflowStore.register(name, email, dept, password, matricule);
            setSuccessNotice('Inscription réussie. Votre compte DeskFlow est prêt à être utilisé.');
            setActiveTab('tickets');
            navigate('/tickets');
          }}
        />
      </>
    );
  }

  const currentRole = session.user.role;
  const isAdmin = currentRole === 'ADMIN';
  const isChefDeSupport = currentRole === 'CHEF_DE_SUPPORT';
  const isTechnician = currentRole === 'TECHNICIAN';
  const canAccessManagement = isAdmin || isChefDeSupport;

  // Keep selectedTicket updated if it changes in store
  const activeSelectedTicket = selectedTicket
    ? {
        ...(tickets.find((t) => t.id === selectedTicket.id) || selectedTicket),
        comments: selectedTicket.comments,
        history: selectedTicket.history,
        attachments: selectedTicket.attachments,
      }
    : null;

  return (
    <div className="min-h-screen bg-[#FBFBFB] text-neutral-900 flex flex-col font-sans">
      <Header
        session={session}
        activeTab={activeTab}
        isOnline={deskflowStore.getIsOnline()}
        onSelectTab={(tab) => {
          if (tab === 'admin' && !canAccessManagement) return;
          if (tab === 'my-assigned' && !isTechnician) return;
          setActiveTab(tab);
          navigate(getPathForTab(tab));
        }}
        onOpenCreateTicket={() => setIsCreateModalOpen(true)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onLogout={() => {
          deskflowStore.logout();
          setAuthMode('LOGIN');
          navigate('/login');
        }}
        pendingApprovalsCount={metrics.pendingApprovalTickets}
        notifications={notifications}
        onMarkNotificationsRead={() => setNotifications((current) =>
          current.map((notification) => ({ ...notification, read: true }))
        )}
        onSelectNotification={(notification) => {
          setNotifications((current) => current.map((item) =>
            item.id === notification.id ? { ...item, read: true } : item
          ));
          const ticket = tickets.find((item) => item.id === notification.ticketId);
          if (ticket) {
            setSelectedTicket(ticket);
            void deskflowStore.getTicket(ticket.id).then(setSelectedTicket).catch((error: unknown) => {
              setActionError(error instanceof Error ? t(error.message) : t('Impossible de charger le ticket.'));
            });
          }
        }}
      />

      <main className="flex-1 p-6 md:p-8 max-w-6xl mx-auto w-full">
        {successNotice && (
          <div role="status" className="mb-4 p-3 rounded border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm">
            {t(successNotice)}
            <button type="button" className="ml-3 underline" onClick={() => setSuccessNotice(null)}>
              Fermer
            </button>
          </div>
        )}
        {actionError && (
          <div role="alert" className="mb-4 p-3 rounded border border-rose-200 bg-rose-50 text-rose-800 text-sm">
            {t(actionError)}
            <button type="button" className="ml-3 underline" onClick={() => setActionError(null)}>
              Fermer
            </button>
          </div>
        )}
        {activeTab === 'tickets' && (
          <TicketList
            tickets={tickets}
            onSelectTicket={(t) => {
              setSelectedTicket(t);
              void deskflowStore.getTicket(t.id).then(setSelectedTicket).catch((error: unknown) => {
                setActionError(error instanceof Error ? error.message : 'Impossible de charger le ticket.');
              });
            }}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
            onTakeTicket={(tId) => runAction(() => deskflowStore.takeTicket(tId))}
            onAcceptTicket={(tId) => runAction(() => deskflowStore.acceptTicket(tId))}
            onReassignToAvailableColleague={(tId) => runAction(() => deskflowStore.reassignToAvailableColleague(tId))}
            userRole={currentRole}
            currentUserId={session.user.id}
            isOnlyAssignedToMe={false}
          />
        )}

        {activeTab === 'my-assigned' && isTechnician && (
          <TicketList
            tickets={tickets}
            onSelectTicket={(t) => {
              setSelectedTicket(t);
              void deskflowStore.getTicket(t.id).then(setSelectedTicket).catch((error: unknown) => {
                setActionError(error instanceof Error ? error.message : 'Impossible de charger le ticket.');
              });
            }}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
            onTakeTicket={(tId) => runAction(() => deskflowStore.takeTicket(tId))}
            onAcceptTicket={(tId) => runAction(() => deskflowStore.acceptTicket(tId))}
            onReassignToAvailableColleague={(tId) => runAction(() => deskflowStore.reassignToAvailableColleague(tId))}
            userRole={currentRole}
            currentUserId={session.user.id}
            isOnlyAssignedToMe={true}
          />
        )}

        {activeTab === 'admin' && canAccessManagement && (
          <AdminDashboard
            metrics={metrics}
            tickets={tickets}
            users={users}
            auditLogs={auditLogs}
            slaPolicies={slaPolicies}
            departments={departments}
            currentUserRole={currentRole}
            onAssignTicket={(tId, techId) => runAction(() => deskflowStore.assignTicket(tId, techId))}
            onReassignToAvailableColleague={(tId) => runAction(() => deskflowStore.reassignToAvailableColleague(tId))}
            onApproveBudget={(tId, notes) => runAction(() => deskflowStore.approveBudget(tId, notes))}
            onRejectTicket={(tId, reason) => runAction(() => deskflowStore.rejectTicket(tId, reason))}
            onCreateUser={(params) =>
              deskflowStore.createUser(params).catch((error: unknown) => {
                setActionError(error instanceof Error ? error.message : 'La création du compte a échoué.');
                throw error;
              })
            }
            onUpdateUserRole={(uId, r) => runAction(() => deskflowStore.updateUserRole(uId, r))}
            onUpdateUserDepartment={(uId, dept) => runAction(() => deskflowStore.updateUserDepartment(uId, dept))}
            onToggleUserActive={(uId) => runAction(() => deskflowStore.toggleUserActive(uId))}
            onSetUserPassword={(uId, password) => deskflowStore.setUserPassword(uId, password)}
            onUpdateSla={(priority, hours) => runAction(() => deskflowStore.updateSlaPolicy(priority, hours))}
            onCreateDepartment={(name) => deskflowStore.createDepartment(name)}
            onRenameDepartment={(oldName, newName) => deskflowStore.renameDepartment(oldName, newName)}
            onDeleteDepartment={(name) => deskflowStore.deleteDepartment(name)}
            onSelectTicket={(t) => {
              setSelectedTicket(t);
              void deskflowStore.getTicket(t.id).then(setSelectedTicket).catch((error: unknown) => {
                setActionError(error instanceof Error ? error.message : 'Impossible de charger le ticket.');
              });
            }}
          />
        )}
      </main>

      {/* Modals */}
      <TicketCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        userRole={currentRole}
        getCategorySLA={deskflowStore.getCategorySLA}
        onCreate={(params) =>
          deskflowStore.createTicket(params).catch((error: unknown) => {
            void deskflowStore.refresh().catch((refreshError: unknown) => {
              setActionError((previous) =>
                `${previous || ''} Actualisation impossible : ${
                  refreshError instanceof Error ? refreshError.message : 'erreur inconnue'
                }`
              );
            });
            setActionError(error instanceof Error ? error.message : 'La création du ticket a échoué.');
            throw error;
          })
        }
      />

      <TicketDetailModal
        ticket={activeSelectedTicket}
        onClose={() => setSelectedTicket(null)}
        users={users}
        currentRole={currentRole}
        currentUserId={session.user.id}
        onUpdateStatus={(tId, s, notes) => runAction(() => deskflowStore.updateTicketStatus(tId, s, notes))}
        onAssign={(tId, techId) => runAction(() => deskflowStore.assignTicket(tId, techId))}
        onTakeTicket={(tId) => runAction(() => deskflowStore.takeTicket(tId))}
        onAcceptTicket={(tId) => runAction(() => deskflowStore.acceptTicket(tId))}
        onReassignToAvailableColleague={(tId) => runAction(() => deskflowStore.reassignToAvailableColleague(tId))}
        onApproveBudget={(tId, notes) => runAction(() => deskflowStore.approveBudget(tId, notes))}
        onRejectTicket={(tId, reason) => runAction(() => deskflowStore.rejectTicket(tId, reason))}
        onDeleteTicket={(tId) => {
          runAction(() => deskflowStore.deleteTicket(tId));
          setSelectedTicket(null);
        }}
        onAddComment={(tId, c) => runAction(() => deskflowStore.addComment(tId, c))}
      />

      <ProfileEditModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={session.user}
        onSave={(updates) => deskflowStore.updateProfile(updates)}
      />
    </div>
  );
}
