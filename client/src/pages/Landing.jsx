import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Home, ArrowRight, Users, ShoppingCart, Truck,
  DollarSign, TrendingUp, Shield, Zap, Globe, Lock,
  ChevronLeft, ChevronRight, AlertTriangle, Clock, CheckCircle2,
  Check, Star, Crown, Sparkles,
  Menu, X,
} from 'lucide-react';

import reactLogo from '../assets/tech/react.png';
import viteLogo from '../assets/tech/vite.jpg';
import tailwindcssLogo from '../assets/tech/tailwind.png';
import firebaseLogo from '../assets/tech/firebase.png';
import firestoreLogo from '../assets/tech/firestore.jpg';
import rechartsLogo from '../assets/tech/recharts.jpg';
import lucideLogo from '../assets/tech/lucide.jpg';
import datefnsLogo from '../assets/tech/date-fns.png';
import reactrouterLogo from '../assets/tech/react-router.png';
import hottoastLogo from '../assets/tech/hot-toast.png';
import erpImage from '../assets/erp.jpg';

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
  {
    name: 'React 18', color: '#61dafb',
    items: ['Interfaces reativas e declarativas', 'Componentes reutilizáveis', 'Virtual DOM para performance'],
    image: reactLogo,
  },
  {
    name: 'Vite', color: '#bd34fe',
    items: ['Hot reload instantâneo', 'Bundler otimizado com ESBuild', 'Dev server ultrarrápido'],
    image: viteLogo,
  },
  {
    name: 'Tailwind CSS', color: '#38bdf8',
    items: ['Classes utilitárias no HTML', 'Design responsivo sem CSS custom', 'Produz CSS mínimo no build'],
    image: tailwindcssLogo,
  },
  {
    name: 'Firebase', color: '#ffca28',
    items: ['Autenticação pronta (email, Google)', 'Hospedagem com SSL', 'Backend sem servidor'],
    image: firebaseLogo,
  },
  {
    name: 'Firestore', color: '#ff6f00',
    items: ['Banco NoSQL em tempo real', 'Consultas avançadas por coleção', 'Sync automático entre clientes'],
    image: firestoreLogo,
  },
  {
    name: 'Recharts', color: '#f7df1e',
    items: ['Gráficos declarativos em JSX', 'Construído sobre D3.js', 'Bar, line, pie, area charts'],
    image: rechartsLogo,
  },
  {
    name: 'Lucide', color: '#f472b6',
    items: ['Ícones SVG leves e nítidos', 'Tree-shakeable (só importa o que usa)', 'Fácil de customizar tamanho e cor'],
    image: lucideLogo,
  },
  {
    name: 'date-fns', color: '#22d3ee',
    items: ['Manipulação de datas modular', 'Formatação localizada (pt-BR)', 'Imutável e friend com tree-shaking'],
    image: datefnsLogo,
  },
  {
    name: 'React Router', color: '#ef4444',
    items: ['Rotas aninhadas e declarativas', 'Lazy loading de páginas', 'Navegação programática'],
    image: reactrouterLogo,
  },
  {
    name: 'Hot Toast', color: '#f97316',
    items: ['Notificações toast elegantes', 'Animações suaves de entrada/saída', 'Acessível e customizável'],
    image: hottoastLogo,
  },
];

function Reveal({ children, className = '' }) {
  return <div className={`reveal ${className}`}>{children}</div>;
}

function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`lp-faq-item ${open ? 'open' : ''}`}>
      <button className="lp-faq-q" onClick={() => setOpen(!open)}>
        <span>{question}</span>
        <ChevronRight size={18} className="lp-faq-chevron" />
      </button>
      <div className="lp-faq-a-wrap">
        <div className="lp-faq-a">
          <p>{answer}</p>
        </div>
      </div>
    </div>
  );
}

