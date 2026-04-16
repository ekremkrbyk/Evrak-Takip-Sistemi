import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import { UploadSimple, MagnifyingGlass } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Documents = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  const [uploadData, setUploadData] = useState({
    file: null,
    title: '',
    description: '',
    category: 'Genel'
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    let filtered = documents;
    
    if (searchQuery) {
      filtered = filtered.filter(doc => 
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(doc => doc.status === filterStatus);
    }
    
    setFilteredDocuments(filtered);
  }, [documents, searchQuery, filterStatus]);

  const fetchDocuments = async () => {
    try {
      const { data } = await axios.get(`${API}/documents`, { withCredentials: true });
      setDocuments(data);
      setFilteredDocuments(data);
    } catch (error) {
      toast.error('Belgeler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadData.file) {
      toast.error('Lütfen bir dosya seçin');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', uploadData.file);
    formData.append('title', uploadData.title || uploadData.file.name);
    formData.append('description', uploadData.description);
    formData.append('category', uploadData.category);

    try {
      await axios.post(`${API}/documents/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true
      });
      toast.success('Belge başarıyla yüklendi');
      setShowUpload(false);
      setUploadData({ file: null, title: '', description: '', category: 'Genel' });
      fetchDocuments();
    } catch (error) {
      toast.error('Belge yüklenirken hata oluştu');
    } finally {
      setUploading(false);
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
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 max-w-md relative">
            <MagnifyingGlass size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Belge ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="search-input"
              className="w-full border border-slate-200 pl-10 pr-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white"
            />
          </div>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            data-testid="filter-status"
            className="border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="draft">Taslak</option>
            <option value="pending">Beklemede</option>
            <option value="in_progress">İşlemde</option>
            <option value="approved">Onaylandı</option>
            <option value="rejected">Reddedildi</option>
          </select>
          
          <button
            onClick={() => setShowUpload(true)}
            data-testid="upload-button"
            className="bg-slate-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-slate-800 focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 transition-colors flex items-center gap-2"
          >
            <UploadSimple size={20} />
            <span>Belge Yükle</span>
          </button>
        </div>
        
        {/* Upload Modal */}
        {showUpload && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50" data-testid="upload-modal">
            <div className="bg-white border border-slate-200 p-8 w-full max-w-md">
              <h3 className="text-xl font-semibold text-slate-900 mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>Yeni Belge Yükle</h3>
              
              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dosya</label>
                  <input
                    type="file"
                    onChange={(e) => setUploadData({...uploadData, file: e.target.files[0]})}
                    required
                    data-testid="file-input"
                    className="w-full border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Başlık</label>
                  <input
                    type="text"
                    value={uploadData.title}
                    onChange={(e) => setUploadData({...uploadData, title: e.target.value})}
                    data-testid="title-input"
                    className="w-full border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white"
                    placeholder="Belge başlığı"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label>
                  <textarea
                    value={uploadData.description}
                    onChange={(e) => setUploadData({...uploadData, description: e.target.value})}
                    data-testid="description-input"
                    rows="3"
                    className="w-full border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white"
                    placeholder="Belge hakkında notlar"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Kategori</label>
                  <input
                    type="text"
                    value={uploadData.category}
                    onChange={(e) => setUploadData({...uploadData, category: e.target.value})}
                    data-testid="category-input"
                    className="w-full border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white"
                    placeholder="örn: Fatura, İzin, vb."
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={uploading}
                    data-testid="submit-upload-button"
                    className="flex-1 bg-slate-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    {uploading ? 'Yükleniyor...' : 'Yükle'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUpload(false)}
                    data-testid="cancel-upload-button"
                    className="flex-1 bg-white text-slate-900 border border-slate-200 px-6 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    İptal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* Documents Table */}
        <div className="bg-white border border-slate-200 p-6">
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-slate-500">Belge bulunamadı</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-200" data-testid="documents-table">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Başlık</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Kategori</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Durum</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Oluşturan</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Güncel Sorumlu</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((doc) => (
                    <tr
                      key={doc.id}
                      onClick={() => navigate(`/documents/${doc.id}`)}
                      className="border-b border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
                      data-testid={`document-row-${doc.id}`}
                    >
                      <td className="py-4 px-4 text-sm text-slate-900">{doc.title}</td>
                      <td className="py-4 px-4 text-sm text-slate-600">{doc.category}</td>
                      <td className="py-4 px-4">{getStatusBadge(doc.status)}</td>
                      <td className="py-4 px-4 text-sm text-slate-600">{doc.created_by_name}</td>
                      <td className="py-4 px-4 text-sm text-slate-600">{doc.current_holder_name || '-'}</td>
                      <td className="py-4 px-4 text-sm text-slate-600">
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

export default Documents;
