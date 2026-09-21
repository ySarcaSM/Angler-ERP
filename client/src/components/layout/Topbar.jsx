import React, { useEffect, useState } from 'react';
import { Menu, Bell, Search, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { listProducts } from '../../services/firebase/products';
import { listClients } from '../../services/firebase/clients';
import { listLocations } from '../../services/firebase/locations';
import { listSuppliers } from '../../services/firebase/suppliers';
import { listSales } from '../../services/firebase/sales';
import { listPurchases } from '../../services/firebase/purchases';
import { loadNotifications } from '../../utils/notifications';
import toast from 'react-hot-toast';

function normalize(value) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export default function Topbar({ onMenuToggle }) {
  const navigate = useNavigate();
  const { company, availableCompanies, switchCompany, userData } = useAuth();
  const [search, setSearch] = useState('');
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const isOperator = userData?.role === 'operator';

  const handleCompanyChange = async (companyId) => {
    if (companyId === company?.id) {
      setCompanyMenuOpen(false);
      return;
    }

    try {
      await switchCompany(companyId);
      setCompanyMenuOpen(false);
      toast.success('Empresa alterada.');
    } catch (error) {
      toast.error(error.message || 'Não foi possível trocar de empresa.');
    }
  };

  const moduleTargets = [
    { words: ['produto', 'produtos'], path: '/app/products' },
    { words: ['cliente', 'clientes'], path: '/app/clients' },
    { words: ['venda', 'vendas'], path: '/app/sales' },
    { words: ['compra', 'compras'], path: '/app/purchases' },
    { words: ['fornecedor', 'fornecedores'], path: '/app/suppliers' },
    { words: ['localizacao', 'localizacoes'], path: '/app/locations' },
    { words: ['estoque', 'stock'], path: '/app/stock' },
    { words: ['financeiro', 'financeira'], path: '/app/financial' },
    { words: ['relatorio', 'relatorios'], path: '/app/reports' },
    { words: ['medicao', 'medicoes'], path: '/app/budgets/profiles' },
    { words: ['formula', 'formulas'], path: '/app/budgets/formulas' },
    { words: ['orcamento', 'orcamentos'], path: '/app/budgets' },
  ];

  const navigateToTarget = (path, value) => {
    const query = value ? `?search=${encodeURIComponent(value)}` : '';
    navigate(`${path}${query}`);
  };


  const handleSearch = async (event) => {
    event.preventDefault();
    if (!search.trim()) return;
    const text = search.trim();
    const normalized = normalize(text);
    const firstWord = normalized.split(/\s+/)[0];
    const explicitTarget = moduleTargets.find(({ words }) => words.includes(firstWord));
    if (explicitTarget) {
      navigateToTarget(explicitTarget.path, text.slice(firstWord.length).trim());
      return;
    }

    if (!company?.id) return;
    setSearching(true);
    const targets = [
      { path: '/app/products', loader: () => listProducts(company.id, { pageSize: 200 }) },
      { path: '/app/clients', loader: () => listClients(company.id, { pageSize: 200 }) },
      { path: '/app/locations', loader: () => listLocations(company.id, { pageSize: 200 }) },
      { path: '/app/suppliers', loader: () => listSuppliers(company.id, { pageSize: 200 }) },
      { path: '/app/sales', loader: () => listSales(company.id, { pageSize: 200 }) },
      { path: '/app/purchases', loader: () => listPurchases(company.id, { pageSize: 200 }) },
    ];
    try {
      const results = await Promise.all(targets.map(async (target) => {
        try {
          const response = await target.loader();
          const matches = response.data.filter((record) => normalize(JSON.stringify(record)).includes(normalized));
          return { ...target, matches };
        } catch {
          return { ...target, matches: [] };
        }
      }));
      const match = results.find((result) => result.matches.length > 0);
      navigateToTarget(match?.path || '/app/products', text);
    } finally {
      setSearching(false);
    }
  };

  return (
    <header className="h-16 bg-dark-900/80 backdrop-blur-xl border-b border-dark-700/50 flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-xl text-dark-400 hover:text-primary-300 hover:bg-dark-800 transition-all"
        >
          <Menu size={20} />
        </button>

        {availableCompanies.length > 1 && (
  

      </div>
    </header>
  );
}
