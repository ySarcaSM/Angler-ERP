import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    companyName: '', name: '', lastName: '', email: '', password: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
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
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <img src="../logo.png" alt="logo"/>
          </Link>
          <h1 className="text-2xl font-bold text-gold">Criar Conta</h1>
          <p className="text-dark-500 text-sm mt-1">Comece a gerenciar seu negócio</p>
        </div>
        <div className="card"><div className="card-body">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nome da Empresa *</label>
              <input type="text" className="input" placeholder="Sua Empresa Ltda" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Nome *</label><input type="text" className="input" placeholder="João" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div><label className="label">Sobrenome</label><input type="text" className="input" placeholder="Silva" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
            </div>
            <div>
              <label className="label">Email *</label>
              <input type="email" className="input" placeholder="joao@empresa.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <label className="label">Senha *</label>
              <input type="password" className="input" placeholder="Mínimo 6 caracteres" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <div className="animate-spin w-5 h-5 border-2 border-dark-950 border-t-transparent rounded-full" /> : <><UserPlus size={18} /> Criar Conta</>}
            </button>
          </form>
        </div></div>
        <p className="text-center text-sm text-dark-500 mt-6">
          Já tem conta? <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium">Entrar</Link>
        </p>
        <p className="text-center text-sm text-dark-500 mt-3">
          <Link to="/" className="text-dark-400 hover:text-primary-300 flex items-center justify-center gap-1"><ArrowLeft size={14} /> Voltar ao início</Link>
        </p>
      </div>
    </div>
  );
}
