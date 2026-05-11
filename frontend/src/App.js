import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import DocumentDetail from './pages/DocumentDetail';
import Users from './pages/Users';
import Departments from './pages/Departments';
import Vendors from './pages/Vendors';
import PermissionGroups from './pages/PermissionGroups';
import Logs from './pages/Logs';
import Finance from './pages/Finance';
import Backup from './pages/Backup';
import IhracatRapor from './pages/IhracatRapor';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"       element={<Login />} />
          <Route path="/"            element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/documents"   element={<ProtectedRoute><Documents /></ProtectedRoute>} />
          <Route path="/documents/:id" element={<ProtectedRoute><DocumentDetail /></ProtectedRoute>} />
          <Route path="/finance"     element={<ProtectedRoute><Finance /></ProtectedRoute>} />
          <Route path="/ihracat-rapor" element={<ProtectedRoute><IhracatRapor /></ProtectedRoute>} />
          {/* Admin sayfaları — adminOnly artık superadmin'i de kapsıyor */}
          <Route path="/users"       element={<ProtectedRoute adminOnly><Users /></ProtectedRoute>} />
          <Route path="/departments" element={<ProtectedRoute adminOnly><Departments /></ProtectedRoute>} />
          <Route path="/vendors"     element={<ProtectedRoute adminOnly><Vendors /></ProtectedRoute>} />
          <Route path="/permission-groups" element={<ProtectedRoute adminOnly><PermissionGroups /></ProtectedRoute>} />
          <Route path="/logs"        element={<ProtectedRoute adminOnly><Logs /></ProtectedRoute>} />
          <Route path="/backup"      element={<ProtectedRoute adminOnly><Backup /></ProtectedRoute>} />
          <Route path="*"            element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
