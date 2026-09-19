import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import toast from 'react-hot-toast';

export default function Login() {
  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Bem-vindo!');
      navigate('/app');
    } catch (err) {
      const msg = err.code === 'auth/invalid-credential' ? 'Email ou senha incorretos.'
        : err.code === 'auth/user-not-found' ? 'Usuário não encontrado.'
        : err.code === 'auth/wrong-password' ? 'Senha incorreta.'
        : err.code === 'permission-denied' ? 'Permissão negada ao ler o perfil. Verifique as regras do Firestore.'
        : err.code === 'auth/too-many-requests' ? 'Muitas tentativas. Tente novamente mais tarde.'
        : err.message;
      toast.error(msg);
      setVerificationRequired(err.code === 'auth/email-not-verified');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    try {
      await resetPassword(resetEmail);
      toast.success('Email de recuperação enviado!');
      setShowReset(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (showReset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link to="/" className="inline-block">
              <img src="/logo.png" alt="Angler ERP" className="h-16 w-auto mx-auto object-contain" />
            </Link>
            <h1 className="text-2xl font-bold text-gold">Recuperar Senha</h1>
            <p className="text-dark-500 text-sm mt-1">Informe seu email para receber o link</p>
          </div>
          <div className="card"><div className="card-body">
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" placeholder="seu@email.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required autoFocus />
              </div>
              <button type="submit" className="btn-primary w-full">Enviar Link de Recuperação</button>
              <button type="button" className="btn-ghost w-full" onClick={() => setShowReset(false)}>Voltar ao Login</button>
            </form>
          </div></div>
          <p className="text-center text-sm text-dark-500 mt-6">
            <Link to="/" className="text-dark-400 hover:text-primary-300 flex items-center justify-center gap-1"><ArrowLeft size={14} /> Voltar ao início</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
              <img src="/logo.png" alt="Angler ERP" className="h-16 w-auto mx-auto object-contain" />
          </Link>
          <h1 className="text-2xl font-bold text-gold">Angler ERP</h1>
          <p className="text-dark-500 text-sm mt-1">Entre na sua conta</p>
        </div>

        <div className="card"><div className="card-body">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>

            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} className="input pr-10" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-primary-300" onClick={() => setShowPass(!showPass)}>
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <button type="button" onClick={() => setShowReset(true)} className="text-primary-400 hover:text-primary-300">Esqueceu a senha?</button>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <div className="animate-spin w-5 h-5 border-2 border-dark-950 border-t-transparent rounded-full" /> : <><LogIn size={18} /> Entrar</>}
            </button>
          </form>
        </div></div>

        <p className="text-center text-sm text-dark-500 mt-6">
          Não tem conta? <Link to="/register" className="text-primary-400 hover:text-primary-300 font-medium">Criar conta</Link>
        </p>
        <p className="text-center text-sm text-dark-500 mt-3">
          <Link to="/" className="text-dark-400 hover:text-primary-300 flex items-center justify-center gap-1"><ArrowLeft size={14} /> Voltar ao início</Link>
        </p>
      </div>
    </div>
  );
}
