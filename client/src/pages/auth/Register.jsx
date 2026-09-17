import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  UserPlus, ArrowLeft, ArrowRight, Check, Building2, User, LayoutGrid,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

// ═══════════════════════════════════════════
// Validações
// ═══════════════════════════════════════════

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateCNPJ(cnpj) {
  const nums = cnpj.replace(/\D/g, '');
  if (nums.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(nums)) return false;

  const calcDigit = (slice, weights) => {
    const sum = slice.split('').reduce((acc, ch, i) => acc + Number(ch) * weights[i], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };

  const d1 = calcDigit(nums.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (d1 !== Number(nums[12])) return false;

  const d2 = calcDigit(nums.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (d2 !== Number(nums[13])) return false;

  return true;
}

function formatCNPJ(value) {
  const nums = value.replace(/\D/g, '').slice(0, 14);
  if (nums.length <= 2) return nums;
  if (nums.length <= 5) return `${nums.slice(0, 2)}.${nums.slice(2)}`;
  if (nums.length <= 8) return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5)}`;
  if (nums.length <= 12) return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8)}`;
  return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8, 12)}-${nums.slice(12)}`;
}

function formatPhone(value) {
  const nums = value.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 2) return nums.length ? `(${nums}` : '';
  if (nums.length <= 7) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`;
}

// ═══════════════════════════════════════════
// Módulos disponíveis
// ═══════════════════════════════════════════

const AVAILABLE_MODULES = [
  { key: 'clients', label: 'Clientes', desc: 'CRM, busca, endereço, status' },
  { key: 'products', label: 'Produtos', desc: 'Cadastro, preços, categorias' },
  { key: 'sales', label: 'Vendas', desc: 'Pedidos, orçamentos, aprovação' },
  { key: 'purchases', label: 'Compras', desc: 'Pedidos, recebimento automático' },
  { key: 'suppliers', label: 'Fornecedores', desc: 'Cadastro completo' },
  { key: 'financial', label: 'Financeiro', desc: 'Contas a pagar/receber, fluxo de caixa' },
  { key: 'stock', label: 'Estoque', desc: 'Movimentações, alertas, ajustes' },
  { key: 'reports', label: 'Relatórios', desc: 'Vendas, lucro, margem' },
];

const STEPS = [
  { num: 1, label: 'Conta', icon: User },
  { num: 2, label: 'Empresa', icon: Building2 },
  { num: 3, label: 'Módulos', icon: LayoutGrid },
];

// ═══════════════════════════════════════════
// Sub-componentes (FORA para evitar re-criação)
// ═══════════════════════════════════════════

