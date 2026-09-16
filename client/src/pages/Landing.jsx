import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BarChart3, Users, Package, ShoppingCart, Truck,
  DollarSign, TrendingUp, Settings, Shield, Zap, Globe, Lock,
  ChevronLeft, ChevronRight, AlertTriangle, Clock, CheckCircle2,
} from 'lucide-react';

const MODULES = [
  { icon: BarChart3, label: 'Dashboard', desc: 'KPIs em tempo real, gráficos de vendas e visão geral do negócio.' },
  { icon: Users, label: 'Clientes', desc: 'CRM completo com busca, endereço e status.' },
  { icon: Package, label: 'Produtos', desc: 'Cadastro com preços, categorias e controle de estoque.' },
  { icon: ShoppingCart, label: 'Vendas', desc: 'Pedidos e orçamentos com aprovação automática.' },
  { icon: Truck, label: 'Compras', desc: 'Pedidos com recebimento automático de estoque.' },
  { icon: DollarSign, label: 'Financeiro', desc: 'Contas a pagar/receber e fluxo de caixa.' },
  { icon: TrendingUp, label: 'Relatórios', desc: 'Análises de vendas, lucro e margem.' },
  { icon: Settings, label: 'Configurações', desc: 'Empresa, usuários e log de auditoria.' },
];

const STATS = [
  { value: '10+', label: 'Módulos integrados' },
  { value: '0', label: 'Custo para começar' },
  { value: '100%', label: 'Open source' },
  { value: '< 5min', label: 'Para configurar' },
];

// ─── Dados reais do dashboard ───
const KPI_DATA = [
  { label: 'Receita Mensal', value: 'R$ 47.832', change: '+12,5%', up: true, icon: DollarSign },
  { label: 'Vendas no Mês', value: '186', change: '+8,3%', up: true, icon: ShoppingCart },
  { label: 'Clientes Ativos', value: '1.248', change: '+3,1%', up: true, icon: Users },
  { label: 'Estoque Baixo', value: '12 itens', change: 'Atenção', up: false, icon: AlertTriangle },
];

const SALES_CHART = [
  { day: 'Seg', value: 4200 },
  { day: 'Ter', value: 3800 },
  { day: 'Qua', value: 5100 },
  { day: 'Qui', value: 4600 },
  { day: 'Sex', value: 6200 },
  { day: 'Sáb', value: 3400 },
  { day: 'Dom', value: 1800 },
];

const TOP_PRODUCTS = [
  { name: 'Notebook Dell i7', qty: 34, total: 'R$ 89.760', pct: 100 },
  { name: 'Monitor 27" 4K', qty: 52, total: 'R$ 51.480', pct: 57 },
  { name: 'Teclado Mecânico', qty: 128, total: 'R$ 38.400', pct: 43 },
  { name: 'Mouse Wireless', qty: 95, total: 'R$ 14.250', pct: 16 },
  { name: 'Hub USB-C', qty: 210, total: 'R$ 12.600', pct: 14 },
];

const RECENT_SALES = [
  { id: '#VDA-0186', client: 'TechCorp Ltda', value: 'R$ 4.320', status: 'Aprovado', time: '2min atrás' },
  { id: '#VDA-0185', client: 'João Silva', value: 'R$ 890', status: 'Pendente', time: '15min atrás' },
  { id: '#VDA-0184', client: 'StartupXYZ', value: 'R$ 12.500', status: 'Aprovado', time: '1h atrás' },
  { id: '#VDA-0183', client: 'Maria Santos', value: 'R$ 2.150', status: 'Enviado', time: '2h atrás' },
];

const LOW_STOCK = [
  { name: 'Mouse Wireless', current: 3, min: 10, critical: true },
  { name: 'Cabo HDMI 2m', current: 7, min: 15, critical: true },
  { name: 'Webcam 1080p', current: 12, min: 10, critical: false },
  { name: 'Fone Bluetooth', current: 5, min: 8, critical: true },
];

