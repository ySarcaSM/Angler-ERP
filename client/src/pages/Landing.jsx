import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Users, Package, ShoppingCart, Truck, Building2, DollarSign, TrendingUp, Settings, Shield, Zap, Globe, Lock, ChevronRight } from 'lucide-react';

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

function Reveal({ children, className = '' }) {
  return <div className={`reveal ${className}`}>{children}</div>;
}

export default function Landing() {
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

      {/* ═══ HERO — Split Layout ═══ */}
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

          {/* Mini dashboard mockup */}
          <div className="lp-hero-visual">
            <div className="lp-mock">
              <div className="lp-mock-bar">
                <span className="lp-mock-dot r" />
                <span className="lp-mock-dot y" />
                <span className="lp-mock-dot g" />
                <span className="lp-mock-title">Dashboard</span>
              </div>
              <div className="lp-mock-body">
                <div className="lp-mock-row">
                  {[
                    { l: 'Receita', v: 'R$ 48.2k', c: '↑ 12%', up: true },
                    { l: 'Vendas', v: '324', c: '↑ 8%', up: true },
                    { l: 'Estoque Baixo', v: '7', c: '', up: false },
                  ].map((k) => (
                    <div key={k.l} className="lp-mock-kpi">
                      <span className="lp-mock-kpi-l">{k.l}</span>
                      <span className="lp-mock-kpi-v">{k.v}</span>
                      {k.c && <span className={`lp-mock-kpi-c ${k.up ? 'up' : 'dn'}`}>{k.c}</span>}
                    </div>
                  ))}
                </div>
                <div className="lp-mock-chart">
                  <div className="lp-mock-bars">
                    {[40, 55, 35, 70, 50, 80, 65, 90, 75, 60, 85, 95].map((h, i) => (
                      <div key={i} className="lp-mock-bar-item" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
                <div className="lp-mock-bottom">
                  <div className="lp-mock-list">
                    {[{ n: 'Produto A', v: 'R$ 12k' }, { n: 'Produto B', v: 'R$ 9.8k' }, { n: 'Produto C', v: 'R$ 7.2k' }].map((p) => (
                      <div key={p.n} className="lp-mock-li">
                        <span className="lp-mock-li-dot" />
                        <span>{p.n}</span>
                        <span className="lp-mock-li-v">{p.v}</span>
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
              <div className="lp-mod-card" style={{ animationDelay: `${i * 60}ms` }}>
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
