import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Users, Package, ShoppingCart, Truck, Building2, DollarSign, TrendingUp, Settings, Shield } from 'lucide-react';

const MODULES = [
  { icon: BarChart3, label: 'Dashboard', desc: 'KPIs em tempo real, gráficos de vendas, top produtos e visão geral do negócio.' },
  { icon: Users, label: 'Clientes', desc: 'CRM completo com busca, endereço, status e histórico de interações.' },
  { icon: Package, label: 'Produtos', desc: 'Cadastro com preços, categorias, código de barras e controle de estoque.' },
  { icon: ShoppingCart, label: 'Vendas', desc: 'Pedidos e orçamentos com aprovação automática de estoque.' },
  { icon: Truck, label: 'Compras', desc: 'Pedidos de compra com recebimento automático e atualização de estoque.' },
  { icon: Building2, label: 'Fornecedores', desc: 'Cadastro completo de fornecedores com dados de contato.' },
  { icon: DollarSign, label: 'Financeiro', desc: 'Contas a pagar e receber, fluxo de caixa e transações.' },
  { icon: TrendingUp, label: 'Relatórios', desc: 'Análises de vendas, lucro, margem e performance por período.' },
  { icon: Settings, label: 'Configurações', desc: 'Dados da empresa, gestão de usuários com RBAC e auditoria.' },
];

const SECURITY = [
  'Firebase Auth (email/senha)',
  'Isolamento por companyId',
  'RBAC (owner, admin, manager, operator, viewer)',
  'Audit log de todas as ações',
  'Regras Firestore por tenant',
  'Validação client + server-side',
];

const STACK = [
  { name: 'React 18', color: '#61dafb' },
  { name: 'Vite', color: '#bd34fe' },
  { name: 'Tailwind CSS', color: '#38bdf8' },
  { name: 'Firebase', color: '#ffca28' },
  { name: 'Firestore', color: '#ff6f00' },
  { name: 'Recharts', color: '#f7df1e' },
  { name: 'Lucide Icons', color: '#f472b6' },
  { name: 'date-fns', color: '#22d3ee' },
];

function Reveal({ children, className = '' }) {
  return <div className={`reveal ${className}`}>{children}</div>;
}