function formatBRL(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Landing() {
  const carouselRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const pausedRef = useRef(false);
  const scrollPosRef = useRef(0);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  // Auto-scroll do carousel (px/s — mude PX_PER_SEC para ajustar a velocidade)
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;

    const PX_PER_SEC = 30; // ← VELOCIDADE: funciona em qualquer valor, mesmo baixo
    let lastTime = null;
    let rafId = null;

    // posição acumulada com casas decimais — el.scrollLeft é sempre inteiro
    // e arredonda incrementos pequenos para zero, travando o auto-scroll
    scrollPosRef.current = el.scrollLeft;

    const tick = (now) => {
      const maxScroll = el.scrollWidth - el.clientWidth;

      if (lastTime !== null && !pausedRef.current && maxScroll > 0) {
        const delta = (now - lastTime) / 1000; // segundos
        scrollPosRef.current += PX_PER_SEC * delta;

        const cycleWidth = el.scrollWidth / 2; // largura de 1 set de itens (conteúdo duplicado)
        if (scrollPosRef.current >= cycleWidth) {
          scrollPosRef.current -= cycleWidth; // reset invisível pro começo do 1º set
        }

        el.scrollLeft = scrollPosRef.current;
      }

      lastTime = now;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handleCarouselEnter = () => { pausedRef.current = true; };
  const handleCarouselLeave = () => { pausedRef.current = false; };

  const updateCarouselBtns = () => {
    const el = carouselRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    scrollPosRef.current = el.scrollLeft; // resincroniza após scroll manual (arraste, setas)
  };

  const scrollCarousel = (dir) => {
    const el = carouselRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 300, behavior: 'smooth' });
    setTimeout(updateCarouselBtns, 350);
  };

  const scrollTo = (id) => (e) => {
    e.preventDefault();
    setMobileOpen(false);
    const el = document.getElementById(id);
    if (!el) return;
    // Scrolla1px pra forçar re-trigger quando já estiver na seção
    window.scrollTo({ top: window.scrollY - 1, behavior: 'instant' });
    requestAnimationFrame(() => {
      const y = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  };

  const scrollToTop = (e) => {
    e.preventDefault();
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="lp">
      <div className="lp-noise" />

      {/* ═══ NAV ═══ */}
      <nav className="lp-nav" id="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-nav-right">
            <a href="#" onClick={scrollToTop}><Home size={18} style={{ verticalAlign: 'middle' }} /></a>
            <a href="#why" onClick={scrollTo('why')}>Por quê?</a>
            <a href="#pricing" onClick={scrollTo('pricing')}>Planos</a>
            <a href="#faq" onClick={scrollTo('faq')}>FAQ</a>
            <a href="#tech" onClick={scrollTo('tech')}>Tecnologias</a>
            <a href="#contact" onClick={scrollTo('contact')}>Contato</a>
            <Link to="/login" className="lp-btn lp-btn-ghost-sm">Entrar</Link>
            <Link to="/register" className="lp-btn lp-btn-gold-sm">Criar Conta</Link>
          </div>
          <button className="lp-nav-hamburger" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {/* ═══ MOBILE MENU ═══ */}
      <div className={`lp-mobile-menu ${mobileOpen ? 'open' : ''}`}>
        <div className="lp-mobile-menu-inner">
          <a href="#" onClick={scrollToTop}><Home size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />Home</a>
          <a href="#why" onClick={scrollTo('why')}>Por quê?</a>
          <a href="#pricing" onClick={scrollTo('pricing')}>Planos</a>
          <a href="#faq" onClick={scrollTo('faq')}>FAQ</a>
          <a href="#tech" onClick={scrollTo('tech')}>Tecnologias</a>
          <a href="#contact" onClick={scrollTo('contact')}>Contato</a>
          <div className="lp-mobile-menu-btns">
            <Link to="/login" className="lp-btn lp-btn-ghost" onClick={() => setMobileOpen(false)}>Entrar</Link>
            <Link to="/register" className="lp-btn lp-btn-gold" onClick={() => setMobileOpen(false)}>Criar Conta</Link>
          </div>
        </div>
      </div>

      {/* ═══ HERO — Split: Text + Real Dashboard ═══ */}
      <section className="lp-hero">
        <div className="lp-hero-grid">
          <div className="lp-hero-text">
            <div className="lp-brand-block">
              <div className="lp-brand-wrap">
                <div className="lp-brand-hero">Angler</div>
                <img src="../logo.png" alt="logo Angler" className="lp-brand-logo" />
              </div>
              <div className="lp-chip">
                <span className="lp-chip-dot" />
                Open Source &bull; Gratuito
              </div>
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

          {/* ── ERP Image Mockup ── */}
          <div className="lp-hero-visual">
            <img src={erpImage} alt="Dashboard do ERP Angler" className="lp-erp-image" />
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

      {/* ═══ WHY ═══ */}
      <section className="lp-section lp-why" id="why">
        <Reveal>
          <div className="lp-section-head">
            <span className="lp-section-tag">Diferenciais</span>
            <h2>Por que Angler?</h2>
            <p className="lp-section-sub">Tudo que você precisa para rodar seu negócio, sem a complexidade de um ERP tradicional.</p>
          </div>
        </Reveal>
        <div className="lp-why-grid">
          {[
            { icon: Zap, title: 'Setup em minutos', desc: 'Clone, configure Firebase e rode. Sem migrations, sem Docker, sem DevOps. Do zero ao funcional em menos de 5 minutos.', accent: '#facc15' },
            { icon: Globe, title: 'Multi-tenant', desc: 'Cada empresa tem seus dados completamente isolados. Regras de segurança Firestore por companyId garantem privacidade total.', accent: '#38bdf8' },
            { icon: Lock, title: 'Segurança real', desc: 'Firebase Auth com email/senha, RBAC com 5 níveis de permissão no client, e audit log gravando cada ação do sistema.', accent: '#a78bfa' },
            { icon: Shield, title: '100% Open Source', desc: 'MIT License. Fork, customize, contribua. Seu código, suas regras. Sem vendor lock-in, sem surpresas.', accent: '#34d399' },
          ].map((w, i) => (
            <Reveal key={w.title}>
              <div className="lp-why-card" style={{ '--why-accent': w.accent, '--why-delay': `${i * 80}ms` }}>
                <div className="lp-why-glow" />
                <div className="lp-why-num">{String(i + 1).padStart(2, '0')}</div>
                <div className="lp-why-icon"><w.icon size={24} strokeWidth={1.8} /></div>
                <h3>{w.title}</h3>
                <p>{w.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section className="lp-section lp-pricing" id="pricing">
        <Reveal>
          <div className="lp-section-head">
            <span className="lp-section-tag">Planos</span>
            <h2>Escolha seu plano</h2>
            <p className="lp-section-sub">Comece grátis. Evolua quando precisar.</p>
          </div>
        </Reveal>
        <div className="lp-pricing-grid">
          {/* FREE */}
          <Reveal>
            <div className="lp-pricing-card">
              <div className="lp-pricing-top">
                <div className="lp-pricing-icon free"><Sparkles size={20} /></div>
                <span className="lp-pricing-name">TestFREE</span>
                <span className="lp-pricing-badge free">Grátis</span>
              </div>
              <div className="lp-pricing-price">
                <span className="lp-pricing-val">R$ 0</span>
                <span className="lp-pricing-period">para sempre</span>
              </div>
              <ul className="lp-pricing-features">
                <li><Check size={14} /> Acesso completo ao conteúdo já disponível</li>
                <li><Check size={14} /> Todos os módulos do ERP</li>
                <li><Check size={14} /> Painel de administração de contas</li>
                <li><Check size={14} /> Suporte da comunidade</li>
              </ul>
              <Link to="/register" className="lp-btn lp-btn-ghost lp-pricing-cta">Começar grátis</Link>
            </div>
          </Reveal>

          {/* PRO */}
          <Reveal>
            <div className="lp-pricing-card popular">
              <div className="lp-pricing-popular-tag"><Star size={12} /> Mais popular</div>
              <div className="lp-pricing-top">
                <div className="lp-pricing-icon pro"><Crown size={20} /></div>
                <span className="lp-pricing-name">AnglerPro</span>
                <span className="lp-pricing-badge pro">Pro</span>
              </div>
              <div className="lp-pricing-price">
                <span className="lp-pricing-val">R$ 119<span className="lp-pricing-cents">,98</span></span>
                <span className="lp-pricing-period">/mês</span>
              </div>
              <ul className="lp-pricing-features">
                <li><Check size={14} /> Tudo do TestFREE</li>
                <li><Check size={14} /> Relatórios semanais</li>
                <li><Check size={14} /> IA por áudio</li>
                <li><Check size={14} /> Relatórios customizáveis</li>
                <li><Check size={14} /> Mais distribuidoras de IA</li>
                <li><Check size={14} /> Cálculos para usar menos token</li>
              </ul>
              <Link to="/register" className="lp-btn lp-btn-gold lp-pricing-cta">Assinar agora</Link>
            </div>
          </Reveal>

          {/* ULTRA */}
          <Reveal>
            <div className="lp-pricing-card">
              <div className="lp-pricing-top">
                <div className="lp-pricing-icon ultra"><Zap size={20} /></div>
                <span className="lp-pricing-name">AnglerUltra</span>
                <span className="lp-pricing-badge ultra">Ultra</span>
              </div>
              <div className="lp-pricing-price">
                <span className="lp-pricing-val">R$ 199<span className="lp-pricing-cents">,98</span></span>
                <span className="lp-pricing-period">/mês</span>
              </div>
              <ul className="lp-pricing-features">
                <li><Check size={14} /> Tudo do AnglerPro</li>
                <li><Check size={14} /> Configurações de UI</li>
                <li><Check size={14} /> IA controladora de sistema</li>
                <li><Check size={14} /> Importação e exportação de dados</li>
                <li><Check size={14} /> Relatórios visão geral em PDF</li>
              </ul>
              <Link to="/register" className="lp-btn lp-btn-ghost lp-pricing-cta">Assinar agora</Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="lp-section lp-faq" id="faq">
        <Reveal>
          <div className="lp-section-head">
            <span className="lp-section-tag">Dúvidas</span>
            <h2>Perguntas Frequentes</h2>
          </div>
        </Reveal>
        <div className="lp-faq-list">
          {[
            { q: 'Preciso pagar para usar?', a: 'Não. O Angler ERP é 100% gratuito e open source (MIT License). O único custo é o do Firebase, que tem um plano gratuito generoso — suficiente para a maioria das pequenas e médias empresas.' },
            { q: 'Preciso saber programar?', a: 'Não necessariamente. O setup básico envolve copiar configurações e rodar comandos simples. Mas se quiser customizar, o código é todo em React — fácil de modificar.' },
            { q: 'Funciona offline?', a: 'Parcialmente. O Firestore tem suporte offline nativo — dados ficam disponíveis mesmo sem internet e sincronizam quando a conexão volta. Para funcionalidades completas, a internet é necessária.' },
            { q: 'Quantos usuários podem acessar?', a: 'Sem limite. O Firebase escala automaticamente. Você pode ter quantos usuários quiser, cada um com seu papel (owner, admin, manager, operator, viewer).' },
            { q: 'Posso hospedar na minha própria infra?', a: 'Sim! O código é open source. Você pode fazer deploy no Firebase Hosting, Vercel, Netlify ou qualquer servidor estático. O backend é o Firestore, que roda na infra do Google.' },
            { q: 'Como funciona a segurança dos dados?', a: 'Cada empresa tem seus dados isolados via companyId. As regras do Firestore garantem que usuários só acessam dados da própria empresa. Além disso, há RBAC com 5 níveis de permissão e audit log.' },
          ].map((item, i) => (
            <FaqItem key={i} question={item.q} answer={item.a} />
          ))}
        </div>
      </section>

      {/* ═══ TECH CAROUSEL ═══ */}
      <section className="lp-carousel-section" id="tech">
        <div className="lp-carousel-head">
          <span className="lp-section-tag">Stack</span>
          <h2>Tecnologias</h2>
        </div>
        <div
          className="lp-carousel-wrap"
          onMouseEnter={handleCarouselEnter}
          onMouseLeave={handleCarouselLeave}
        >
          <button
            className={`lp-carousel-btn left ${!canScrollLeft ? 'hidden' : ''}`}
            onClick={() => scrollCarousel(-1)}
            aria-label="Anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <div
            className="lp-carousel lp-tech-list"
            ref={carouselRef}
            onScroll={updateCarouselBtns}
          >
            {[...TECH_STACK, ...TECH_STACK].map((t, i) => (
              <React.Fragment key={`${t.name}-${i}`}>
                <div
                  className="lp-carousel-card lp-tech-pill"
                  style={{ '--card-accent': t.color }}
                >
                  <div className="lp-tech-icon">
                    {t.image ? (
                      <img src={t.image} alt={t.name} />
                    ) : (
                      <span>{t.name.slice(0, 2)}</span>
                    )}
                  </div>
                  <span className="lp-tech-name">{t.name}</span>
                </div>
                {i < [...TECH_STACK, ...TECH_STACK].length - 1 && (
                  <span className="lp-carousel-separator">•</span>
                )}
              </React.Fragment>
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

      {/* ═══ CONTACT ═══ */}
      <section className="lp-section lp-contact" id="contact">
        <Reveal>
          <div className="lp-section-head">
            <span className="lp-section-tag">Contato</span>
            <h2>Fale com a gente</h2>
            <p className="lp-section-sub">Tem dúvida, sugestão ou encontrou um problema? Nos envie uma mensagem.</p>
          </div>
        </Reveal>
        <Reveal>
          <form className="lp-contact-form" onSubmit={(e) => e.preventDefault()}>
            <div className="lp-contact-field">
              <label htmlFor="contact-title">Título</label>
              <input id="contact-title" type="text" placeholder="Ex: Dúvida sobre integração" />
            </div>
            <div className="lp-contact-field">
              <label htmlFor="contact-email">Email</label>
              <input id="contact-email" type="email" placeholder="seu@email.com" />
            </div>
            <div className="lp-contact-field">
              <label htmlFor="contact-desc">Descrição do problema</label>
              <textarea id="contact-desc" rows={5} placeholder="Descreva com detalhes o que aconteceu..." />
            </div>
            <button type="submit" className="lp-btn lp-btn-gold lp-contact-submit">
              Enviar mensagem
            </button>
          </form>
        </Reveal>
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