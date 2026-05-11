import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import { toast } from 'sonner';
import { DownloadSimple, Eye, Funnel, MagnifyingGlass } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext';
import Pagination, { usePagination } from '../components/Pagination';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PERIOD_OPTIONS = [
  { value: 'bugun', label: 'Bugün' },
  { value: 'hafta', label: 'Bu Hafta' },
  { value: 'ay',    label: 'Bu Ay' },
  { value: 'ozel',  label: 'Özel Tarih Aralığı' },
];
const STATUS_OPTIONS = [
  { value: '', label: 'Tüm Durumlar' },
  { value: 'approved',    label: 'Onaylandı' },
  { value: 'rejected',    label: 'Reddedildi' },
  { value: 'iade',        label: 'İade Edildi' },
  { value: 'revize',      label: 'Revize' },
  { value: 'in_progress', label: 'İşlemde' },
  { value: 'pending',     label: 'Beklemede' },
];
const STATUS_LABELS = { approved:'Onaylandı', rejected:'Reddedildi', iade:'İade', revize:'Revize', in_progress:'İşlemde', pending:'Beklemede', draft:'Taslak', cancelled:'İptal' };
const STATUS_COLORS = { approved:'bg-green-100 text-green-800', rejected:'bg-red-100 text-red-800', iade:'bg-orange-100 text-orange-800', revize:'bg-amber-100 text-amber-800', in_progress:'bg-blue-100 text-blue-800', pending:'bg-slate-100 text-slate-700', draft:'bg-slate-100 text-slate-400' };

