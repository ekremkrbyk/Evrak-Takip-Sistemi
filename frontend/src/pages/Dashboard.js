import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { FileText, Clock, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, pending: 0, inProgress: 0, approved: 0 });
  const [recentDocuments, setRecentDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data } = await axios.get(`${API}/documents`, { withCredentials: true });
      
      setStats({
        total: data.length,
        pending: data.filter(d => d.status === 'pending').length,
        inProgress: data.filter(d => d.status === 'in_progress').length,
        approved: data.filter(d => d.status === 'approved').length
      });
      
      setRecentDocuments(data.slice(0, 5));
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      draft: { text: 'Taslak', className: 'bg-slate-100 text-slate-700 border-slate-300' },
      pending: { text: 'Beklemede', className: 'bg-yellow-50 text-yellow-700 border-yellow-300' },
      in_progress: { text: 'İşlemde', className: 'bg-blue-50 text-blue-700 border-blue-300' },
      approved: { text: 'Onaylandı', className: 'bg-green-50 text-green-700 border-green-300' },
      rejected: { text: 'Reddedildi', className: 'bg-red-50 text-red-700 border-red-300' }
    };
    const statusInfo = statusMap[status] || statusMap.draft;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium border ${statusInfo.className}`}>
        {statusInfo.text}
      </span>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-600 text-sm">Yükleniyor...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Hoş geldiniz, {user?.full_name}
          </h1>
          <p className="text-sm text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
            Belge takip sisteminize genel bakış
          </p>
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-testid="stats-grid">
          <div className="bg-slate-50 border border-slate-200 p-6" data-testid="stat-card-total">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Toplam Belge</span>
              <FileText size={24} className="text-slate-400" />
            </div>
            <div className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>{stats.total}</div>
          </div>
          
          <div className="bg-slate-50 border border-slate-200 p-6" data-testid="stat-card-pending">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Beklemede</span>
              <Clock size={24} className="text-yellow-600" />
            </div>
            <div className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>{stats.pending}</div>
          </div>
          
          <div className="bg-slate-50 border border-slate-200 p-6" data-testid="stat-card-inprogress">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>İşlemde</span>
              <WarningCircle size={24} className="text-blue-600" />
            </div>
            <div className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>{stats.inProgress}</div>
          </div>
          
          <div className="bg-slate-50 border border-slate-200 p-6" data-testid="stat-card-approved">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Onaylandı</span>
              <CheckCircle size={24} className="text-green-600" />
            </div>
            <div className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>{stats.approved}</div>
          </div>
        </div>
        
        {/* Recent Documents */}
        <div className="bg-white border border-slate-200 p-6" data-testid="recent-documents-section">
          <h2 className="text-xl font-medium text-slate-900 mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>Son Belgeler</h2>
          
          {recentDocuments.length === 0 ? (
            <div className="text-center py-12">
              <img 
                src="https://images.unsplash.com/photo-1554325103-6985922f9a41?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwzfHxtaW5pbWFsJTIwZG9jdW1lbnQlMjBmb2xkZXIlMjB3aGl0ZSUyMGRlc2t8ZW58MHx8fHwxNzc1ODI2MjcyfDA&ixlib=rb-4.1.0&q=85"
                alt="Belge yok"
                className="w-48 h-32 object-cover mx-auto mb-4 opacity-50"
              />
              <p className="text-sm text-slate-500">Henüz belge bulunmuyor</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-200" data-testid="recent-documents-table">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Başlık</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Durum</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Oluşturan</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {recentDocuments.map((doc) => (
                    <tr
                      key={doc.id}
                      onClick={() => navigate(`/documents/${doc.id}`)}
                      className="border-b border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
                      data-testid={`document-row-${doc.id}`}
                    >
                      <td className="py-4 px-4 text-sm text-slate-900" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>{doc.title}</td>
                      <td className="py-4 px-4">{getStatusBadge(doc.status)}</td>
                      <td className="py-4 px-4 text-sm text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>{doc.created_by_name}</td>
                      <td className="py-4 px-4 text-sm text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                        {new Date(doc.created_at).toLocaleDateString('tr-TR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
