import React, { useState } from 'react';
import { LogOut, Plus, Menu, X, WifiOff, Bell, CheckCheck } from 'lucide-react';
import { AuthSession } from '../../types';
import { LanguageSwitcher, useLanguage } from '../../traduction';

export interface UserNotification {
  id: string;
  ticketId: string;
  ticketNumber: string;
  title: string;
  description: string;
  message: string;
  createdAt: string;
  read: boolean;
}

interface HeaderProps {
  session: AuthSession | null;
  activeTab: string;
  isOnline?: boolean;
  onSelectTab: (tab: string) => void;
  onOpenCreateTicket: () => void;
  onLogout: () => void;
  onOpenProfile?: () => void;
  pendingApprovalsCount: number;
  notifications?: UserNotification[];
  onSelectNotification?: (notification: UserNotification) => void;
  onMarkNotificationsRead?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  session,
  activeTab,
  isOnline = true,
  onSelectTab,
  onOpenCreateTicket,
  onLogout,
  onOpenProfile,
  pendingApprovalsCount,
  notifications = [],
  onSelectNotification,
  onMarkNotificationsRead,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { t } = useLanguage();
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const role = session?.user.role || 'USER';
  const isAdmin = role === 'ADMIN';
  const isChefDeSupport = role === 'CHEF_DE_SUPPORT';
  const isTechnician = role === 'TECHNICIAN';
  const isChefDeService = role === 'CHEF_DE_SERVICE';
  const canAccessManagement = isAdmin || isChefDeSupport;

  const getTicketsTabLabel = () => {
    if (isAdmin || isChefDeSupport) return t('File Centrale & Priorités');
    if (isTechnician) return t('File d\'Intervention Support');
    if (isChefDeService) return `${t('Demandes du Service')} (${session?.user.department})`;
    return t('Mes Demandes');
  };

  const getRoleBadgeLabel = () => {
    switch (role) {
      case 'CHEF_DE_SERVICE':
        return t('CHEF DE SERVICE');
      case 'CHEF_DE_SUPPORT':
        return t('CHEF DE SUPPORT');
      case 'TECHNICIAN':
        return t('TECHNICIEN');
      case 'ADMIN':
        return t('ADMINISTRATEUR');
      default:
        return t('COLLABORATEUR');
    }
  };