const IhracatRapor = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const [period,      setPeriod]      = useState('ay');
  const [startDate,   setStartDate]   = useState('');
  const [endDate,     setEndDate]     = useState('');
  const [statusFilter,setStatusFilter]= useState('');
  const [deptFilter,  setDeptFilter]  = useState('');
  const [departments, setDepartments] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [preview,     setPreview]     = useState(null);
  const [search,      setSearch]      = useState('');

  useEffect(() => {
    if (isAdmin) {
      axios.get(`${API}/departments`, { withCredentials: true })
        .then(r => setDepartments(r.data)).catch(() => {});
    }
  }, [isAdmin]);

  const buildParams = () => {
    const p = { period, status: statusFilter };
    if (period === 'ozel') { p.start = startDate; p.end = endDate; }
    if (isAdmin && deptFilter) p.dept = deptFilter;
    return p;
  };

  const fetchPreview = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/rapor/preview`, { params: buildParams(), withCredentials: true });
      setPreview(data);
      setSearch('');
    } catch (err) { toast.error(err.response?.data?.detail || 'Rapor yüklenemedi'); }
    finally { setLoading(false); }
  };

  const downloadExcel = async () => {
    setLoading(true);
    try {
      const resp = await axios.get(`${API}/rapor/excel`, { params: buildParams(), withCredentials: true, responseType: 'blob' });
      const url = URL.createObjectURL(resp.data);
      const a = document.createElement('a');
      const dept = (isAdmin && deptFilter) ? deptFilter : (user?.department || 'rapor');
      a.href = url;
      a.download = `rapor_${dept}_${new Date().toLocaleDateString('tr-TR').replace(/\./g,'-')}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
      toast.success('Excel indirildi');
    } catch (err) { toast.error(err.response?.data?.detail || 'İndirilemedi'); }
    finally { setLoading(false); }
  };

  const filteredDocs = (preview?.documents || []).filter(doc => {
    if (!search) return true;
    const q = search.toLowerCase();
    return ['title','belge_no','cari','category','created_by_name','current_department']
      .some(k => (doc[k]||'').toLowerCase().includes(q));
  });

  const { page, pageSize, setPageSize, totalPages, pageData, goTo, total, start } = usePagination(filteredDocs, 20);

  const deptLabel = isAdmin ? (deptFilter || 'Tüm Belgeler') : (user?.department || '');

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Dönemsel Rapor</h1>
          <p className="text-sm text-slate-600 mt-1">
            {isAdmin ? 'Herhangi bir birim için dönemsel belge raporu.' : `${user?.department} biriminize ait belgeler.`}
          </p>
        </div>

        {/* Filtreler */}
        <div className="bg-white border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Funnel size={15} className="text-slate-500" />
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Parametreler</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {isAdmin && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Birim</label>
                <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
                  className="w-full border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-900 bg-white">
                  <option value="">Tümü</option>
                  {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Dönem</label>
              <select value={period} onChange={e => setPeriod(e.target.value)}
                className="w-full border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-900 bg-white">
                {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Durum</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="w-full border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-900 bg-white">
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {period === 'ozel' && (<>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Başlangıç</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-900 bg-white" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Bitiş</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="w-full border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-900 bg-white" />
              </div>
            </>)}
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={fetchPreview} disabled={loading}
              className="flex items-center gap-2 border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50">
              <Eye size={16}/>{loading ? 'Yükleniyor...' : 'Önizle'}
            </button>
            <button onClick={downloadExcel} disabled={loading}
              className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50">
              <DownloadSimple size={16}/>Excel İndir
            </button>
          </div>
        </div>

        {preview && (<>
          {/* Özet */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label:'Toplam', value: preview.summary?.total||0, color:'text-slate-900' },
              { label:'Onaylanan', value: preview.summary?.approved||0, color:'text-green-700' },
              { label:'Reddedilen', value: preview.summary?.rejected||0, color:'text-red-700' },
              { label:'İade/Revize', value:(preview.summary?.iade||0)+(preview.summary?.revize||0), color:'text-amber-700' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white border border-slate-200 p-5">
                <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-1">{label}</p>
                <p className={`text-3xl font-semibold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Arama */}
          <div className="relative max-w-md">
            <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input type="text" placeholder="Tabloda ara..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full border border-slate-200 pl-9 pr-4 py-2 text-sm outline-none focus:border-slate-900 bg-white"/>
          </div>

          {/* Tablo */}
          <div className="bg-white border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">
                {deptLabel} — Belgeler
                <span className="text-slate-400 font-normal ml-2">({filteredDocs.length} kayıt{search ? ` / ${preview.documents?.length} toplam` : ''})</span>
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Belge No','Başlık','Kategori','Cari','Durum','Oluşturan','Birim','Tarih','Hedef'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageData.length === 0 ? (
                    <tr><td colSpan="9" className="py-12 text-center text-sm text-slate-400">
                      {search ? 'Sonuç bulunamadı' : 'Bu dönemde kayıt yok'}
                    </td></tr>
                  ) : pageData.map((doc, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">{doc.belge_no||'—'}</td>
                      <td className="py-3 px-4 text-slate-900 max-w-[160px] truncate" title={doc.title}>{doc.title}</td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{doc.category||'—'}</td>
                      <td className="py-3 px-4 text-slate-600 max-w-[120px] truncate">{doc.cari||'—'}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[doc.status]||'bg-slate-100 text-slate-600'}`}>
                          {STATUS_LABELS[doc.status]||doc.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{doc.created_by_name||'—'}</td>
                      <td className="py-3 px-4 text-slate-500 text-xs whitespace-nowrap">{doc.current_department||'—'}</td>
                      <td className="py-3 px-4 text-slate-500 text-xs whitespace-nowrap">
                        {doc.created_at ? new Date(doc.created_at).toLocaleDateString('tr-TR') : '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-xs whitespace-nowrap">
                        {doc.hedef_tarih ? new Date(doc.hedef_tarih).toLocaleDateString('tr-TR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={pageSize} setPageSize={setPageSize}
              totalPages={totalPages} goTo={goTo} total={total} start={start} />
          </div>
        </>)}
      </div>
    </Layout>
  );
};

export default IhracatRapor;