export default function Landing() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

    const onScroll = () => document.getElementById('landing-nav')?.classList.toggle('scrolled', window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => { observer.disconnect(); window.removeEventListener('scroll', onScroll); };
  }, []);

  return (
    <div className="landing-root">
      {/* ═══════ Background Effects ═══════ */}
      <div className="landing-bg-grid" />
      <div className="landing-bg-orbs" />

      {/* ═══════ NAV ═══════ */}
      <nav className="landing-nav" id="landing-nav">
        <div className="landing-nav-inner">
          <Link to="/" className="landing-logo">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">A</div>
            <span>Angler ERP</span>
          </Link>
          <div className="landing-nav-links">
            <a href="#features">Módulos</a>
            <a href="#stack">Tecnologias</a>
            <a href="#security">Segurança</a>
            <Link to="/login" className="landing-btn landing-btn-ghost">Entrar</Link>
            <Link to="/register" className="landing-btn landing-btn-primary">Criar Conta</Link>
          </div>
        </div>
      </nav>

      {/* ═══════ HERO ═══════ */}
      <section className="landing-hero">
        <div className="landing-hero-content">
          <div className="landing-badge">
            <span className="landing-dot" />
            Open Source &bull; MIT License
          </div>
          <h1>
            Gestão empresarial<br />
            <span className="landing-gradient-text">simples e poderosa</span>
          </h1>
          <p>
            Dashboard, Vendas, Estoque, Financeiro, Compras e Relatórios — tudo integrado num único sistema. Sem servidor próprio, sem complicação.
          </p>
          <div className="landing-hero-actions">
            <Link to="/register" className="landing-btn landing-btn-primary landing-btn-xl">
              Começar Grátis <ArrowRight size={18} />
            </Link>
            <Link to="/login" className="landing-btn landing-btn-ghost landing-btn-xl">
              Já tenho conta
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════ DASHBOARD PREVIEW ═══════ */}
      <section className="landing-preview">
        <Reveal>
          <div className="landing-preview-wrapper">
            <div className="landing-preview-glow" />
            <div className="landing-preview-frame">
              <div className="landing-titlebar">
                <span className="landing-dot-sm red" />
                <span className="landing-dot-sm yellow" />
                <span className="landing-dot-sm green" />
              </div>
              <div className="landing-preview-body">
                <div className="landing-mock-dash">
                  <div className="landing-mock-sidebar">
                    {['Dashboard', 'Clientes', 'Produtos', 'Vendas', 'Compras', 'Estoque', 'Financeiro'].map((item, i) => (
                      <div key={item} className={`landing-mock-side-item ${i === 0 ? 'active' : ''}`}>
                        <div className="landing-mock-side-icon" />{item}
                      </div>
                    ))}
                  </div>
                  <div className="landing-mock-main">
                    <div className="landing-mock-kpis">
                      {[
                        { label: 'Receita Mensal', value: 'R$ 48.2k', change: '↑ 12.5%', up: true },
                        { label: 'Vendas', value: '324', change: '↑ 8.3%', up: true },
                        { label: 'Clientes Ativos', value: '1.248', change: '↑ 3.1%', up: true },
                        { label: 'Estoque Baixo', value: '7', change: '↓ 2 itens', up: false },
                      ].map((kpi) => (
                        <div key={kpi.label} className="landing-mock-kpi">
                          <div className="landing-mock-kpi-label">{kpi.label}</div>
                          <div className="landing-mock-kpi-value">{kpi.value}</div>
                          <div className={`landing-mock-kpi-change ${kpi.up ? 'up' : 'down'}`}>{kpi.change}</div>
                        </div>
                      ))}
                    </div>
                    <div className="landing-mock-charts">
                      <div className="landing-mock-chart">
                        <div className="landing-mock-chart-title">Vendas — Últimos 7 dias</div>
                        <div className="landing-mock-bars">
                          {[60, 45, 80, 65, 90, 70, 95].map((h, i) => (
                            <div key={i} className="landing-mock-bar" style={{ height: `${h}%` }} />
                          ))}
                        </div>
                      </div>
                      <div className="landing-mock-chart">
                        <div className="landing-mock-chart-title">Top Produtos</div>
                        <div className="landing-mock-list">
                          {[
                            { name: 'Produto A', val: 'R$ 12.4k', color: '#3b82f6' },
                            { name: 'Produto B', val: 'R$ 9.8k', color: '#8b5cf6' },
                            { name: 'Produto C', val: 'R$ 7.2k', color: '#06b6d4' },
                            { name: 'Produto D', val: 'R$ 5.1k', color: '#f59e0b' },
                          ].map((p) => (
                            <div key={p.name} className="landing-mock-list-item">
                              <div className="landing-mock-list-dot" style={{ background: p.color }} />
                              <span className="landing-mock-list-text">{p.name}</span>
                              <span className="landing-mock-list-val">{p.val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══════ FEATURES ═══════ */}
      <section className="landing-features" id="features">
        <Reveal>
          <div className="landing-section-header">
            <span className="landing-section-tag">Módulos</span>
            <h2>Tudo que sua empresa precisa</h2>
            <p>Nove módulos integrados para cobrir cada área do seu negócio.</p>
          </div>
        </Reveal>
        <div className="landing-features-grid">
          {MODULES.map((mod) => (
            <Reveal key={mod.label}>
              <div className="landing-feature-card">
                <div className="landing-feature-icon"><mod.icon size={22} /></div>
                <h3>{mod.label}</h3>
                <p>{mod.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════ TECH STACK ═══════ */}
      <section className="landing-stack" id="stack">
        <Reveal>
          <div className="landing-section-header">
            <span className="landing-section-tag">Tecnologias</span>
            <h2>Stack moderna e confiável</h2>
            <p>Construído com as melhores ferramentas do ecossistema JavaScript.</p>
          </div>
        </Reveal>
        <Reveal>
          <div className="landing-stack-grid">
            {STACK.map((t) => (
              <div key={t.name} className="landing-stack-pill">
                <span className="landing-tech-dot" style={{ background: t.color }} />
                {t.name}
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ═══════ SECURITY ═══════ */}
      <section className="landing-security" id="security">
        <Reveal>
          <div className="landing-section-header">
            <span className="landing-section-tag">Segurança</span>
            <h2>Seus dados protegidos</h2>
            <p>Autenticação, isolamento multi-tenant e auditoria completa.</p>
          </div>
        </Reveal>
        <Reveal>
          <div className="landing-security-grid">
            {SECURITY.map((item) => (
              <div key={item} className="landing-security-item">
                <div className="landing-security-check"><Shield size={14} /></div>
                {item}
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ═══════ CTA ═══════ */}
      <section className="landing-cta">
        <Reveal>
          <div className="landing-cta-box">
            <h2>Pronto para começar?</h2>
            <p>Crie sua conta gratuitamente e tenha seu ERP funcionando em minutos.</p>
            <div className="landing-cta-actions">
              <Link to="/register" className="landing-btn landing-btn-primary landing-btn-xl">Criar Conta Grátis</Link>
              <Link to="/login" className="landing-btn landing-btn-ghost landing-btn-xl">Já tenho conta — Entrar</Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="landing-footer">
        <p>&copy; 2026 Angler ERP &bull; <a href="https://github.com/ySarcaSM/Angler-ERP" target="_blank" rel="noopener">GitHub</a> &bull; MIT License</p>
      </footer>
    </div>
  );
}
