import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Pagination, { usePagination } from '../components/Pagination';
import axios from 'axios';
import { Plus, Pencil, Trash, Upload, Square, CheckSquare } from '@phosphor-icons/react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PAYMENT_TYPES = [
  { value: 'cek',        label: 'Çek' },
  { value: 'senet',      label: 'Senet' },
  { value: 'kredi_karti',label: 'Kredi Kartı' },
  { value: 'havale',     label: 'Havale / EFT' },
  { value: 'nakit',      label: 'Nakit' },
];

const emptyForm = {
  name: '', tax_no: '', payment_type: 'havale', vade_gun: 0,
  phone: '', email: '', address: '', notes: '',
};

const Vendors = () => {
  const [vendors,      setVendors]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showModal,    setShowModal]    = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [formData,     setFormData]     = useState(emptyForm);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [selected,     setSelected]     = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => { fetchVendors(); }, []);

  const fetchVendors = async () => {
    try {
      const { data } = await axios.get(`${API}/vendors`, { withCredentials: true });
      setVendors(data);
    } catch {
      toast.error('Cariler yüklenirken hata oluştu');
    } finally { setLoading(false); }
  };

  const filtered = vendors.filter(v =>
    !searchQuery || v.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const { page, pageSize, setPageSize, totalPages, pageData, goTo, total, start } = usePagination(filtered, 20);

  // ── Seçim ──────────────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size > 0 && selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(v => v.id)));
    }
  };

  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  // ── CRUD ───────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await axios.put(`${API}/vendors/${editing.id}`, formData, { withCredentials: true });
        toast.success('Cari güncellendi');
      } else {
        await axios.post(`${API}/vendors`, formData, { withCredentials: true });
        toast.success('Cari oluşturuldu');
      }
      setShowModal(false); setEditing(null); setFormData(emptyForm);
      fetchVendors();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Bir hata oluştu');
    }
  };

  const handleEdit = (v) => {
    setEditing(v);
    setFormData({ ...emptyForm, ...v });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu cariyi silmek istediğinizden emin misiniz?')) return;
    try {
      await axios.delete(`${API}/vendors/${id}`, { withCredentials: true });
      toast.success('Cari silindi');
      setSelected(prev => { const s = new Set(prev); s.delete(id); return s; });
      fetchVendors();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Silinemedi');
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`${selected.size} cari kalıcı olarak silinecek. Emin misiniz?`)) return;
    setBulkDeleting(true);
    try {
      const { data } = await axios.post(
        `${API}/vendors/bulk-delete`,
        { ids: Array.from(selected) },
        { withCredentials: true }
      );
      toast.success(`${data.deleted} cari silindi`);
      setSelected(new Set());
      fetchVendors();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Toplu silme başarısız');
    } finally { setBulkDeleting(false); }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const { data } = await axios.post(`${API}/vendors/bulk-import`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }, withCredentials: true,
      });
      if (data.created > 0) {
        toast.success(`${data.created} cari eklendi${data.skipped > 0 ? `, ${data.skipped} mükerrer atlandı` : ''}`);
      } else if (data.skipped > 0) {
        toast.warning(`Tüm kayıtlar zaten mevcut (${data.skipped} atlandı)`);
      } else {
        toast.error(data.errors?.[0] || 'Hiç kayıt eklenemedi — sütun başlıklarını kontrol edin');
      }
      fetchVendors();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'İçe aktarılamadı');
    } finally { e.target.value = ''; }
  };

  const paymentLabel = (val) => PAYMENT_TYPES.find(p => p.value === val)?.label || val;

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64 text-slate-600 text-sm">Yükleniyor...</div>
    </Layout>
  );

  return (
    <Layout>
      <div className="space-y-6">

        {/* Başlık + butonlar */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Cari Hesaplar
            </h1>
            <p className="text-sm text-slate-600 mt-1">Toplam {vendors.length} cari</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="bg-white text-slate-900 border border-slate-200 px-5 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 cursor-pointer" data-testid="import-vendors-button">
              <Upload size={18} />
              <span>Excel / CSV İçe Aktar</span>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleImport} className="hidden" />
            </label>
            <button
              onClick={() => { setEditing(null); setFormData(emptyForm); setShowModal(true); }}
              data-testid="add-vendor-button"
              className="bg-slate-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2"
            >
              <Plus size={18} />
              <span>Cari Ekle</span>
            </button>
          </div>
        </div>

        {/* Arama + toplu silme */}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Cari ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="vendor-search-input"
            className="flex-1 max-w-md border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 outline-none bg-white"
          />
          {selected.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              <Trash size={16} />
              {bulkDeleting ? 'Siliniyor...' : `${selected.size} Seçiliyi Sil`}
            </button>
          )}
        </div>

        {/* Tablo */}
        <div className="bg-white border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="vendors-table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-3 px-4 w-10">
                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-700 flex items-center justify-center">
                      {allSelected
                        ? <CheckSquare size={18} weight="fill" className="text-slate-900" />
                        : selected.size > 0
                          ? <CheckSquare size={18} className="text-slate-400" />
                          : <Square size={18} />}
                    </button>
                  </th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Firma Adı</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Vergi No</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Ödeme Tipi</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Vade (gün)</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Telefon</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-10 text-center text-sm text-slate-500">
                      {searchQuery ? 'Arama sonucu bulunamadı' : 'Henüz cari eklenmemiş'}
                    </td>
                  </tr>
                ) : filtered.map((v) => (
                  <tr
                    key={v.id}
                    className={`border-b border-slate-100 transition-colors ${selected.has(v.id) ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                    data-testid={`vendor-row-${v.id}`}
                  >
                    <td className="py-3 px-4 w-10">
                      <button onClick={() => toggleSelect(v.id)} className="text-slate-400 hover:text-slate-700 flex items-center justify-center">
                        {selected.has(v.id)
                          ? <CheckSquare size={18} weight="fill" className="text-slate-900" />
                          : <Square size={18} />}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-900 font-medium">{v.name}</td>
                    <td className="py-3 px-4 text-sm text-slate-600">{v.tax_no || '—'}</td>
                    <td className="py-3 px-4 text-sm text-slate-600">{paymentLabel(v.payment_type)}</td>
                    <td className="py-3 px-4 text-sm text-slate-600">{v.vade_gun || 0}</td>
                    <td className="py-3 px-4 text-sm text-slate-600">{v.phone || '—'}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(v)}
                          data-testid={`edit-vendor-${v.id}`}
                          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          title="Düzenle"
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          onClick={() => handleDelete(v.id)}
                          data-testid={`delete-vendor-${v.id}`}
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Sil"
                        >
                          <Trash size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} setPageSize={setPageSize} totalPages={totalPages} goTo={goTo} total={total} start={start} />
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" data-testid="vendor-modal">
            <div className="bg-white border border-slate-200 p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-semibold text-slate-900 mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {editing ? 'Cari Düzenle' : 'Yeni Cari Ekle'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Firma Adı *</label>
                  <input type="text" value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required data-testid="input-vendor-name"
                    className="w-full border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 outline-none bg-white"
                    placeholder="Civan Civata Ltd." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Vergi No</label>
                    <input type="text" value={formData.tax_no}
                      onChange={(e) => setFormData({ ...formData, tax_no: e.target.value })}
                      data-testid="input-vendor-tax"
                      className="w-full border border-slate-200 px-4 py-2 text-sm bg-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Vade (gün)</label>
                    <input type="number" min="0" value={formData.vade_gun}
                      onChange={(e) => setFormData({ ...formData, vade_gun: parseInt(e.target.value) || 0 })}
                      data-testid="input-vendor-vade"
                      className="w-full border border-slate-200 px-4 py-2 text-sm bg-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ödeme Tipi</label>
                  <select value={formData.payment_type}
                    onChange={(e) => setFormData({ ...formData, payment_type: e.target.value })}
                    data-testid="select-vendor-payment"
                    className="w-full border border-slate-200 px-4 py-2 text-sm bg-white">
                    {PAYMENT_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                    <input type="text" value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      data-testid="input-vendor-phone"
                      className="w-full border border-slate-200 px-4 py-2 text-sm bg-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">E-posta</label>
                    <input type="email" value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      data-testid="input-vendor-email"
                      className="w-full border border-slate-200 px-4 py-2 text-sm bg-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Adres</label>
                  <textarea value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows="2" data-testid="input-vendor-address"
                    className="w-full border border-slate-200 px-4 py-2 text-sm bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notlar</label>
                  <textarea value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows="2" data-testid="input-vendor-notes"
                    className="w-full border border-slate-200 px-4 py-2 text-sm bg-white" />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="submit" data-testid="submit-vendor-button"
                    className="flex-1 bg-slate-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors">
                    {editing ? 'Güncelle' : 'Oluştur'}
                  </button>
                  <button type="button"
                    onClick={() => { setShowModal(false); setEditing(null); setFormData(emptyForm); }}
                    data-testid="cancel-vendor-button"
                    className="flex-1 bg-white text-slate-900 border border-slate-200 px-6 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors">
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

export default Vendors;
