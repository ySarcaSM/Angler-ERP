import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AdminAuthProvider } from './context/AdminAuthContext';
import Layout from './components/layout/Layout';
import Landing from './pages/Landing';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Dashboard from './pages/dashboard/Dashboard';
import ClientList from './pages/clients/ClientList';
import ProductList from './pages/products/ProductList';
import SaleList from './pages/sales/SaleList';
import SaleForm from './pages/sales/SaleForm';
import PurchaseList from './pages/purchasing/PurchaseList';
import SupplierList from './pages/purchasing/SupplierList';
import FinancialDashboard from './pages/financial/FinancialDashboard';
import StockDashboard from './pages/stock/StockDashboard';
import ReportsPage from './pages/reports/ReportsPage';
import SettingsPage from './pages/settings/SettingsPage';
import UserManagement from './pages/settings/UserManagement';

// ─── Admin ───
import AdminLogin from './pages/admin/AdminLogin';
import AdminPanel from './pages/admin/AdminPanel';

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/app" replace /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/app" replace /> : <Register />} />

      {/* Admin — com contexto próprio, isolado da autenticação normal */}
      <Route
        path="/admin/*"
        element={
          <AdminAuthProvider>
            <Routes>
              <Route path="login" element={<AdminLogin />} />
              <Route path="contas" element={<AdminPanel />} />
              <Route path="*" element={<Navigate to="/admin/login" replace />} />
            </Routes>
          </AdminAuthProvider>
        }
      />

      <Route path="/app/*" element={
        <PrivateRoute>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/clients" element={<ClientList />} />
              <Route path="/products" element={<ProductList />} />
              <Route path="/sales" element={<SaleList />} />
              <Route path="/sales/new" element={<SaleForm />} />
              <Route path="/sales/:id" element={<SaleForm />} />
              <Route path="/purchases" element={<PurchaseList />} />
              <Route path="/suppliers" element={<SupplierList />} />
              <Route path="/financial" element={<FinancialDashboard />} />
              <Route path="/stock" element={<StockDashboard />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/users" element={<UserManagement />} />
              <Route path="*" element={<Navigate to="/app" replace />} />
            </Routes>
          </Layout>
        </PrivateRoute>
      } />
    </Routes>
  );
}
