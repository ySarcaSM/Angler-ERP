import React from 'react';
import { ArrowRight, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import { PROFILE_GROUPS } from '../../data/budgetProfiles';

export default function ProfilesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Perfis" subtitle="Escolha um grupo para calcular materiais dos produtos" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {PROFILE_GROUPS.map((group) => (
          <Link key={group.slug} to={`/app/budgets/profiles/${group.slug}`} className="card p-5 hover:border-primary-400/40 transition-colors group">
            <div className="flex items-start justify-between gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-400/10 flex items-center justify-center"><Package size={20} className="text-primary-400" /></div>
              <ArrowRight size={18} className="text-dark-500 group-hover:text-primary-300 transition-colors" />
            </div>
            <h2 className="text-base font-semibold text-dark-100 mt-4">{group.name}</h2>
            <p className="text-sm text-dark-500 mt-1">{group.description}</p>
            <div className="text-xs text-primary-400 mt-4">{group.items.length} perfis disponíveis</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
