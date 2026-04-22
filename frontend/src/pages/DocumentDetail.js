import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { DownloadSimple, PaperPlaneTilt, CheckCircle, XCircle, Clock } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DocumentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [document, setDocument] = useState(null);
  const [history, setHistory] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routeData, setRouteData] = useState({ to_user_id: '', note: '' });
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionData, setActionData] = useState({ action: '', note: '' });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [docRes, historyRes, usersRes] = await Promise.all([
        axios.get(`${API}/documents/${id}`, { withCredentials: true }),
        axios.get(`${API}/documents/${id}/history`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/users`, { withCredentials: true }).catch(() => ({ data: [] }))
      ]);
      setDocument(docRes.data);
      setHistory(historyRes.data);
      setUsers(usersRes.data.filter(u => u.id !== user?.id));
    } catch (error) {
      toast.error('Belge yüklenirken hata oluştu');
      navigate('/documents');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await axios.get(`${API}/documents/${id}/download`, {
        withCredentials: true,
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', document.file_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Belge indirildi');
    } catch (error) {
      toast.error('Belge indirilirken hata oluştu');
    }
  };

  const handleRoute = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/documents/route`, {
        document_id: id,
        ...routeData
      }, { withCredentials: true });
      toast.success('Belge başarıyla yönlendirildi');
      setShowRouteModal(false);
      setRouteData({ to_user_id: '', note: '' });
      fetchData();
    } catch (error) {
      toast.error('Belge yönlendirilirken hata oluştu');
    }
  };

  const handleAction = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/documents/action`, {
        document_id: id,
        ...actionData
      }, { withCredentials: true });
      toast.success('Belge durumu güncellendi');
      setShowActionModal(false);
      setActionData({ action: '', note: '' });
      fetchData();
    } catch (error) {
      toast.error('Belge durumu güncellenirken hata oluştu');
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

  const canRoute = document && (document.current_holder === user?.id || user?.role === 'admin');
  const canAction = document && (document.current_holder === user?.id || user?.role === 'admin');

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
      <div className="space-y-6">
        {/* Document Info */}
        <div className="bg-white border border-slate-200 p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {document.title}
              </h1>
              <div className="flex items-center gap-3">
                {getStatusBadge(document.status)}
                <span className="text-sm text-slate-600">{document.category}</span>
              </div>
            </div>
            <button
              onClick={handleDownload}
              data-testid="download-button"
              className="bg-slate-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2"
            >
              <DownloadSimple size={20} />
              <span>İndir</span>
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Oluşturan</p>
              <p className="text-sm text-slate-900">{document.created_by_name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Güncel Sorumlu</p>
              <p className="text-sm text-slate-900">{document.current_holder_name || '-'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Dosya Adı</p>
              <p className="text-sm text-slate-900">{document.file_name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Oluşturma Tarihi</p>
              <p className="text-sm text-slate-900">{new Date(document.created_at).toLocaleString('tr-TR')}</p>
            </div>
          </div>
          
          {document.description && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Açıklama</p>
              <p className="text-sm text-slate-600">{document.description}</p>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex gap-3 mt-6 pt-6 border-t border-slate-200">
            {canRoute && (
              <button
                onClick={() => setShowRouteModal(true)}
                data-testid="route-button"
                className="bg-slate-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2"
              >
                <PaperPlaneTilt size={20} />
                <span>Yönlendir</span>
              </button>
            )}
            
            {canAction && document.status === 'pending' && (
              <button
                onClick={() => { setActionData({ action: 'accept', note: '' }); setShowActionModal(true); }}
                data-testid="accept-button"
                className="bg-blue-600 text-white px-6 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Clock size={20} />
                <span>Kabul Et</span>
              </button>
            )}
            
            {canAction && document.status === 'in_progress' && (
              <>
                <button
                  onClick={() => { setActionData({ action: 'approve', note: '' }); setShowActionModal(true); }}
                  data-testid="approve-button"
                  className="bg-green-600 text-white px-6 py-2.5 text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <CheckCircle size={20} />
                  <span>Onayla</span>
                </button>
                <button
                  onClick={() => { setActionData({ action: 'reject', note: '' }); setShowActionModal(true); }}
                  data-testid="reject-button"
                  className="bg-red-600 text-white px-6 py-2.5 text-sm font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <XCircle size={20} />
                  <span>Reddet</span>
                </button>
              </>
            )}
          </div>
        </div>
        
        {/* History */}
        <div className="bg-white border border-slate-200 p-6">
          <h2 className="text-xl font-medium text-slate-900 mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>Belge Geçmişi</h2>
          
          {history.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">Henüz işlem yapılmamış</p>
          ) : (
            <div className="space-y-4" data-testid="document-history">
              {history.map((item, index) => (
                <div key={item.id} className="flex gap-4" data-testid={`history-item-${index}`}>
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-slate-900"></div>
                    {index < history.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 mt-2"></div>}
                  </div>
                  <div className="flex-1 pb-6">
                    <p className="text-sm font-medium text-slate-900">
                      {item.from_user_name || item.user_name} 
                      {item.action === 'routed' && ` → ${item.to_user_name}`}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {item.action === 'routed' && 'Belgeyi yönlendirdi'}
                      {item.action === 'accept' && 'Belgeyi kabul etti'}
                      {item.action === 'approve' && 'Belgeyi onayladı'}
                      {item.action === 'reject' && 'Belgeyi reddetti'}
                    </p>
                    {item.note && <p className="text-sm text-slate-600 mt-2">{item.note}</p>}
                    <p className="text-xs text-slate-400 mt-2">{new Date(item.timestamp).toLocaleString('tr-TR')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Route Modal */}
        {showRouteModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50" data-testid="route-modal">
            <div className="bg-white border border-slate-200 p-8 w-full max-w-md">
              <h3 className="text-xl font-semibold text-slate-900 mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>Belgeyi Yönlendir</h3>
              
              <form onSubmit={handleRoute} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kullanıcı Seç</label>
                  <select
                    value={routeData.to_user_id}
                    onChange={(e) => setRouteData({...routeData, to_user_id: e.target.value})}
                    required
                    data-testid="route-user-select"
                    className="w-full border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white"
                  >
                    <option value="">Kullanıcı seçin</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.full_name} - {u.department}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Not</label>
                  <textarea
                    value={routeData.note}
                    onChange={(e) => setRouteData({...routeData, note: e.target.value})}
                    data-testid="route-note-input"
                    rows="3"
                    className="w-full border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white"
                    placeholder="Yönlendirme notu"
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    data-testid="submit-route-button"
                    className="flex-1 bg-slate-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors"
                  >
                    Yönlendir
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRouteModal(false)}
                    data-testid="cancel-route-button"
                    className="flex-1 bg-white text-slate-900 border border-slate-200 px-6 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    İptal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* Action Modal */}
        {showActionModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50" data-testid="action-modal">
            <div className="bg-white border border-slate-200 p-8 w-full max-w-md">
              <h3 className="text-xl font-semibold text-slate-900 mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {actionData.action === 'accept' && 'Belgeyi Kabul Et'}
                {actionData.action === 'approve' && 'Belgeyi Onayla'}
                {actionData.action === 'reject' && 'Belgeyi Reddet'}
              </h3>
              
              <form onSubmit={handleAction} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Not</label>
                  <textarea
                    value={actionData.note}
                    onChange={(e) => setActionData({...actionData, note: e.target.value})}
                    data-testid="action-note-input"
                    rows="3"
                    className="w-full border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white"
                    placeholder="Açıklama ekleyin"
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    data-testid="submit-action-button"
                    className={`flex-1 text-white px-6 py-2.5 text-sm font-medium transition-colors ${
                      actionData.action === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-slate-800'
                    }`}
                  >
                    Onayla
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowActionModal(false)}
                    data-testid="cancel-action-button"
                    className="flex-1 bg-white text-slate-900 border border-slate-200 px-6 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    İptal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DocumentDetail;
