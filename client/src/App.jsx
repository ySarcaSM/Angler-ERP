import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/useAuth';
import { AdminAuthProvider } from './context/AdminAuthContext';
import Layout from './components/layout/Layout';
import Landing from './pages/Landing';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import CompanyLogin from './pages/auth/CompanyLogin';
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
import LogsPage from './pages/logs/LogsPage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import AngelAssistant from './pages/assistant/AngelAssistant';
import ProfileGroupPage from './pages/budgets/ProfileGroupPage';
import FormulasPage from './pages/budgets/FormulasPage';
import BudgetsPage from './pages/budgets/BudgetsPage';
import SettingsPage from './pages/settings/SettingsPage';
import UserManagement from './pages/settings/UserManagement';
import LocationList from './pages/locations/LocationList';
import ModulesPage from './pages/modules/ModulesPage';
import AccessibilityFloatingButton from './components/ui/AccessibilityFloatingButton';

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

function OwnerRoute({ children }) {
  const { userData } = useAuth();
  return userData?.role === 'owner' ? children : <Navigate to="/app" replace />;
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
    <>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/app" replace /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/app" replace /> : <Register />} />
      <Route path="/join/:invitationId" element={<CompanyLogin />} />
      <Route path="/empresa/:invitationId/login" element={<CompanyLogin />} />

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

      <Route path="/assistant" element={
        <PrivateRoute>
          <Layout><AngelAssistant /></Layout>
        </PrivateRoute>
      } />

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
              <Route path="/locations" element={<LocationList />} />
              <Route path="/financial" element={<FinancialDashboard />} />
              <Route path="/stock" element={<StockDashboard />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/logs" element={<LogsPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/budgets" element={<BudgetsPage />} />
              <Route path="/budgets/profiles" element={<ProfileGroupPage />} />
              <Route path="/budgets/profiles/:groupSlug" element={<Navigate to="/app/budgets/profiles" replace />} />
              <Route path="/budgets/formulas" element={<FormulasPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/modules" element={<ModulesPage />} />
              <Route path="/users" element={<OwnerRoute><UserManagement /></OwnerRoute>} />
              <Route path="/settings/users" element={<Navigate to="/app/users" replace />} />
              <Route path="*" element={<Navigate to="/app" replace />} />
            </Routes>
          </Layout>
        </PrivateRoute>
      } />
    </Routes>
    <AccessibilityFloatingButton />
    </>
  );
}
