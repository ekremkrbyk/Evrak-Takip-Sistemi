import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { DownloadSimple, PaperPlaneTilt, CheckCircle, XCircle, Clock, ArrowUDownLeft, ArrowCounterClockwise, Prohibit, QuestionMark, Eye, Paperclip, Plus, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_MAP = {
  draft: { text: 'Taslak', className: 'bg-slate-100 text-slate-700 border-slate-300' },
  pending: { text: 'Beklemede', className: 'bg-yellow-50 text-yellow-700 border-yellow-300' },
  in_progress: { text: 'İşlemde', className: 'bg-blue-50 text-blue-700 border-blue-300' },
  approved: { text: 'Onaylandı', className: 'bg-green-50 text-green-700 border-green-300' },
  rejected: { text: 'Reddedildi', className: 'bg-red-50 text-red-700 border-red-300' },
  iade: { text: 'İade', className: 'bg-purple-50 text-purple-700 border-purple-300' },
  revize: { text: 'Revize', className: 'bg-purple-50 text-purple-700 border-purple-300' },
  cancelled: { text: 'İptal', className: 'bg-slate-100 text-slate-500 border-slate-300' },
};

const ACTION_LABELS = {
  accept: 'Kabul Et', approve: 'Onayla (Damga)', reject: 'Reddet',
  iade: 'İade Et (Eksik)', revize: 'Revize İste', geri_al: 'Geri Al',
  not_related: 'Bu Birimle Alakalı Değil',
};

const DocumentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [doc, setDoc] = useState(null);
  const [history, setHistory] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRoute, setShowRoute] = useState(false);
  const [routeData, setRouteData] = useState({ to_department: '', note: '' });
  const [showAction, setShowAction] = useState(false);
  const [actionData, setActionData] = useState({ action: '', note: '' });
  const [showPreview, setShowPreview] = useState(false);
  const [previewTarget, setPreviewTarget] = useState(null); // null = main doc, or attachment obj
  const [showAddAttachment, setShowAddAttachment] = useState(false);
  const [attData, setAttData] = useState({ file: null, note: '' });
  const [attUploading, setAttUploading] = useState(false);

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [id]);

  const fetchData = async () => {
    try {
      const [docRes, historyRes, deptRes] = await Promise.all([
        axios.get(`${API}/documents/${id}`, { withCredentials: true }),
        axios.get(`${API}/documents/${id}/history`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/departments`, { withCredentials: true }).catch(() => ({ data: [] })),
      ]);
      setDoc(docRes.data);
      setHistory(historyRes.data);
      setDepartments(deptRes.data);
    } catch (error) {
      toast.error('Belge yüklenirken hata oluştu');
      navigate('/documents');
    } finally { setLoading(false); }
  };

  const handleDownload = async () => {
    try {
      const response = await axios.get(`${API}/documents/${id}/download`, { withCredentials: true, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = window.document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.file_name);
      window.document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) { toast.error('İndirilemedi'); }
  };

  const handleRoute = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/documents/route`, { document_id: id, ...routeData }, { withCredentials: true });
      toast.success('Belge yönlendirildi');
      setShowRoute(false);
      setRouteData({ to_department: '', note: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Yönlendirilemedi');
    }
  };

  const handleAction = async (e) => {
    e.preventDefault();
    const noteRequired = ['iade', 'revize', 'reject'].includes(actionData.action);
    if (noteRequired && !actionData.note.trim()) {
      toast.error('Bu işlem için açıklama zorunludur');
      return;
    }
    try {
      const { data } = await axios.post(`${API}/documents/action`, { document_id: id, ...actionData }, { withCredentials: true });
      toast.success(`İşlem başarılı${data.stamp ? ` — Onay No: ${data.stamp.onay_no}` : ''}`);
      setShowAction(false);
      setActionData({ action: '', note: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'İşlem başarısız');
    }
  };

  const handleAddAttachment = async (e) => {
    e.preventDefault();
    if (!attData.file) { toast.error('Lütfen bir dosya seçin'); return; }
    setAttUploading(true);
    const form = new FormData();
    form.append('file', attData.file);
    form.append('note', attData.note);
    try {
      await axios.post(`${API}/documents/${id}/attachments`, form, { headers: { 'Content-Type': 'multipart/form-data' }, withCredentials: true });
      toast.success('Ek belge eklendi');
      setShowAddAttachment(false);
      setAttData({ file: null, note: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ek eklenemedi');
    } finally { setAttUploading(false); }
  };

  const handleDeleteAttachment = async (attId) => {
    if (!window.confirm('Bu eki silmek istediğinizden emin misiniz?')) return;
    try {
      await axios.delete(`${API}/documents/${id}/attachments/${attId}`, { withCredentials: true });
      toast.success('Ek silindi');
      fetchData();
    } catch (error) { toast.error(error.response?.data?.detail || 'Silinemedi'); }
  };

  const handleAttachmentDownload = async (att) => {
    try {
      const response = await axios.get(`${API}/documents/${id}/attachments/${att.id}/download`, { withCredentials: true, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = window.document.createElement('a');
      link.href = url;
      link.setAttribute('download', att.file_name);
      window.document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) { toast.error('İndirilemedi'); }
  };

  const openPreview = (target) => {
    setPreviewTarget(target);
    setShowPreview(true);
  };

  const getStatusBadge = (status) => {
    const s = STATUS_MAP[status] || STATUS_MAP.draft;
    return <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium border ${s.className}`}>{s.text}</span>;
  };

  // Permissions
  const isCreator = doc && doc.created_by === user?.id;
  const inMyDept = doc && doc.current_department === user?.department;
  const isAdmin = user?.role === 'admin';
  const isManager = user?.is_manager || isAdmin;

  const canActOnDoc = doc && (isAdmin || inMyDept);
  const canApprove = canActOnDoc && isManager && ['pending', 'in_progress'].includes(doc?.status);
  const canReject = canActOnDoc && isManager && ['pending', 'in_progress'].includes(doc?.status);
  const canRoute = canActOnDoc && !['approved', 'rejected', 'cancelled'].includes(doc?.status);
  const canIade = canActOnDoc && ['pending', 'in_progress'].includes(doc?.status);
  const canRevize = canActOnDoc && isManager && ['pending', 'in_progress'].includes(doc?.status);
  const canGeriAl = isCreator && !['approved', 'rejected', 'cancelled'].includes(doc?.status);
  const canNotRelated = canActOnDoc && doc && doc.current_department !== user?.department ? false : canActOnDoc && ['pending', 'in_progress'].includes(doc?.status);

  const previewUrl = previewTarget
    ? `${API}/documents/${id}/attachments/${previewTarget.id}/preview`
    : `${API}/documents/${id}/preview`;
  const previewFileType = previewTarget?.file_type || doc?.file_type;
  const previewFileName = previewTarget?.file_name || doc?.file_name;
  const isPdf = (previewFileType || '').includes('pdf');
  const isImage = (previewFileType || '').startsWith('image/');
  const isPreviewable = isPdf || isImage;
  const mainIsPreviewable = (doc?.file_type || '').includes('pdf') || (doc?.file_type || '').startsWith('image/');

  if (loading) return <Layout><div className="flex items-center justify-center h-64 text-slate-600 text-sm">Yükleniyor...</div></Layout>;
  if (!doc) return null;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Document Info */}
        <div className="bg-white border border-slate-200 p-6">
          <div className="flex items-start justify-between mb-6 gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-mono text-slate-500" data-testid="belge-no-display">{doc.belge_no || '-'}</span>
                {getStatusBadge(doc.status)}
                {doc.payment_required && <span className="text-xs font-medium bg-red-50 text-red-700 border border-red-300 px-2 py-0.5">💰 Ödeme Gerekli</span>}
              </div>
              <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>{doc.title}</h1>
              {doc.cari && <p className="text-sm text-slate-600 mt-1">Cari: <span className="font-medium">{doc.cari}</span></p>}
            </div>
            <div className="flex gap-2">
              {mainIsPreviewable && (
                <button onClick={() => openPreview(null)} data-testid="preview-button" className="bg-white text-slate-900 border border-slate-200 px-5 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2">
                  <Eye size={20} /><span>Önizle</span>
                </button>
              )}
              <button onClick={handleDownload} data-testid="download-button" className="bg-slate-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2">
                <DownloadSimple size={20} /><span>İndir</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Kategori</p><p className="text-sm text-slate-900">{doc.category}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Fatura No</p><p className="text-sm text-slate-900">{doc.fatura_no || '-'}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Oluşturan</p><p className="text-sm text-slate-900">{doc.created_by_name}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Güncel Birim</p><p className="text-sm text-slate-900">{doc.current_department || '-'}</p></div>
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Oluşturma</p><p className="text-sm text-slate-900">{new Date(doc.created_at).toLocaleString('tr-TR')}</p></div>
            {doc.hedef_tarih && <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Hedef Tarih</p><p className="text-sm text-slate-900">{new Date(doc.hedef_tarih).toLocaleDateString('tr-TR')}</p></div>}
            <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Dosya</p><p className="text-sm text-slate-900 truncate" title={doc.file_name}>{doc.file_name}</p></div>
          </div>

          {doc.description && (
            <div className="mb-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Açıklama</p><p className="text-sm text-slate-700">{doc.description}</p></div>
          )}

          {/* Stamp */}
          {doc.stamp && (
            <div className="mt-4 p-4 border-2 border-green-600 bg-green-50 inline-block" data-testid="document-stamp">
              <p className="text-xs font-semibold uppercase tracking-wider text-green-700">ONAYLANDI — DAMGA</p>
              <p className="text-sm text-green-900 mt-1 font-medium">{doc.stamp.approved_by}</p>
              <p className="text-xs text-green-800">{doc.stamp.department} · Onay No: <span className="font-mono">{doc.stamp.onay_no}</span></p>
              <p className="text-xs text-green-700 mt-1">{new Date(doc.stamp.approved_at).toLocaleString('tr-TR')}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-slate-200">
            {canRoute && (
              <button onClick={() => setShowRoute(true)} data-testid="route-button" className="bg-slate-900 text-white px-5 py-2 text-sm font-medium hover:bg-slate-800 flex items-center gap-2">
                <PaperPlaneTilt size={18} /><span>Yönlendir</span>
              </button>
            )}
            {canApprove && (
              <button onClick={() => { setActionData({ action: 'approve', note: '' }); setShowAction(true); }} data-testid="approve-button" className="bg-green-600 text-white px-5 py-2 text-sm font-medium hover:bg-green-700 flex items-center gap-2">
                <CheckCircle size={18} /><span>Onayla (Damga)</span>
              </button>
            )}
            {canReject && (
              <button onClick={() => { setActionData({ action: 'reject', note: '' }); setShowAction(true); }} data-testid="reject-button" className="bg-red-600 text-white px-5 py-2 text-sm font-medium hover:bg-red-700 flex items-center gap-2">
                <XCircle size={18} /><span>Reddet</span>
              </button>
            )}
            {canIade && (
              <button onClick={() => { setActionData({ action: 'iade', note: '' }); setShowAction(true); }} data-testid="iade-button" className="bg-purple-600 text-white px-5 py-2 text-sm font-medium hover:bg-purple-700 flex items-center gap-2">
                <ArrowUDownLeft size={18} /><span>İade (Eksik)</span>
              </button>
            )}
            {canRevize && (
              <button onClick={() => { setActionData({ action: 'revize', note: '' }); setShowAction(true); }} data-testid="revize-button" className="bg-amber-600 text-white px-5 py-2 text-sm font-medium hover:bg-amber-700 flex items-center gap-2">
                <ArrowCounterClockwise size={18} /><span>Revize İste</span>
              </button>
            )}
            {canNotRelated && (
              <button onClick={() => { setActionData({ action: 'not_related', note: '' }); setShowAction(true); }} data-testid="not-related-button" className="bg-white text-slate-900 border border-slate-300 px-5 py-2 text-sm font-medium hover:bg-slate-50 flex items-center gap-2">
                <QuestionMark size={18} /><span>Bu Birimle Alakalı Değil</span>
              </button>
            )}
            {canGeriAl && (
              <button onClick={() => { setActionData({ action: 'geri_al', note: '' }); setShowAction(true); }} data-testid="geri-al-button" className="bg-white text-red-600 border border-red-300 px-5 py-2 text-sm font-medium hover:bg-red-50 flex items-center gap-2">
                <Prohibit size={18} /><span>Geri Al / İptal</span>
              </button>
            )}
          </div>
        </div>

        {/* Attachments (klasör mantığı) */}
        <div className="bg-white border border-slate-200 p-6" data-testid="attachments-section">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Paperclip size={20} className="text-slate-700" />
              <h2 className="text-xl font-medium text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
                Ek Belgeler <span className="text-sm text-slate-500 font-normal">({(doc.attachments || []).length})</span>
              </h2>
            </div>
            {!['rejected', 'cancelled'].includes(doc.status) && (
              <button onClick={() => setShowAddAttachment(true)} data-testid="add-attachment-button" className="bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2">
                <Plus size={18} /><span>Ek Yükle</span>
              </button>
            )}
          </div>
          {(doc.attachments || []).length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">Henüz ek belge yok. Akış ilerledikçe bu belgeye destekleyici dosyalar ekleyebilirsiniz.</p>
          ) : (
            <div className="space-y-2">
              {doc.attachments.map((att) => {
                const attPreviewable = (att.file_type || '').includes('pdf') || (att.file_type || '').startsWith('image/');
                const canDelete = att.uploaded_by === user?.id || user?.role === 'admin';
                return (
                  <div key={att.id} className="flex items-center gap-3 p-3 border border-slate-200 hover:bg-slate-50 transition-colors" data-testid={`attachment-${att.id}`}>
                    <Paperclip size={18} className="text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{att.file_name}</p>
                      <p className="text-xs text-slate-500">
                        {att.uploaded_by_name} · {new Date(att.uploaded_at).toLocaleString('tr-TR')}
                        {att.note && <span className="ml-2 italic">— {att.note}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {attPreviewable && (
                        <button onClick={() => openPreview(att)} data-testid={`preview-attachment-${att.id}`} className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors" title="Önizle"><Eye size={18} /></button>
                      )}
                      <button onClick={() => handleAttachmentDownload(att)} data-testid={`download-attachment-${att.id}`} className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors" title="İndir"><DownloadSimple size={18} /></button>
                      {canDelete && (
                        <button onClick={() => handleDeleteAttachment(att.id)} data-testid={`delete-attachment-${att.id}`} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors" title="Sil"><Trash size={18} /></button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* History */}
        <div className="bg-white border border-slate-200 p-6">
          <h2 className="text-xl font-medium text-slate-900 mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>Belge Geçmişi</h2>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">Henüz işlem yapılmamış</p>
          ) : (
            <div className="space-y-4" data-testid="document-history">
              {history.map((item, index) => (
                <div key={item.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-slate-900"></div>
                    {index < history.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 mt-2"></div>}
                  </div>
                  <div className="flex-1 pb-6">
                    <p className="text-sm font-medium text-slate-900">
                      {item.from_user_name || item.user_name}
                      {item.department && <span className="text-slate-500"> · {item.department}</span>}
                      {item.action === 'routed' && item.to_department && ` → ${item.to_department}`}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 capitalize">
                      {ACTION_LABELS[item.action] || item.action}
                    </p>
                    {item.stamp && <p className="text-xs text-green-700 mt-1 font-mono">Onay No: {item.stamp.onay_no}</p>}
                    {item.note && <p className="text-sm text-slate-600 mt-2 p-2 bg-slate-50 border-l-2 border-slate-300">{item.note}</p>}
                    <p className="text-xs text-slate-400 mt-2">{new Date(item.timestamp).toLocaleString('tr-TR')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview Modal */}
        {showPreview && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" data-testid="preview-modal" onClick={() => { setShowPreview(false); setPreviewTarget(null); }}>
            <div className="bg-white w-full max-w-5xl h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-slate-200">
                <h3 className="text-lg font-medium text-slate-900">{previewFileName}</h3>
                <button onClick={() => { setShowPreview(false); setPreviewTarget(null); }} data-testid="close-preview-button" className="text-slate-500 hover:text-slate-900"><XCircle size={24} /></button>
              </div>
              <div className="flex-1 overflow-auto bg-slate-100">
                {isPdf ? (
                  <iframe src={previewUrl} title="Preview" className="w-full h-full border-0" />
                ) : isImage ? (
                  <div className="flex items-center justify-center h-full p-4"><img src={previewUrl} alt={previewFileName} className="max-w-full max-h-full" /></div>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500">Bu dosya önizlenemez</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add Attachment Modal */}
        {showAddAttachment && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" data-testid="add-attachment-modal">
            <div className="bg-white border border-slate-200 p-8 w-full max-w-md">
              <h3 className="text-xl font-semibold text-slate-900 mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>Ek Belge Yükle</h3>
              <form onSubmit={handleAddAttachment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dosya *</label>
                  <input type="file" onChange={(e) => setAttData({...attData, file: e.target.files[0]})} required data-testid="attachment-file-input" className="w-full border border-slate-200 px-4 py-2 text-sm bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label>
                  <input type="text" value={attData.note} onChange={(e) => setAttData({...attData, note: e.target.value})} data-testid="attachment-note-input" className="w-full border border-slate-200 px-4 py-2 text-sm bg-white" placeholder="örn: Ek fatura, sözleşme kopyası..." />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="submit" disabled={attUploading} data-testid="submit-attachment-button" className="flex-1 bg-slate-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50">{attUploading ? 'Yükleniyor...' : 'Yükle'}</button>
                  <button type="button" onClick={() => { setShowAddAttachment(false); setAttData({ file: null, note: '' }); }} data-testid="cancel-attachment-button" className="flex-1 bg-white text-slate-900 border border-slate-200 px-6 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors">İptal</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Route Modal */}
        {showRoute && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" data-testid="route-modal">
            <div className="bg-white border border-slate-200 p-8 w-full max-w-md">
              <h3 className="text-xl font-semibold text-slate-900 mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>Belgeyi Yönlendir</h3>
              <form onSubmit={handleRoute} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hedef Birim *</label>
                  <select value={routeData.to_department} onChange={(e) => setRouteData({...routeData, to_department: e.target.value})} required data-testid="route-department-select" className="w-full border border-slate-200 px-4 py-2 text-sm bg-white">
                    <option value="">Birim seçin</option>
                    {departments.filter(d => d.name !== doc.current_department).map(d => <option key={d.id || d.name} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Not {!isManager && <span className="text-red-600">*</span>}</label>
                  <textarea value={routeData.note} onChange={(e) => setRouteData({...routeData, note: e.target.value})} required={!isManager} rows="3" data-testid="route-note-input" className="w-full border border-slate-200 px-4 py-2 text-sm bg-white" placeholder={isManager ? 'Yönlendirme notu (opsiyonel)' : 'Açıklama zorunlu'} />
                  {!isManager && <button type="button" onClick={() => setRouteData({...routeData, note: 'Bilgim dahilinde değildir'})} className="text-xs text-slate-600 hover:text-slate-900 mt-1 underline">Bilgim dahilinde değildir</button>}
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="submit" data-testid="submit-route-button" className="flex-1 bg-slate-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors">Yönlendir</button>
                  <button type="button" onClick={() => setShowRoute(false)} data-testid="cancel-route-button" className="flex-1 bg-white text-slate-900 border border-slate-200 px-6 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors">İptal</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Action Modal */}
        {showAction && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" data-testid="action-modal">
            <div className="bg-white border border-slate-200 p-8 w-full max-w-md">
              <h3 className="text-xl font-semibold text-slate-900 mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>{ACTION_LABELS[actionData.action]}</h3>
              <form onSubmit={handleAction} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Açıklama {['iade', 'revize', 'reject'].includes(actionData.action) && <span className="text-red-600">*</span>}
                  </label>
                  <textarea value={actionData.note} onChange={(e) => setActionData({...actionData, note: e.target.value})} rows="3" required={['iade', 'revize', 'reject'].includes(actionData.action)} data-testid="action-note-input" className="w-full border border-slate-200 px-4 py-2 text-sm bg-white" placeholder="Açıklama ekleyin" />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="submit" data-testid="submit-action-button" className={`flex-1 text-white px-6 py-2.5 text-sm font-medium transition-colors ${actionData.action === 'reject' ? 'bg-red-600 hover:bg-red-700' : actionData.action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-900 hover:bg-slate-800'}`}>Devam Et</button>
                  <button type="button" onClick={() => setShowAction(false)} data-testid="cancel-action-button" className="flex-1 bg-white text-slate-900 border border-slate-200 px-6 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors">İptal</button>
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