  const handleTabClick = (tab: string) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Offline Status Warning Bar */}
      {!isOnline && (
        <div className="bg-amber-100 border-b border-amber-300 text-amber-900 px-4 py-1.5 text-xs flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>
            <strong>{t('Connexion interrompue :')}</strong> {t('Les actions nécessitent une connexion active au serveur DeskFlow.')}
          </span>
        </div>
      )}

      <header className="sticky top-0 z-30 bg-white border-b border-neutral-200">
        <div className="flex items-center justify-between gap-4 px-4 sm:px-6 py-3">
          {/* Zone 1: Mobile toggle & Wordmark */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 text-neutral-600 hover:text-neutral-900 focus:outline-none"
              aria-label={t('Menu')}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                handleTabClick('tickets');
              }}
              className="text-base font-semibold tracking-tight text-neutral-900 whitespace-nowrap shrink-0 flex items-center gap-2"
            >
              <span>DeskFlow</span>
            </a>

            {/* Statut Réseau discret */}
            <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-neutral-500 font-mono pl-3 border-l border-neutral-200">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span>{isOnline ? t('Temps réel actif') : t('Hors ligne')}</span>
            </div>
          </div>

          {/* Zone 2: Navigation desktop */}
          <nav className="hidden md:flex items-center gap-6 text-sm text-neutral-600">
            <button
              onClick={() => handleTabClick('tickets')}
              className={`hover:text-neutral-900 transition-colors whitespace-nowrap ${
                activeTab === 'tickets' ? 'text-neutral-900 font-semibold' : ''
              }`}
            >
              {getTicketsTabLabel()}
            </button>

            {isTechnician && (
              <button
                onClick={() => handleTabClick('my-assigned')}
                className={`hover:text-neutral-900 transition-colors whitespace-nowrap ${
                  activeTab === 'my-assigned' ? 'text-neutral-900 font-semibold' : ''
                }`}
              >
                {t('Mes Assignations')}
              </button>
            )}

            {canAccessManagement && (
              <button
                onClick={() => handleTabClick('admin')}
                className={`hover:text-neutral-900 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === 'admin' ? 'text-neutral-900 font-semibold' : ''
                }`}
              >
                <span>
                  {t(isAdmin ? 'Administration & Gouvernance' : 'Console Supervision')}
                </span>
                {isAdmin && pendingApprovalsCount > 0 && (
                  <span className="font-mono text-[10px] text-neutral-900 bg-neutral-100 border border-neutral-300 px-1.5 py-0.2 rounded font-semibold">
                    {pendingApprovalsCount}
                  </span>
                )}
              </button>
            )}
          </nav>

          {/* Zone 3: Action & Profile */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <LanguageSwitcher />
            {session && (
              <div className="relative">
                <button
                  type="button"
                  aria-label={t('Notifications')}
                  aria-expanded={notificationsOpen}
                  onClick={() => setNotificationsOpen((open) => !open)}
                  className="relative rounded p-2 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-rose-600 px-1 text-center text-[9px] font-semibold leading-4 text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                {notificationsOpen && (
                  <section className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg">
                    <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
                      <h2 className="text-xs font-semibold text-neutral-900">{t('Notifications')}</h2>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={onMarkNotificationsRead}
                          className="inline-flex items-center gap-1 text-[10px] text-neutral-600 hover:text-neutral-900"
                        >
                          <CheckCheck className="h-3 w-3" />
                          {t('Tout marquer comme lu')}
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="px-3 py-6 text-center text-xs text-neutral-500">{t('Aucune notification.')}</p>
                      ) : notifications.map((notification) => (
                        <button
                          type="button"
                          key={notification.id}
                          onClick={() => {
                            onSelectNotification?.(notification);
                            setNotificationsOpen(false);
                          }}
                          className={`block w-full border-b border-neutral-100 px-3 py-2.5 text-left hover:bg-neutral-50 ${
                            notification.read ? 'bg-white' : 'bg-sky-50'
                          }`}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] font-semibold text-neutral-800">{notification.ticketNumber}</span>
                            {!notification.read && <span className="h-1.5 w-1.5 rounded-full bg-sky-600" />}
                          </span>
                          <span className="mt-1 block text-xs font-medium text-neutral-900">{notification.message}</span>
                          <span className="mt-0.5 block text-[11px] text-neutral-600">{notification.title}</span>
                          <span className="mt-1 block line-clamp-2 text-[10px] text-neutral-500">{notification.description}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
            <button
              onClick={onOpenCreateTicket}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isChefDeService ? t('Demande urgente') : t('Nouvelle demande')}</span>
            </button>

            {session && (
              <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-neutral-200 text-xs text-neutral-600">
                <button
                  type="button"
                  onClick={onOpenProfile}
                  title="Modifier mon profil"
                  className="text-right hidden sm:block hover:opacity-80 transition-opacity text-left"
                >
                  <div className="font-medium text-neutral-900 hover:underline">{session.user.fullName}</div>
                  <div className="text-[10px] text-neutral-400 font-mono truncate max-w-[150px]">
                    {session.user.department}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={onOpenProfile}
                  title="Modifier mon profil"
                  className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-medium border cursor-pointer hover:opacity-90 ${
                    isChefDeService || isChefDeSupport
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-neutral-100 text-neutral-700 border-neutral-200'
                  }`}
                >
                  {getRoleBadgeLabel()}
                </button>
                <button
                  onClick={onLogout}
                  title={t('Déconnexion')}
                  className="p-1 text-neutral-400 hover:text-neutral-700 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation Drawer / Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-neutral-200 bg-neutral-50 px-4 py-3 space-y-2 text-xs">
            <div className="pb-2 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <div className="font-medium text-neutral-900">{session?.user.fullName}</div>
                <div className="text-[11px] text-neutral-500 font-mono">{session?.user.department}</div>
              </div>
              {onOpenProfile && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenProfile();
                  }}
                  className="px-2 py-1 text-[11px] bg-white border border-neutral-300 rounded font-medium text-neutral-800"
                >
                  {t('Mon profil')}
                </button>
              )}
            </div>

            <div className="space-y-1">
              <button
                onClick={() => handleTabClick('tickets')}
                className={`w-full text-left px-3 py-2 rounded font-medium transition-colors ${
                  activeTab === 'tickets' ? 'bg-white text-neutral-900 border border-neutral-200' : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                {getTicketsTabLabel()}
              </button>

              {isTechnician && (
                <button
                  onClick={() => handleTabClick('my-assigned')}
                  className={`w-full text-left px-3 py-2 rounded font-medium transition-colors ${
                    activeTab === 'my-assigned' ? 'bg-white text-neutral-900 border border-neutral-200' : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  {t('Mes Assignations')}
                </button>
              )}

              {canAccessManagement && (
                <button
                  onClick={() => handleTabClick('admin')}
                  className={`w-full text-left px-3 py-2 rounded font-medium transition-colors flex items-center justify-between ${
                    activeTab === 'admin' ? 'bg-white text-neutral-900 border border-neutral-200' : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <span>{t(isAdmin ? 'Administration & Gouvernance' : 'Console Supervision')}</span>
                  {isAdmin && pendingApprovalsCount > 0 && (
                    <span className="font-mono text-[10px] text-neutral-900 bg-neutral-200 px-1.5 py-0.5 rounded">
                      {pendingApprovalsCount}
                    </span>
                  )}
                </button>
              )}
            </div>

            <div className="pt-2 border-t border-neutral-200 flex items-center justify-between">
              <span className="text-[11px] text-neutral-500 font-mono">
                {isOnline ? t('En ligne · Synchronisé') : t('Hors ligne')}
              </span>
              <button
                onClick={onLogout}
                className="text-neutral-700 font-medium hover:text-neutral-900 flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t('Déconnexion')}</span>
              </button>
            </div>
          </div>
        )}
      </header>
    </>
  );
};
