import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ProviderList from './pages/ProviderList';
import ProviderForm from './pages/ProviderForm';
import AuditLogs from './pages/AuditLogs';
import UserList from './pages/UserList';
import UserForm from './pages/UserForm';
import RoleList from './pages/RoleList';
import { GroupList } from './pages/GroupList';
import ClientList from './pages/ClientList';
import ClientForm from './pages/ClientForm';
import ActiveSessions from './pages/ActiveSessions';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import MasterDataSettings from './pages/MasterDataSettings';
import ProtectedRoute from './components/ProtectedRoute';

/**
 * Main App Component with Route mappings
 */
const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/*" element={
        <ProtectedRoute>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/users" element={<UserList />} />
              <Route path="/users/new" element={<UserForm />} />
              <Route path="/users/edit/:id" element={<UserForm />} />
              <Route path="/providers" element={<ProviderList />} />
              <Route path="/providers/new" element={<ProviderForm />} />
              <Route path="/providers/edit/:id" element={<ProviderForm />} />
              <Route path="/clients" element={<ClientList />} />
              <Route path="/clients/new" element={<ClientForm />} />
              <Route path="/clients/edit/:id" element={<ClientForm />} />
              <Route path="/roles" element={<RoleList />} />
              <Route path="/groups" element={<GroupList />} />
              <Route path="/sessions" element={<ActiveSessions />} />
              <Route path="/audit" element={<AuditLogs />} />
              <Route path="/settings/master-data" element={<MasterDataSettings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </ProtectedRoute>
      } />
    </Routes>
  );
};

export default App;
