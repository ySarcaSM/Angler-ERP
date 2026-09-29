import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/useAuth';
import { AdminAuthProvider } from './context/AdminAuthContext';
import Layout from './components/layout/Layout';
import Landing from './pages/Landing';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import CompanyAccessRequest from './pages/auth/CompanyAccessRequest';
import AccountChooser from './pages/auth/AccountChooser';
import Dashboard from './pages/dashboard/Dashboard';
import ClientList from './pages/clients/ClientList';
import ClientForm from './pages/clients/ClientForm';
import ProductList from './pages/products/ProductList';
import ProductForm from './pages/products/ProductForm';
import SaleList from './pages/sales/SaleList';
import SaleForm from './pages/sales/SaleForm';
import PurchaseList from './pages/purchasing/PurchaseList';
import PurchaseForm from './pages/purchasing/PurchaseForm';
import SupplierList from './pages/purchasing/SupplierList';
import SupplierForm from './pages/purchasing/SupplierForm';
import FinancialDashboard from './pages/financial/FinancialDashboard';
import StockDashboard from './pages/stock/StockDashboard';
import ReportsPage from './pages/reports/ReportsPage';
import WeeklyReportsPage from './pages/anglerPro/WeeklyReportsPage';
import CustomReportsPage from './pages/anglerPro/CustomReportsPage';
import LogsPage from './pages/logs/LogsPage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import AngelAssistant from './pages/assistant/AngelAssistant';
import ProfileGroupPage from './pages/budgets/ProfileGroupPage';
import FormulasPage from './pages/budgets/FormulasPage';
import FormulaForm from './pages/budgets/FormulaForm';
import BudgetsPage from './pages/budgets/BudgetsPage';
import BudgetForm from './pages/budgets/BudgetForm';
import SettingsPage from './pages/settings/SettingsPage';
import UserManagement from './pages/settings/UserManagement';
import UserDetails from './pages/settings/UserDetails';
import DeletionRequests from './pages/settings/DeletionRequests';
import LocationList from './pages/locations/LocationList';
import LocationForm from './pages/locations/LocationForm';
import ModulesPage from './pages/modules/ModulesPage';
import AccessibilityFloatingButton from './components/ui/AccessibilityFloatingButton';
import AdminLogin from './pages/admin/AdminLogin';
import AdminPanel from './pages/admin/AdminPanel';

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-dark-950"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" /></div>;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}
function AuthenticatedEntry() {
  const { availableCompanies, userData } = useAuth();
  if (availableCompanies.length > 1 && sessionStorage.getItem('angler-account-selected') !== 'true') {
    return <Navigate to="/escolher-conta" replace />;
  }
  if (!userData?.companyId) return <Navigate to="/login" replace />;
  return <Navigate to="/app" replace />;
}
function MultiCompanyRoute({ children }) {
  const { availableCompanies } = useAuth();
  if (availableCompanies.length > 1 && sessionStorage.getItem('angler-account-selected') !== 'true') {
    return <Navigate to="/escolher-conta" replace />;
  }
  return children;
}
function ModuleRoute({ moduleKey, children }) {
  const { getEffectiveModules, userData } = useAuth();
  if (userData?.role === 'viewer' && moduleKey === 'measurement') return <Navigate to="/app" replace />;
  if (userData?.role === 'operator' && moduleKey === 'assistant') return children;
  return getEffectiveModules().includes(moduleKey) ? children : <Navigate to="/app" replace />;
}
function WriteRoute({ children }) { const { userData } = useAuth(); return userData?.role === 'viewer' ? <Navigate to="/app" replace /> : children; }
function OperatorHomeOrDashboard() { return <Dashboard />; }
function OperatorBlockedRoute({ children }) { const { userData } = useAuth(); return userData?.role === 'operator' ? <Navigate to="/app" replace /> : children; }
function AdminOrOwnerRoute({ children }) { const { userData } = useAuth(); return ['owner','admin'].includes(userData?.role) ? children : <Navigate to="/app" replace />; }
function AnglerProRoute({ children }) { const { company } = useAuth(); return company?.plan === 'anglerpro' ? children : <Navigate to="/app" replace />; }