function InputField({ label, name, type = 'text', placeholder, value, onChange, error, required, ...rest }) {
  return (
    <div>
      <label className="label">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        type={type}
        className={`input ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        {...rest}
      />
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {STEPS.map((s, i) => (
        <React.Fragment key={s.num}>
          <div className="flex items-center gap-1.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              currentStep > s.num
                ? 'bg-primary-500 text-dark-950'
                : currentStep === s.num
                  ? 'bg-primary-400/20 border border-primary-400/40 text-primary-300'
                  : 'bg-dark-800 border border-dark-700 text-dark-500'
            }`}>
              {currentStep > s.num ? <Check size={14} /> : s.num}
            </div>
            <span className={`text-xs font-medium hidden sm:inline ${
              currentStep >= s.num ? 'text-primary-300' : 'text-dark-600'
            }`}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-8 h-0.5 rounded-full transition-all ${
              currentStep > s.num ? 'bg-primary-500' : 'bg-dark-700'
            }`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function ModuleToggle({ modKey, label, desc, active, onToggle }) {
  return (
    <div
      role="checkbox"
      aria-checked={active}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggle(); }}}
      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer select-none transition-all ${
        active
          ? 'border-primary-400/40 bg-primary-400/10 text-primary-200'
          : 'border-dark-700/50 bg-dark-800/50 text-dark-400 hover:border-dark-600'
      }`}
    >
      <div className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
        active
          ? 'bg-primary-500 border-primary-500 text-dark-950'
          : 'border-dark-600 bg-dark-800'
      }`}>
        {active && <Check size={14} />}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs opacity-60">{desc}</div>
      </div>
    </div>
  );
}

function Step1({ account, setAccount, errors }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <User size={20} className="text-primary-400" />
        <h2 className="text-lg font-semibold text-dark-100">Informações da Conta</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <InputField
          label="Nome" name="name" placeholder="João" required
          value={account.name}
          onChange={(e) => setAccount({ ...account, name: e.target.value })}
          error={errors.name}
        />
        <InputField
          label="Sobrenome" name="lastName" placeholder="Silva"
          value={account.lastName}
          onChange={(e) => setAccount({ ...account, lastName: e.target.value })}
        />
      </div>

      <InputField
        label="Email" name="email" type="email" placeholder="joao@email.com" required
        value={account.email}
        onChange={(e) => setAccount({ ...account, email: e.target.value })}
        error={errors.email}
      />

      <InputField
        label="Senha" name="password" type="password" placeholder="Mínimo 6 caracteres" required
        value={account.password}
        onChange={(e) => setAccount({ ...account, password: e.target.value })}
        error={errors.password}
        minLength={6}
      />

      <InputField
        label="Confirmar Senha" name="confirmPassword" type="password" placeholder="Repita a senha" required
        value={account.confirmPassword}
        onChange={(e) => setAccount({ ...account, confirmPassword: e.target.value })}
        error={errors.confirmPassword}
      />
    </div>
  );
}

function Step2({ company, setCompany, errors }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Building2 size={20} className="text-primary-400" />
        <h2 className="text-lg font-semibold text-dark-100">Informações da Empresa</h2>
      </div>

      <InputField
        label="Nome da Empresa" name="companyName" placeholder="Angler Tech" required
        value={company.companyName}
        onChange={(e) => setCompany({ ...company, companyName: e.target.value })}
        error={errors.companyName}
      />

      <InputField
        label="Razão Social" name="razaoSocial" placeholder="Angler Tecnologia Ltda"
        value={company.razaoSocial}
        onChange={(e) => setCompany({ ...company, razaoSocial: e.target.value })}
      />

      <InputField
        label="CNPJ" name="cnpj" placeholder="00.000.000/0000-00" required
        value={company.cnpj}
        onChange={(e) => setCompany({ ...company, cnpj: formatCNPJ(e.target.value) })}
        error={errors.cnpj}
        maxLength={18}
      />

      <InputField
        label="Setor" name="sector" placeholder="Tecnologia, Comércio, Serviços..."
        value={company.sector}
        onChange={(e) => setCompany({ ...company, sector: e.target.value })}
      />

      <InputField
        label="Endereço" name="address" placeholder="Rua Exemplo, 123 - Centro - São Paulo/SP" required
        value={company.address}
        onChange={(e) => setCompany({ ...company, address: e.target.value })}
        error={errors.address}
      />

      <div className="grid grid-cols-2 gap-3">
        <InputField
          label="Email Empresarial" name="companyEmail" type="email" placeholder="contato@empresa.com" required
          value={company.companyEmail}
          onChange={(e) => setCompany({ ...company, companyEmail: e.target.value })}
          error={errors.companyEmail}
        />
        <InputField
          label="Telefone" name="companyPhone" placeholder="(11) 99999-9999" required
          value={company.companyPhone}
          onChange={(e) => setCompany({ ...company, companyPhone: formatPhone(e.target.value) })}
          error={errors.companyPhone}
          maxLength={15}
        />
      </div>
    </div>
  );
}

function Step3({ modules, setModules, lockModules, setLockModules, errors }) {
  const toggleModule = useCallback((key) => {
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));
  }, [setModules]);

  const selectedCount = Object.values(modules).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <LayoutGrid size={20} className="text-primary-400" />
        <h2 className="text-lg font-semibold text-dark-100">Personalização</h2>
      </div>

      <p className="text-dark-400 text-sm">
        Selecione os módulos que sua empresa vai utilizar:
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {AVAILABLE_MODULES.map((mod) => (
          <ModuleToggle
            key={mod.key}
            modKey={mod.key}
            label={mod.label}
            desc={mod.desc}
            active={modules[mod.key]}
            onToggle={() => toggleModule(mod.key)}
          />
        ))}
      </div>

      {errors.modules && <p className="text-red-400 text-xs">{errors.modules}</p>}

      <div className="text-xs text-dark-500">
        {selectedCount} de {AVAILABLE_MODULES.length} módulos selecionados
      </div>

      {/* Lock option */}
      <div className="border-t border-dark-700/50 pt-4 mt-2">
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              checked={lockModules}
              onChange={(e) => setLockModules(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-5 h-5 rounded-md border border-dark-600 bg-dark-800 peer-checked:bg-primary-500 peer-checked:border-primary-500 transition-all flex items-center justify-center">
              {lockModules && <Check size={14} className="text-dark-950" />}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium text-dark-200 group-hover:text-dark-100 transition-colors">
              Carimbar configuração
            </div>
            <div className="text-xs text-dark-500 mt-0.5">
              Impede que módulos sejam adicionados ou removidos após o cadastro.
              Somente um administrador poderá alterar depois.
            </div>
          </div>
        </label>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // ─── Step 1: Conta ───
  const [account, setAccount] = useState({
    name: '', lastName: '', email: '', password: '', confirmPassword: '',
  });

  // ─── Step 2: Empresa ───
  const [company, setCompany] = useState({
    companyName: '', razaoSocial: '', cnpj: '', sector: '',
    address: '', companyEmail: '', companyPhone: '',
  });

  // ─── Step 3: Módulos ───
  const [modules, setModules] = useState({
    clients: true, products: true, sales: true, purchases: true,
    suppliers: true, financial: true, stock: true, reports: true,
  });
  const [lockModules, setLockModules] = useState(false);

  // ═══════════════════════════════════════════
  // Validação por passo
  // ═══════════════════════════════════════════

  function validateStep1() {
    const errs = {};
    if (!account.name.trim()) errs.name = 'Nome é obrigatório';
    if (!account.email.trim()) errs.email = 'Email é obrigatório';
    else if (!validateEmail(account.email)) errs.email = 'Email inválido';
    if (!account.password) errs.password = 'Senha é obrigatória';
    else if (account.password.length < 6) errs.password = 'Mínimo de 6 caracteres';
    if (account.password !== account.confirmPassword) errs.confirmPassword = 'As senhas não coincidem';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep2() {
    const errs = {};
    if (!company.companyName.trim()) errs.companyName = 'Nome da empresa é obrigatório';
    if (!company.cnpj.trim()) errs.cnpj = 'CNPJ é obrigatório';
    else if (!validateCNPJ(company.cnpj)) errs.cnpj = 'CNPJ inválido';
    if (!company.address.trim()) errs.address = 'Endereço é obrigatório';
    if (!company.companyEmail.trim()) errs.companyEmail = 'Email empresarial é obrigatório';
    else if (!validateEmail(company.companyEmail)) errs.companyEmail = 'Email inválido';
    if (!company.companyPhone.trim()) errs.companyPhone = 'Telefone é obrigatório';
    else if (company.companyPhone.replace(/\D/g, '').length < 10) errs.companyPhone = 'Telefone inválido';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateStep3() {
    const selected = Object.values(modules).some(Boolean);
    if (!selected) {
      setErrors({ modules: 'Selecione pelo menos um módulo' });
      return false;
    }
    setErrors({});
    return true;
  }

  // ═══════════════════════════════════════════
  // Navegação
  // ═══════════════════════════════════════════

  function nextStep() {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  }

  function prevStep() {
    setErrors({});
    if (step > 1) setStep(step - 1);
  }

  // ═══════════════════════════════════════════
  // Submit
  // ═══════════════════════════════════════════

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validateStep3()) return;

    setLoading(true);
    try {
      const enabledModules = Object.entries(modules)
        .filter(([, v]) => v)
        .map(([k]) => k);

      await register({
        email: account.email.trim(),
        password: account.password,
        name: account.name.trim(),
        lastName: account.lastName.trim(),
        companyName: company.companyName.trim(),
        razaoSocial: company.razaoSocial.trim(),
        cnpj: company.cnpj.replace(/\D/g, ''),
        sector: company.sector.trim(),
        address: company.address.trim(),
        companyEmail: company.companyEmail.trim(),
        companyPhone: company.companyPhone.replace(/\D/g, ''),
        enabledModules,
        modulesLocked: lockModules,
      });

      toast.success('Conta criada! Verifique seu email antes de entrar.');
      navigate('/login');
    } catch (err) {
      const msg = err.code === 'auth/email-already-in-use' ? 'Este email já está cadastrado.'
        : err.code === 'auth/weak-password' ? 'A senha precisa ter pelo menos 6 caracteres.'
        : err.message;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  // ═══════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950 px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <img src="../logo.png" alt="logo" />
          </Link>
          <h1 className="text-2xl font-bold text-gold mt-4">Criar Conta</h1>
          <p className="text-dark-500 text-sm mt-1">Comece a gerenciar seu negócio</p>
        </div>

        {/* Card */}
        <div className="card">
          <div className="card-body">
            <StepIndicator currentStep={step} />

            <form onSubmit={handleSubmit}>
              {step === 1 && <Step1 account={account} setAccount={setAccount} errors={errors} />}
              {step === 2 && <Step2 company={company} setCompany={setCompany} errors={errors} />}
              {step === 3 && (
                <Step3
                  modules={modules}
                  setModules={setModules}
                  lockModules={lockModules}
                  setLockModules={setLockModules}
                  errors={errors}
                />
              )}

              {/* Botões de navegação */}
              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-dark-700/50">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <ArrowLeft size={16} /> Voltar
                  </button>
                )}

                {step < 3 ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    Próximo <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                    disabled={loading}
                  >
                    {loading ? (
                      <div className="animate-spin w-5 h-5 border-2 border-dark-950 border-t-transparent rounded-full" />
                    ) : (
                      <><UserPlus size={18} /> Criar Conta</>
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-dark-500 mt-6">
          Já tem conta? <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium">Entrar</Link>
        </p>
        <p className="text-center text-sm text-dark-500 mt-3">
          <Link to="/" className="text-dark-400 hover:text-primary-300 flex items-center justify-center gap-1">
            <ArrowLeft size={14} /> Voltar ao início
          </Link>
        </p>
      </div>
    </div>
  );
}
