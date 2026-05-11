import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Pagination, { usePagination } from '../components/Pagination';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { FileText, Clock, CheckCircle, XCircle, ArrowCounterClockwise } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_LABELS = {
  draft: 'Taslak', pending: 'Beklemede', in_progress: 'İşlemde',
  approved: 'Onaylandı', rejected: 'Reddedildi',
  iade: 'İade', revize: 'Revize', cancelled: 'İptal',
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, iade_revize: 0 });
  const [recentDocuments, setRecentDocuments] = useState([]);
  const { page, pageSize, setPageSize, totalPages, pageData: docPage, goTo, total, start } = usePagination(recentDocuments, 20);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [s, d] = await Promise.all([
        axios.get(`${API}/dashboard/stats`, { withCredentials: true }),
        axios.get(`${API}/documents`, { withCredentials: true }),
      ]);
      setStats(s.data);
      setRecentDocuments(d.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally { setLoading(false); }
  };

  const goFilter = (status) => navigate(`/documents?status=${status}`);

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-slate-100 text-slate-700 border-slate-300',
      pending: 'bg-yellow-50 text-yellow-700 border-yellow-300',
      in_progress: 'bg-blue-50 text-blue-700 border-blue-300',
      approved: 'bg-green-50 text-green-700 border-green-300',
      rejected: 'bg-red-50 text-red-700 border-red-300',
      iade: 'bg-purple-50 text-purple-700 border-purple-300',
      revize: 'bg-purple-50 text-purple-700 border-purple-300',
      cancelled: 'bg-slate-100 text-slate-500 border-slate-300',
    };
    return <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium border ${styles[status] || styles.draft}`}>{STATUS_LABELS[status] || status}</span>;
  };

  const cards = [
    { key: 'total', label: 'TOPLAM', value: stats.total, icon: FileText, color: 'text-slate-500', bg: 'bg-slate-50', filter: 'all' },
    { key: 'pending', label: 'BEKLEMEDE', value: stats.pending, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50', filter: 'pending' },
    { key: 'approved', label: 'ONAYLANDI', value: stats.approved, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', filter: 'approved' },
    { key: 'rejected', label: 'REDDEDILDI', value: stats.rejected, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', filter: 'rejected' },
    { key: 'iade_revize', label: 'IADE/REVIZE', value: stats.iade_revize, icon: ArrowCounterClockwise, color: 'text-purple-600', bg: 'bg-purple-50', filter: 'iade' },
  ];

  if (loading) return <Layout><div className="flex items-center justify-center h-64 text-slate-600 text-sm">Yükleniyor...</div></Layout>;

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>Hoş geldiniz, {user?.full_name}</h1>
          <p className="text-sm text-slate-600">Belge takip sisteminize genel bakış</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6" data-testid="stats-grid">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.key}
                onClick={() => goFilter(c.filter)}
                data-testid={`stat-card-${c.key}`}
                className={`${c.bg} border border-slate-200 p-6 text-left hover:shadow-md transition-all`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">{c.label}</span>
                  <Icon size={24} className={c.color} />
                </div>
                <div className="text-3xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>{c.value}</div>
              </button>
            );
          })}
        </div>

        <div className="bg-white border border-slate-200 p-6" data-testid="recent-documents-section">
          <h2 className="text-xl font-medium text-slate-900 mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>Son Belgeler</h2>
          {recentDocuments.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-500">Henüz belge bulunmuyor</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-200" data-testid="recent-documents-table">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Belge No</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Başlık</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Cari</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Kategori</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Durum</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Birim</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Tarih / Saat</th>
                  </tr>
                </thead>
                <tbody>
                  {docPage.map((doc) => (
                    <tr key={doc.id} onClick={() => navigate(`/documents/${doc.id}`)} className="border-b border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors" data-testid={`document-row-${doc.id}`}>
                      <td className="py-4 px-4 text-sm text-slate-700 font-mono">{doc.belge_no || '-'}</td>
                      <td className="py-4 px-4 text-sm text-slate-900 font-medium">{doc.title}</td>
                      <td className="py-4 px-4 text-sm text-slate-600">{doc.cari || '-'}</td>
                      <td className="py-4 px-4 text-sm text-slate-600">{doc.category}</td>
                      <td className="py-4 px-4">{getStatusBadge(doc.status)}</td>
                      <td className="py-4 px-4 text-sm text-slate-600">{doc.current_department || doc.hedef_birim || '-'}</td>
                      <td className="py-4 px-4 text-sm text-slate-600">
                        {new Date(doc.created_at).toLocaleDateString('tr-TR')} {new Date(doc.created_at).toLocaleTimeString('tr-TR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            <Pagination page={page} pageSize={pageSize} setPageSize={setPageSize} totalPages={totalPages} goTo={goTo} total={total} start={start} />
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