const MAX_SALE = Math.max(...SALES_CHART.map((d) => d.value));

// ─── Tech Stack Carousel ───
const TECH_STACK = [
  { name: 'React 18', color: '#61dafb', desc: 'UI Library' },
  { name: 'Vite', color: '#bd34fe', desc: 'Build Tool' },
  { name: 'Tailwind CSS', color: '#38bdf8', desc: 'Estilos' },
  { name: 'Firebase', color: '#ffca28', desc: 'Backend' },
  { name: 'Firestore', color: '#ff6f00', desc: 'Database' },
  { name: 'Recharts', color: '#f7df1e', desc: 'Gráficos' },
  { name: 'Lucide', color: '#f472b6', desc: 'Ícones' },
  { name: 'date-fns', color: '#22d3ee', desc: 'Datas' },
  { name: 'React Router', color: '#ef4444', desc: 'Rotas' },
  { name: 'Hot Toast', color: '#f97316', desc: 'Notificações' },
];

function Reveal({ children, className = '' }) {
  return <div className={`reveal ${className}`}>{children}</div>;
}

function formatBRL(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Landing() {
  const carouselRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    const onScroll = () => document.getElementById('lp-nav')?.classList.toggle('scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => { observer.disconnect(); window.removeEventListener('scroll', onScroll); };
  }, []);

  const updateCarouselBtns = () => {
    const el = carouselRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  const scrollCarousel = (dir) => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 260, behavior: 'smooth' });
    setTimeout(updateCarouselBtns, 350);
  };

  return (
    <div className="lp">
      <div className="lp-noise" />

      {/* ═══ NAV ═══ */}
      <nav className="lp-nav" id="lp-nav">
        <div className="lp-nav-inner">
          <Link to="/" className="lp-logo">
            <svg viewBox="0 0 28 28" width="28" height="28" fill="none">
              <path d="M6 14C6 9.58 9.58 6 14 6C18.42 6 22 9.58 22 14" stroke="url(#g1)" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="14" cy="18" r="1.8" fill="url(#g1)"/>
              <path d="M14 18V22" stroke="url(#g1)" strokeWidth="2" strokeLinecap="round"/>
              <path d="M10 22H18" stroke="url(#g1)" strokeWidth="2" strokeLinecap="round"/>
              <defs><linearGradient id="g1" x1="6" y1="6" x2="22" y2="22"><stop stopColor="#f5d17d"/><stop offset="1" stopColor="#b5882b"/></linearGradient></defs>
            </svg>
            <span>Angler</span>
          </Link>
          <div className="lp-nav-right">
            <a href="#modules">Módulos</a>
            <a href="#why">Por quê?</a>
            <Link to="/login" className="lp-btn lp-btn-ghost-sm">Entrar</Link>
            <Link to="/register" className="lp-btn lp-btn-gold-sm">Criar Conta</Link>
          </div>
        </div>
      </nav>

      {/* ═══ HERO — Split: Text + Real Dashboard ═══ */}
      <section className="lp-hero">
        <div className="lp-hero-grid">
          <div className="lp-hero-text">
            <div className="lp-chip">
              <span className="lp-chip-dot" />
              Open Source &bull; Gratuito
            </div>
            <h1>
              Seu ERP<br />
              <span className="lp-gold-text">em minutos.</span>
            </h1>
            <p>
              Dashboard, Vendas, Estoque, Financeiro, Compras e Relatórios — tudo integrado. Sem servidor, sem complicação, sem custo.
            </p>
            <div className="lp-hero-btns">
              <Link to="/register" className="lp-btn lp-btn-gold">
                Começar agora <ArrowRight size={18} />
              </Link>
              <Link to="/login" className="lp-btn lp-btn-ghost">
                Já tenho conta
              </Link>
            </div>
          </div>

          {/* ── Real Dashboard Mockup ── */}
          <div className="lp-hero-visual">
            <div className="lp-dash">
              {/* Titlebar */}
              <div className="lp-dash-bar">
                <span className="lp-mock-dot r" />
                <span className="lp-mock-dot y" />
                <span className="lp-mock-dot g" />
                <span className="lp-dash-bar-title">Angler ERP — Dashboard</span>
              </div>

              <div className="lp-dash-body">
                {/* KPI Row */}
                <div className="lp-dash-kpis">
                  {KPI_DATA.map((k) => (
                    <div key={k.label} className="lp-dash-kpi">
                      <div className="lp-dash-kpi-top">
                        <span className="lp-dash-kpi-label">{k.label}</span>
                        <k.icon size={14} className="lp-dash-kpi-icon" />
                      </div>
                      <div className="lp-dash-kpi-value">{k.value}</div>
                      <div className={`lp-dash-kpi-change ${k.up ? 'up' : 'dn'}`}>
                        {k.up ? '↑' : '⚠'} {k.change}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Chart + Recent Sales */}
                <div className="lp-dash-row">
                  {/* Bar Chart */}
                  <div className="lp-dash-chart">
                    <div className="lp-dash-chart-head">
                      <span>Vendas — Setembro 2026</span>
                      <span className="lp-dash-chart-total">R$ 29.100</span>
                    </div>
                    <div className="lp-dash-chart-bars">
                      {SALES_CHART.map((d) => (
                        <div key={d.day} className="lp-dash-chart-col">
                          <div className="lp-dash-chart-bar-wrap">
                            <div
                              className="lp-dash-chart-bar"
                              style={{ height: `${(d.value / MAX_SALE) * 100}%` }}
                            >
                              <span className="lp-dash-chart-tip">{formatBRL(d.value)}</span>
                            </div>
                          </div>
                          <span className="lp-dash-chart-day">{d.day}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent Sales */}
                  <div className="lp-dash-recent">
                    <div className="lp-dash-recent-head">
                      <Clock size={13} />
                      <span>Vendas Recentes</span>
                    </div>
                    <div className="lp-dash-recent-list">
                      {RECENT_SALES.map((s) => (
                        <div key={s.id} className="lp-dash-recent-item">
                          <div className="lp-dash-recent-left">
                            <span className="lp-dash-recent-id">{s.id}</span>
                            <span className="lp-dash-recent-client">{s.client}</span>
                          </div>
                          <div className="lp-dash-recent-right">
                            <span className="lp-dash-recent-val">{s.value}</span>
                            <span className={`lp-dash-recent-status ${s.status === 'Aprovado' ? 'ok' : s.status === 'Pendente' ? 'pend' : 'ship'}`}>
                              {s.status === 'Aprovado' && <CheckCircle2 size={10} />}
                              {s.status === 'Pendente' && <Clock size={10} />}
                              {s.status === 'Enviado' && <Truck size={10} />}
                              {s.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Top Products + Low Stock */}
                <div className="lp-dash-row">
                  <div className="lp-dash-top">
                    <div className="lp-dash-top-head">
                      <TrendingUp size={13} />
                      <span>Top Produtos</span>
                    </div>
                    {TOP_PRODUCTS.map((p) => (
                      <div key={p.name} className="lp-dash-top-item">
                        <div className="lp-dash-top-info">
                          <span className="lp-dash-top-name">{p.name}</span>
                          <span className="lp-dash-top-meta">{p.qty} un &bull; {p.total}</span>
                        </div>
                        <div className="lp-dash-top-bar-bg">
                          <div className="lp-dash-top-bar-fill" style={{ width: `${p.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="lp-dash-stock">
                    <div className="lp-dash-stock-head">
                      <AlertTriangle size={13} />
                      <span>Estoque Baixo</span>
                    </div>
                    {LOW_STOCK.map((s) => (
                      <div key={s.name} className={`lp-dash-stock-item ${s.critical ? 'crit' : 'warn'}`}>
                        <span className="lp-dash-stock-name">{s.name}</span>
                        <span className="lp-dash-stock-nums">
                          <strong>{s.current}</strong> / {s.min}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ STATS BAR ═══ */}
      <section className="lp-stats">
        <div className="lp-stats-inner">
          {STATS.map((s) => (
            <div key={s.label} className="lp-stat">
              <span className="lp-stat-val">{s.value}</span>
              <span className="lp-stat-lab">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ TECH CAROUSEL ═══ */}
      <section className="lp-carousel-section">
        <div className="lp-carousel-head">
          <span className="lp-section-tag">Stack</span>
          <h2>Tecnologias</h2>
        </div>
        <div className="lp-carousel-wrap">
          <button
            className={`lp-carousel-btn left ${!canScrollLeft ? 'hidden' : ''}`}
            onClick={() => scrollCarousel(-1)}
            aria-label="Anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <div
            className="lp-carousel"
            ref={carouselRef}
            onScroll={updateCarouselBtns}
          >
            {TECH_STACK.map((t) => (
              <div key={t.name} className="lp-carousel-card">
                <span className="lp-carousel-dot" style={{ background: t.color }} />
                <span className="lp-carousel-name">{t.name}</span>
                <span className="lp-carousel-desc">{t.desc}</span>
              </div>
            ))}
          </div>
          <button
            className={`lp-carousel-btn right ${!canScrollRight ? 'hidden' : ''}`}
            onClick={() => scrollCarousel(1)}
            aria-label="Próximo"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </section>

      {/* ═══ MODULES ═══ */}
      <section className="lp-section" id="modules">
        <Reveal>
          <div className="lp-section-head">
            <span className="lp-section-tag">Módulos</span>
            <h2>Tudo integrado</h2>
            <p>Oito módulos que cobrem cada área do seu negócio.</p>
          </div>
        </Reveal>
        <div className="lp-mod-grid">
          {MODULES.map((m, i) => (
            <Reveal key={m.label}>
              <div className="lp-mod-card">
                <div className="lp-mod-icon"><m.icon size={20} /></div>
                <div>
                  <h3>{m.label}</h3>
                  <p>{m.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══ WHY ═══ */}
      <section className="lp-section lp-why" id="why">
        <Reveal>
          <div className="lp-section-head">
            <span className="lp-section-tag">Diferenciais</span>
            <h2>Por que Angler?</h2>
          </div>
        </Reveal>
        <div className="lp-why-grid">
          {[
            { icon: Zap, title: 'Setup em minutos', desc: 'Clone, configure Firebase, rode. Sem migrations, sem Docker, sem DevOps.' },
            { icon: Globe, title: 'Multi-tenant', desc: 'Cada empresa tem seus dados isolados. Regras Firestore por companyId.' },
            { icon: Lock, title: 'Segurança real', desc: 'Firebase Auth, RBAC no client, audit log de todas as ações.' },
            { icon: Shield, title: 'Open Source', desc: 'MIT License. Fork, customize, contribua. Seu código, suas regras.' },
          ].map((w) => (
            <Reveal key={w.title}>
              <div className="lp-why-card">
                <div className="lp-why-icon"><w.icon size={22} /></div>
                <h3>{w.title}</h3>
                <p>{w.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="lp-cta">
        <Reveal>
          <div className="lp-cta-inner">
            <h2>Pronto para gerenciar<br /><span className="lp-gold-text">seu negócio?</span></h2>
            <p>Crie sua conta gratuitamente. Sem cartão, sem pegadinha.</p>
            <div className="lp-cta-btns">
              <Link to="/register" className="lp-btn lp-btn-gold">Criar Conta Grátis</Link>
              <Link to="/login" className="lp-btn lp-btn-ghost">Já tenho conta</Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="lp-footer">
        <span>&copy; 2026 Angler ERP</span>
        <span className="lp-footer-sep">&bull;</span>
        <a href="https://github.com/ySarcaSM/Angler-ERP" target="_blank" rel="noopener">GitHub</a>
        <span className="lp-footer-sep">&bull;</span>
        <span>MIT License</span>
      </footer>
    </div>
  );
}
