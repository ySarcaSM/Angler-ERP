import React from 'react';
import { Menu, Bell, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Topbar({ onMenuToggle }) {
  const { user, company } = useAuth();

  return (
    <header className="h-16 bg-dark-900/80 backdrop-blur-xl border-b border-dark-700/50 flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-xl text-dark-400 hover:text-primary-300 hover:bg-dark-800 transition-all"
        >
          <Menu size={20} />
        </button>

        <div className="hidden sm:flex items-center gap-2 bg-dark-800 border border-dark-700/50 rounded-xl px-4 py-2 w-72">
          <Search size={16} className="text-dark-500" />
          <input
            type="text"
            placeholder="Buscar..."
            className="bg-transparent text-sm text-dark-100 placeholder:text-dark-500 outline-none w-full"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-xl text-dark-400 hover:text-primary-300 hover:bg-dark-800 transition-all">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        <div className="hidden md:flex items-center gap-3 pl-3 border-l border-dark-700/50">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-400/20 to-primary-700/20 border border-primary-400/20 flex items-center justify-center text-primary-300 text-xs font-bold">
            {user?.name?.[0]}{user?.lastName?.[0] || ''}
          </div>
          <div>
            <div className="text-sm font-medium text-dark-100">{user?.name}</div>
            <div className="text-xs text-dark-500">{company?.name}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
