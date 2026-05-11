import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Pagination, { usePagination } from '../components/Pagination';
import axios from 'axios';
import { UploadSimple, MagnifyingGlass, CurrencyDollar } from '@phosphor-icons/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

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

const emptyUpload = {
  file: null, title: '', description: '', category: 'Fatura',
  fatura_no: '', cari: '', hedef_birim: '', hedef_tarih: '',
  payment_required: false,
};

const isUrgent = (hedef_tarih) => {
  if (!hedef_tarih) return false;
  const now = new Date();
  const target = new Date(hedef_tarih);
  const diffDays = (target - now) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 7;
};

const Documents = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || 'all');

  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [vendorSuggestions, setVendorSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [uploadData, setUploadData] = useState(emptyUpload);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchDocuments();
    fetchMeta();
  }, []);

  const fetchDocuments = async () => {
    try {
      const { data } = await axios.get(`${API}/documents`, { withCredentials: true });
      setDocuments(data);
    } catch (error) {
      toast.error('Belgeler yüklenirken hata oluştu');
    } finally { setLoading(false); }
  };

  const fetchMeta = async () => {
    try {
      const [d, c, v] = await Promise.all([
        axios.get(`${API}/departments`, { withCredentials: true }),
        axios.get(`${API}/categories`, { withCredentials: true }),
        axios.get(`${API}/vendors`, { withCredentials: true }),
      ]);
      setDepartments(d.data);
      setCategories(c.data);
      setVendors(v.data);
    } catch (e) { /* ignore */ }
  };

  const onCariChange = (val) => {
    setUploadData({...uploadData, cari: val});
    if (!val) { setShowSuggestions(false); return; }
    const matches = vendors.filter(v => v.name.toLowerCase().includes(val.toLowerCase())).slice(0, 6);
    setVendorSuggestions(matches);
    setShowSuggestions(matches.length > 0);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadData.file) { toast.error('Lütfen bir dosya seçin'); return; }
    setUploading(true);
    const formData = new FormData();
    formData.append('file', uploadData.file);
    formData.append('title', uploadData.title || uploadData.file.name);
    formData.append('description', uploadData.description);
    formData.append('category', uploadData.category);
    formData.append('fatura_no', uploadData.fatura_no);
    formData.append('cari', uploadData.cari);
    formData.append('hedef_birim', uploadData.hedef_birim);
    formData.append('hedef_tarih', uploadData.hedef_tarih);
    formData.append('payment_required', uploadData.payment_required ? 'true' : 'false');
    try {
      await axios.post(`${API}/documents/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }, withCredentials: true,
      });
      toast.success('Belge başarıyla yüklendi');
      setShowUpload(false);
      setUploadData(emptyUpload);
      fetchDocuments();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Belge yüklenirken hata oluştu');
    } finally { setUploading(false); }
  };

  const filteredDocs = documents.filter(doc => {
    const q = searchQuery.toLowerCase();
    const matchQ = !q || [doc.title, doc.description, doc.belge_no, doc.fatura_no, doc.cari]
      .some(f => (f || '').toLowerCase().includes(q));
    const matchS = filterStatus === 'all' || doc.status === filterStatus;
    return matchQ && matchS;
  });

  const { page, pageSize, setPageSize, totalPages, pageData, goTo, total, start } = usePagination(filteredDocs, 20);

  const getStatusBadge = (status) => {
    const s = STATUS_MAP[status] || STATUS_MAP.draft;
    return <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium border ${s.className}`}>{s.text}</span>;
  };

  const formatDateTime = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('tr-TR') + ' ' + d.toLocaleTimeString('tr-TR');
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-64 text-slate-600 text-sm">Yükleniyor...</div></Layout>;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 max-w-md relative">
            <MagnifyingGlass size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text" placeholder="Başlık, fatura no, cari ara..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="search-input"
              className="w-full border border-slate-200 pl-10 pr-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white"
            />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} data-testid="filter-status" className="border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 outline-none bg-white">
            <option value="all">Tüm Durumlar</option>
            {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.text}</option>)}
          </select>
          <button onClick={() => setShowUpload(true)} data-testid="upload-button" className="bg-slate-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2">
            <UploadSimple size={20} /><span>Belge Yükle</span>
          </button>
        </div>

        {/* Upload Modal */}
        {showUpload && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" data-testid="upload-modal">
            <div className="bg-white border border-slate-200 p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-semibold text-slate-900 mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>Yeni Belge Yükle</h3>
              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dosya *</label>
                  <input type="file" onChange={(e) => setUploadData({...uploadData, file: e.target.files[0]})} required data-testid="file-input" className="w-full border border-slate-200 px-4 py-2 text-sm bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Başlık</label>
                  <input type="text" value={uploadData.title} onChange={(e) => setUploadData({...uploadData, title: e.target.value})} data-testid="title-input" className="w-full border border-slate-200 px-4 py-2 text-sm bg-white" placeholder="Belge başlığı" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Kategori *</label>
                    <select value={uploadData.category} onChange={(e) => setUploadData({...uploadData, category: e.target.value})} required data-testid="category-select" className="w-full border border-slate-200 px-4 py-2 text-sm bg-white">
                      {categories.map(c => <option key={c.id || c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Fatura No</label>
                    <input type="text" value={uploadData.fatura_no} onChange={(e) => setUploadData({...uploadData, fatura_no: e.target.value})} data-testid="fatura-input" className="w-full border border-slate-200 px-4 py-2 text-sm bg-white" />
                  </div>
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cari (Firma Adı)</label>
                  <input type="text" value={uploadData.cari} onChange={(e) => onCariChange(e.target.value)} onFocus={() => uploadData.cari && onCariChange(uploadData.cari)} onBlur={() => setTimeout(() => setShowSuggestions(false), 150)} data-testid="cari-input" className="w-full border border-slate-200 px-4 py-2 text-sm bg-white" placeholder="Cari adı yazın..." />
                  {showSuggestions && vendorSuggestions.length > 0 && (
                    <ul className="absolute z-10 left-0 right-0 bg-white border border-slate-200 shadow-lg mt-1 max-h-48 overflow-y-auto" data-testid="cari-suggestions">
                      {vendorSuggestions.map((v) => (
                        <li key={v.id} onClick={() => { setUploadData({...uploadData, cari: v.name}); setShowSuggestions(false); }} className="px-4 py-2 text-sm hover:bg-slate-100 cursor-pointer text-slate-900">
                          {v.name} <span className="text-xs text-slate-500">({v.payment_type})</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Hedef Birim *</label>
                    <select value={uploadData.hedef_birim} onChange={(e) => setUploadData({...uploadData, hedef_birim: e.target.value})} required data-testid="hedef-birim-select" className="w-full border border-slate-200 px-4 py-2 text-sm bg-white">
                      <option value="">Birim seçin</option>
                      {departments.map(d => <option key={d.id || d.name} value={d.name}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Hedef Tarih</label>
                    <input type="date" value={uploadData.hedef_tarih} onChange={(e) => setUploadData({...uploadData, hedef_tarih: e.target.value})} data-testid="hedef-tarih-input" className="w-full border border-slate-200 px-4 py-2 text-sm bg-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label>
                  <textarea value={uploadData.description} onChange={(e) => setUploadData({...uploadData, description: e.target.value})} rows="2" data-testid="description-input" className="w-full border border-slate-200 px-4 py-2 text-sm bg-white" placeholder="Belge hakkında notlar" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="payment_required" checked={uploadData.payment_required} onChange={(e) => setUploadData({...uploadData, payment_required: e.target.checked})} data-testid="payment-required-checkbox" className="w-4 h-4" />
                  <label htmlFor="payment_required" className="text-sm text-slate-700">Ödeme gerektiren belge</label>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="submit" disabled={uploading} data-testid="submit-upload-button" className="flex-1 bg-slate-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50">{uploading ? 'Yükleniyor...' : 'Yükle ve Gönder'}</button>
                  <button type="button" onClick={() => { setShowUpload(false); setUploadData(emptyUpload); }} data-testid="cancel-upload-button" className="flex-1 bg-white text-slate-900 border border-slate-200 px-6 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors">İptal</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Documents Table */}
        <div className="bg-white border border-slate-200 p-6">
          <p className="text-sm text-slate-500 mb-4">{filteredDocs.length} belgeden {Math.min((page-1)*pageSize+1, filteredDocs.length)}–{Math.min(page*pageSize, filteredDocs.length)} gösteriliyor</p>
          {filteredDocs.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-500">Belge bulunamadı</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-200" data-testid="documents-table">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Belge No</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Başlık</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Fatura No</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Kategori</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Durum</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Gönderen</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Birim</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Tarih / Saat</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((doc) => {
                    const urgent = isUrgent(doc.hedef_tarih);
                    return (
                      <tr
                        key={doc.id}
                        onClick={() => navigate(`/documents/${doc.id}`)}
                        className={`border-b border-slate-200 cursor-pointer transition-colors ${urgent ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'}`}
                        data-testid={`document-row-${doc.id}`}
                      >
                        <td className="py-4 px-4 text-sm text-slate-700 font-mono">{doc.belge_no || '-'}</td>
                        <td className="py-4 px-4 text-sm text-slate-900">
                          <div className="font-medium">{doc.title}</div>
                          {doc.cari && <div className="text-xs text-slate-500 mt-0.5">{doc.cari}</div>}
                        </td>
                        <td className="py-4 px-4 text-sm text-slate-600">{doc.fatura_no || '-'}</td>
                        <td className="py-4 px-4 text-sm text-slate-600">{doc.category}</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1">
                            {getStatusBadge(doc.status)}
                            {doc.payment_required && <CurrencyDollar size={18} className="text-red-600" title="Ödeme gerekli" />}
                          </div>
                        </td>
                        <td className="py-4 px-4 text-sm text-slate-600">{doc.created_by_name}</td>
                        <td className="py-4 px-4 text-sm text-slate-600">{doc.current_department || doc.hedef_birim || '-'}</td>
                        <td className="py-4 px-4 text-sm text-slate-600">
                          {formatDateTime(doc.created_at)}
                          {doc.hedef_tarih && (
                            <div className={`text-xs mt-0.5 ${urgent ? 'text-red-700 font-medium' : 'text-slate-500'}`}>
                              Hedef: {new Date(doc.hedef_tarih).toLocaleDateString('tr-TR')}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Documents;
