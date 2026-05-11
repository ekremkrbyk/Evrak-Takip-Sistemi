import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-slate-600 text-sm font-medium">Yükleniyor...</div>
      </div>
    );
  }

  if (!user || user === false) {
    return <Navigate to="/login" />;
  }

  // adminOnly: hem 'admin' hem 'superadmin' geçebilir
  if (adminOnly && user.role !== 'admin' && user.role !== 'superadmin') {
    return <Navigate to="/" />;
  }

  return children;
};

export default ProtectedRoute;
