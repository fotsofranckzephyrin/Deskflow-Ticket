import React from 'react';
import {
  LayoutDashboard,
  Boxes,
  ArrowLeftRight,
  ShoppingCart,
  Building2,
  Code2,
  Sliders,
} from 'lucide-react';
import { AuthSession } from '../../types';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  session: AuthSession | null;
  lowStockCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  session,
  lowStockCount,
}) => {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Tableau de bord',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'inventory',
      label: 'Stocks & Produits',
      icon: Boxes,
      badge: lowStockCount > 0 ? `${lowStockCount} alertes` : null,
    },
    {
      id: 'movements',
      label: 'Journal & Audit',
      icon: ArrowLeftRight,
      badge: null,
    },
    {
      id: 'orders',
      label: 'Ventes & Concurrence',
      icon: ShoppingCart,
      badge: null,
    },
    {
      id: 'warehouses',
      label: 'Entrepôts',
      icon: Building2,
      badge: null,
    },
    {
      id: 'architecture',
      label: 'Architecture Go',
      icon: Code2,
      badge: null,
    },
    {
      id: 'admin',
      label: 'Administration',
      icon: Sliders,
      badge: null,
    },
  ];

  return (
    <aside className="w-56 bg-white border-r border-neutral-200 flex flex-col justify-between shrink-0 min-h-[calc(100vh-49px)]">
      <div className="p-3 space-y-4">
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-neutral-100 text-neutral-900 font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-neutral-500 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[11px] font-mono text-neutral-600 font-medium">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Info Footer */}
      <div className="p-3 border-t border-neutral-200">
        {session ? (
          <div className="text-xs">
            <div className="font-medium text-neutral-900 truncate">
              {session.user.fullName}
            </div>
            <div className="text-[11px] text-neutral-500 truncate font-mono">
              {session.user.email}
            </div>
          </div>
        ) : (
          <div className="text-xs text-neutral-500">
            Session invité
          </div>
        )}
      </div>
    </aside>
  );
};