export default function App() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-dark-950"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" /></div>;
  return <><Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/login" element={isAuthenticated ? <AuthenticatedEntry /> : <Login />} />
    <Route path="/register" element={isAuthenticated ? <Navigate to="/app" replace /> : <Register />} />
    <Route path="/empresa/:companyId" element={<CompanyAccessRequest />} />
    <Route path="/escolher-conta" element={<PrivateRoute><AccountChooser /></PrivateRoute>} />
    <Route path="/admin/*" element={<AdminAuthProvider><Routes><Route path="login" element={<AdminLogin />} /><Route path="contas" element={<AdminPanel />} /><Route path="*" element={<Navigate to="/admin/login" replace />} /></Routes></AdminAuthProvider>} />
    <Route path="/assistant" element={<PrivateRoute><ModuleRoute moduleKey="assistant"><Layout><AngelAssistant /></Layout></ModuleRoute></PrivateRoute>} />
    <Route path="/app/*" element={<PrivateRoute><MultiCompanyRoute><Layout><Routes>
      <Route path="/" element={<OperatorHomeOrDashboard />} />
      <Route path="/clients/new" element={<ModuleRoute moduleKey="clients"><WriteRoute><ClientForm /></WriteRoute></ModuleRoute>} />
      <Route path="/clients/:id/edit" element={<ModuleRoute moduleKey="clients"><WriteRoute><ClientForm /></WriteRoute></ModuleRoute>} />
      <Route path="/clients" element={<ModuleRoute moduleKey="clients"><ClientList /></ModuleRoute>} />
      <Route path="/products/new" element={<ModuleRoute moduleKey="products"><WriteRoute><ProductForm /></WriteRoute></ModuleRoute>} />
      <Route path="/products/:id/edit" element={<ModuleRoute moduleKey="products"><WriteRoute><ProductForm /></WriteRoute></ModuleRoute>} />
      <Route path="/products" element={<ModuleRoute moduleKey="products"><ProductList /></ModuleRoute>} />
      <Route path="/sales" element={<ModuleRoute moduleKey="sales"><SaleList /></ModuleRoute>} />
      <Route path="/sales/new" element={<ModuleRoute moduleKey="sales"><WriteRoute><SaleForm /></WriteRoute></ModuleRoute>} />
      <Route path="/sales/:id" element={<ModuleRoute moduleKey="sales"><SaleForm /></ModuleRoute>} />
      <Route path="/purchases/new" element={<ModuleRoute moduleKey="purchases"><WriteRoute><PurchaseForm /></WriteRoute></ModuleRoute>} />
      <Route path="/purchases/:id/edit" element={<ModuleRoute moduleKey="purchases"><WriteRoute><PurchaseForm /></WriteRoute></ModuleRoute>} />
      <Route path="/purchases" element={<ModuleRoute moduleKey="purchases"><PurchaseList /></ModuleRoute>} />
      <Route path="/suppliers/new" element={<ModuleRoute moduleKey="suppliers"><WriteRoute><SupplierForm /></WriteRoute></ModuleRoute>} />
      <Route path="/suppliers/:id/edit" element={<ModuleRoute moduleKey="suppliers"><WriteRoute><SupplierForm /></WriteRoute></ModuleRoute>} />
      <Route path="/suppliers" element={<ModuleRoute moduleKey="suppliers"><SupplierList /></ModuleRoute>} />
      <Route path="/locations/new" element={<ModuleRoute moduleKey="locations"><WriteRoute><LocationForm /></WriteRoute></ModuleRoute>} />
      <Route path="/locations/:id/edit" element={<ModuleRoute moduleKey="locations"><WriteRoute><LocationForm /></WriteRoute></ModuleRoute>} />
      <Route path="/locations" element={<ModuleRoute moduleKey="locations"><LocationList /></ModuleRoute>} />
      <Route path="/financial" element={<ModuleRoute moduleKey="financial"><FinancialDashboard /></ModuleRoute>} />
      <Route path="/stock" element={<ModuleRoute moduleKey="stock"><StockDashboard /></ModuleRoute>} />
      <Route path="/reports" element={<ModuleRoute moduleKey="reports"><ReportsPage /></ModuleRoute>} />
      <Route path="/angler-pro/relatorios-semanais" element={<AnglerProRoute><WeeklyReportsPage /></AnglerProRoute>} />
      <Route path="/angler-pro/relatorios-customizaveis" element={<AnglerProRoute><CustomReportsPage /></AnglerProRoute>} />
      <Route path="/budgets/new" element={<ModuleRoute moduleKey="budgets"><WriteRoute><BudgetForm /></WriteRoute></ModuleRoute>} />
      <Route path="/budgets/:id/edit" element={<ModuleRoute moduleKey="budgets"><WriteRoute><BudgetForm /></WriteRoute></ModuleRoute>} />
      <Route path="/budgets" element={<ModuleRoute moduleKey="budgets"><BudgetsPage /></ModuleRoute>} />
      <Route path="/budgets/profiles" element={<ModuleRoute moduleKey="measurement"><ProfileGroupPage /></ModuleRoute>} />
      <Route path="/budgets/profiles/:groupSlug" element={<Navigate to="/app/budgets/profiles" replace />} />
      <Route path="/budgets/formulas/new" element={<ModuleRoute moduleKey="formulas"><WriteRoute><FormulaForm /></WriteRoute></ModuleRoute>} />
      <Route path="/budgets/formulas/:id/edit" element={<ModuleRoute moduleKey="formulas"><WriteRoute><FormulaForm /></WriteRoute></ModuleRoute>} />
      <Route path="/budgets/formulas" element={<ModuleRoute moduleKey="formulas"><FormulasPage /></ModuleRoute>} />
      <Route path="/settings" element={<OperatorBlockedRoute><SettingsPage /></OperatorBlockedRoute>} />
      <Route path="/modules" element={<OperatorBlockedRoute><ModulesPage /></OperatorBlockedRoute>} />
      <Route path="/users/:userId" element={<AdminOrOwnerRoute><UserDetails /></AdminOrOwnerRoute>} />
      <Route path="/users" element={<AdminOrOwnerRoute><UserManagement /></AdminOrOwnerRoute>} />
      <Route path="/requests" element={<DeletionRequests />} />
      <Route path="/settings/users" element={<Navigate to="/app/users" replace />} />
      <Route path="/logs" element={<OperatorBlockedRoute><LogsPage /></OperatorBlockedRoute>} />
      <Route path="/notifications" element={<OperatorBlockedRoute><NotificationsPage /></OperatorBlockedRoute>} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes></Layout></MultiCompanyRoute></PrivateRoute>} />
    <Route path="*" element={<Navigate to={isAuthenticated ? '/app' : '/login'} replace />} />
  </Routes><AccessibilityFloatingButton /></>;
}
