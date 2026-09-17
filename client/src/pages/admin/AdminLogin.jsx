import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { adminLogin } from '../../services/firebase/admin';
import toast from 'react-hot-toast';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const adminUser = await adminLogin(email, password);
      toast.success(`Bem-vindo, ${adminUser.name || adminUser.email}!`);
      navigate('/admin/contas');
    } catch (err) {
      const msg = err.message || 'Erro ao fazer login.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 mb-4">
            <Shield className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Painel Administrativo</h1>
          <p className="text-dark-400 mt-2">
            Acesso restrito a administradores
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-dark-900 border border-dark-700 rounded-xl p-6 space-y-5"
        >
          {error && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">
              E-mail do administrador
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="admin@empresa.com"
              className="w-full px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-600
                         text-white placeholder-dark-500
                         focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500
                         transition-colors"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1.5">
              Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-4 py-2.5 pr-10 rounded-lg bg-dark-800 border border-dark-600
                           text-white placeholder-dark-500
                           focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500
                           transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-200 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg
                       bg-red-600 hover:bg-red-700 disabled:bg-red-600/50
                       text-white font-medium transition-colors"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Entrar como Administrador
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-dark-500 text-xs mt-6">
          Apenas usuários com cargo <span className="text-dark-300">Owner</span> ou{' '}
          <span className="text-dark-300">Admin</span> podem acessar este painel.
        </p>
      </div>
    </div>
  );
}
