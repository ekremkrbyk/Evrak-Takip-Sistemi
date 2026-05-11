import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import Pagination, { usePagination } from '../components/Pagination';
import axios from 'axios';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  CurrencyCircleDollar, CalendarBlank, FileArrowDown, CheckCircle,
  Clock, Warning, ArrowRight, Eye, Funnel, X
} from '@phosphor-icons/react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PAYMENT_TYPE_TR = {
  cek: 'Çek', senet: 'Senet', havale: 'Havale / EFT',
  nakit: 'Nakit', kredi_karti: 'Kredi Kartı',
};
const STATUS_TR = {
  pending: 'Beklemede', in_progress: 'İşlemde', approved: 'Onaylandı',
  rejected: 'Reddedildi', iade: 'İade', revize: 'Revize', cancelled: 'İptal', draft: 'Taslak',
};
const PAYMENT_STATUS_TR = {
  gecikmiş: 'Gecikmiş', bu_hafta: 'Bu Hafta', ileriki: 'İleriki',
  tarihi_yok: 'Tarih Yok', odendi: 'Ödendi',
};
const PAYMENT_STATUS_COLORS = {
  gecikmiş: 'bg-red-100 text-red-700 border border-red-200',
  bu_hafta: 'bg-amber-100 text-amber-700 border border-amber-200',
  ileriki:  'bg-blue-100 text-blue-700 border border-blue-200',
  tarihi_yok: 'bg-slate-100 text-slate-600 border border-slate-200',
  odendi:   'bg-emerald-100 text-emerald-700 border border-emerald-200',
};

// Ayı Türkçe yaz
const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

const Finance = () => {
  const navigate = useNavigate();
  const [view, setView]           = useState('list');     // 'list' | 'calendar'
  const [docs, setDocs]           = useState([]);
  const [calDocs, setCalDocs]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [calYear, setCalYear]     = useState(new Date().getFullYear());
  const [calMonth, setCalMonth]   = useState(new Date().getMonth() + 1);

  // Ödeme modalı
  const [payModal, setPayModal]   = useState(null);
  const [payNote, setPayNote]     = useState('');
  const [payMuhasebe, setPayMuhasebe] = useState(false);

  // Excel export filtreleri
  const [exportStart, setExportStart] = useState('');
  const [exportEnd,   setExportEnd]   = useState('');
  const [exporting,   setExporting]   = useState(false);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/finance/queue`, { withCredentials: true });
      setDocs(data);
    } catch (e) {
      toast.error('Veriler yüklenemedi');
    } finally { setLoading(false); }
  }, []);

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/finance/calendar?year=${calYear}&month=${calMonth}`, { withCredentials: true });
      setCalDocs(data.documents || []);
    } catch (e) { toast.error('Takvim yüklenemedi'); }
    finally { setLoading(false); }
  }, [calYear, calMonth]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);
  useEffect(() => { if (view === 'calendar') fetchCalendar(); }, [view, fetchCalendar]);

  const [payDekont, setPayDekont]   = useState(null);

  const handleMarkPaid = async () => {
    try {
      const fd = new FormData();
      fd.append('document_id', payModal.id);
      fd.append('note', payNote);
      fd.append('route_to_muhasebe', payMuhasebe ? 'true' : 'false');
      if (payDekont) fd.append('dekont', payDekont);
      await axios.post(`${API}/finance/mark-paid`, fd, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Ödeme kaydedildi' + (payMuhasebe ? ' — Muhasebe\'ye yönlendirildi' : ''));
      setPayModal(null);
      setPayNote('');
      setPayMuhasebe(false);
      setPayDekont(null);
      fetchQueue();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Hata oluştu');
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      let url = `${API}/finance/export-excel`;
      const params = [];
      if (exportStart) params.push(`start_date=${exportStart}`);
      if (exportEnd)   params.push(`end_date=${exportEnd}`);
      if (params.length) url += '?' + params.join('&');
      const resp = await axios.get(url, { withCredentials: true, responseType: 'blob' });
      const blobUrl = URL.createObjectURL(resp.data);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `odeme_listesi_${new Date().toISOString().slice(0,10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(blobUrl);
      toast.success('Excel indirildi');
    } catch (e) {
      toast.error('Excel indirilemedi');
    } finally { setExporting(false); }
  };

  // Filtreli liste
  const filteredDocs = filterStatus === 'all'
    ? docs
    : docs.filter(d => d.payment_status === filterStatus);
  const { page: fPage, pageSize: fPageSize, setPageSize: fSetPageSize, totalPages: fTotalPages, pageData: fPageData, goTo: fGoTo, total: fTotal, start: fStart } = usePagination(filteredDocs, 20);

  // Takvim grid
  const buildCalendarGrid = () => {
    const firstDay = new Date(calYear, calMonth - 1, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();
    const cells = [];
    // Boş hücreler (pazartesiden başla)
    const startOffset = (firstDay === 0 ? 6 : firstDay - 1);
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  };

  const getCalDayDocs = (day) => {
    const dateStr = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return calDocs.filter(d => d.hedef_tarih === dateStr);
  };

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // İstatistikler
  const stats = {
    total: docs.length,
    gecikmiş: docs.filter(d => d.payment_status === 'gecikmiş').length,
    bu_hafta: docs.filter(d => d.payment_status === 'bu_hafta').length,
    odendi: docs.filter(d => d.payment_status === 'odendi').length,
  };

  return (
    <Layout>
      <div className="p-8 space-y-6">

        {/* Başlık + Kontroller */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Finans & Ödeme Takibi</h1>
            <p className="text-sm text-slate-500 mt-0.5">Ödeme gerektiren belgeleri yönetin</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Görünüm seçici */}
            <div className="flex border border-slate-200 bg-white">
              <button onClick={() => setView('list')}
                className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${view==='list' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                <Funnel size={15}/> Liste
              </button>
              <button onClick={() => setView('calendar')}
                className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${view==='calendar' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                <CalendarBlank size={15}/> Takvim
              </button>
            </div>
          </div>
        </div>

        {/* Stat kartları */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Toplam Bekleyen', value: stats.total,      icon: CurrencyCircleDollar, color: 'text-slate-700',   bg: 'bg-slate-100',   filter: 'all'      },
            { label: 'Gecikmiş',        value: stats.gecikmiş,   icon: Warning,              color: 'text-red-700',    bg: 'bg-red-50',      filter: 'gecikmiş' },
            { label: 'Bu Hafta',        value: stats.bu_hafta,   icon: Clock,                color: 'text-amber-700',  bg: 'bg-amber-50',    filter: 'bu_hafta' },
            { label: 'Ödendi',          value: stats.odendi,     icon: CheckCircle,          color: 'text-emerald-700',bg: 'bg-emerald-50',  filter: 'odendi'   },
          ].map(({ label, value, icon: Icon, color, bg, filter }) => (
            <button
              key={label}
              onClick={() => { setView('list'); setFilterStatus(f => f === filter ? 'all' : filter); }}
              className={`bg-white border text-left p-5 flex items-center gap-4 transition-all hover:shadow-md ${filterStatus === filter ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-400'}`}
            >
              <div className={`p-3 rounded-full ${bg}`}><Icon size={22} className={color} weight="bold"/></div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
              {filterStatus === filter && filter !== 'all' && (
                <span className="ml-auto text-xs text-slate-400">✕</span>
              )}
            </button>
          ))}
        </div>

        {/* Excel Export Bölümü */}
        <div className="bg-white border border-slate-200 p-5">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <FileArrowDown size={18} className="text-emerald-600"/> Excel Dışa Aktar
            </span>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">Başlangıç:</label>
              <input type="date" value={exportStart} onChange={e=>setExportStart(e.target.value)}
                className="border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-slate-900"/>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">Bitiş:</label>
              <input type="date" value={exportEnd} onChange={e=>setExportEnd(e.target.value)}
                className="border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-slate-900"/>
            </div>
            <button onClick={handleExportExcel} disabled={exporting}
              className="bg-emerald-700 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-800 transition-colors flex items-center gap-2 disabled:opacity-60">
              <FileArrowDown size={16}/> {exporting ? 'İndiriliyor...' : 'Excel İndir'}
            </button>
            {(exportStart || exportEnd) && (
              <button onClick={()=>{setExportStart('');setExportEnd('');}}
                className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
            )}
          </div>
        </div>

        {/* LİSTE GÖRÜNÜMÜ */}
        {view === 'list' && (
          <div className="bg-white border border-slate-200">
            {/* Filtre */}
            <div className="px-5 py-3 border-b border-slate-100 flex gap-2 flex-wrap">
              {[['all','Tümü'], ['gecikmiş','Gecikmiş'], ['bu_hafta','Bu Hafta'], ['ileriki','İleriki'], ['odendi','Ödendi'], ['tarihi_yok','Tarih Yok']].map(([val, label]) => (
                <button key={val} onClick={()=>setFilterStatus(val)}
                  className={`px-3 py-1 text-xs font-medium border transition-colors ${filterStatus===val ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="p-10 text-center text-slate-400 text-sm">Yükleniyor...</div>
            ) : filteredDocs.length === 0 ? (
              <div className="p-10 text-center text-slate-400 text-sm">Kayıt bulunamadı</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Belge No', 'Başlık', 'Cari', 'Ödeme Tipi', 'Vade Tarihi', 'Durum', 'İşlemler'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fPageData.map(doc => (
                    <tr key={doc.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-slate-700">{doc.belge_no}</span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 max-w-[200px] truncate">{doc.title}</p>
                        {doc.fatura_no && <p className="text-xs text-slate-400">Fatura: {doc.fatura_no}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[140px] truncate">{doc.cari || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{PAYMENT_TYPE_TR[doc.payment_type] || doc.payment_type || '—'}</td>
                      <td className="px-4 py-3">
                        {doc.hedef_tarih
                          ? <span className={doc.hedef_tarih < todayStr && doc.payment_status !== 'odendi' ? 'text-red-600 font-medium' : 'text-slate-600'}>{doc.hedef_tarih}</span>
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${PAYMENT_STATUS_COLORS[doc.payment_status] || 'bg-slate-100 text-slate-600'}`}>
                          {PAYMENT_STATUS_TR[doc.payment_status] || doc.payment_status || 'Bekliyor'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={()=>navigate(`/documents/${doc.id}`)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Belgeye git">
                            <Eye size={16}/>
                          </button>
                          {doc.payment_status !== 'odendi' && doc.status !== 'cancelled' && (
                            <button onClick={()=>{setPayModal(doc);setPayNote('');setPayMuhasebe(false);}}
                              className="px-3 py-1.5 text-xs font-medium bg-emerald-700 text-white hover:bg-emerald-800 transition-colors flex items-center gap-1">
                              <CheckCircle size={13}/> Ödendi İşaretle
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAKVİM GÖRÜNÜMÜ */}
        {view === 'calendar' && (
          <div className="bg-white border border-slate-200">
            {/* Ay navigasyonu */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <button onClick={()=>{ let m=calMonth-1,y=calYear; if(m<1){m=12;y--;} setCalMonth(m);setCalYear(y); }}
                className="px-3 py-1.5 text-sm border border-slate-200 hover:bg-slate-50 transition-colors">← Önceki</button>
              <h2 className="text-base font-semibold text-slate-800">{MONTHS_TR[calMonth-1]} {calYear}</h2>
              <button onClick={()=>{ let m=calMonth+1,y=calYear; if(m>12){m=1;y++;} setCalMonth(m);setCalYear(y); }}
                className="px-3 py-1.5 text-sm border border-slate-200 hover:bg-slate-50 transition-colors">Sonraki →</button>
            </div>

            {/* Haftanın günleri */}
            <div className="grid grid-cols-7 border-b border-slate-100">
              {['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'].map(g => (
                <div key={g} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">{g}</div>
              ))}
            </div>

            {/* Günler */}
            <div className="grid grid-cols-7">
              {buildCalendarGrid().map((day, idx) => {
                const dayDocs = day ? getCalDayDocs(day) : [];
                const dateStr = day ? `${calYear}-${String(calMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}` : '';
                const isToday = dateStr === todayStr;
                return (
                  <div key={idx} className={`min-h-[90px] border-b border-r border-slate-100 p-1.5 ${!day ? 'bg-slate-50' : ''}`}>
                    {day && (
                      <>
                        <span className={`text-xs font-semibold inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>{day}</span>
                        <div className="mt-1 space-y-0.5">
                          {dayDocs.slice(0,3).map(d => (
                            <button key={d.id} onClick={()=>navigate(`/documents/${d.id}`)}
                              className={`w-full text-left text-[10px] px-1.5 py-0.5 truncate font-medium ${PAYMENT_STATUS_COLORS[d.payment_status] || 'bg-blue-100 text-blue-700'}`}>
                              {d.belge_no || d.title}
                            </button>
                          ))}
                          {dayDocs.length > 3 && <p className="text-[10px] text-slate-400 pl-1">+{dayDocs.length-3} daha</p>}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Ödeme Modalı */}
      {payModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Ödeme Kaydı</h2>
              <button onClick={()=>{ setPayModal(null); setPayDekont(null); }} className="text-slate-400 hover:text-slate-700"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 border border-slate-200 p-4 space-y-1.5">
                <p className="text-sm font-semibold text-slate-800">{payModal.title}</p>
                <p className="text-xs text-slate-500">Belge No: <span className="font-mono font-bold text-slate-700">{payModal.belge_no}</span></p>
                {payModal.cari && <p className="text-xs text-slate-500">Cari: {payModal.cari}</p>}
                {payModal.hedef_tarih && <p className="text-xs text-slate-500">Vade: {payModal.hedef_tarih}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ödeme Notu</label>
                <textarea value={payNote} onChange={e=>setPayNote(e.target.value)} rows={3}
                  placeholder="Dekont no, banka, açıklama..."
                  className="w-full border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 resize-none"/>
              </div>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input type="checkbox" checked={payMuhasebe} onChange={e=>setPayMuhasebe(e.target.checked)}
                  className="w-4 h-4 accent-slate-900"/>
                <div>
                  <p className="text-sm font-medium text-slate-700">Muhasebeye Yönlendir</p>
                  <p className="text-xs text-slate-400">Belge otomatik olarak Muhasebe birimine gönderilir</p>
                </div>
              </label>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dekont / Belge <span className="text-slate-400 font-normal">(opsiyonel)</span></label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={e => setPayDekont(e.target.files[0] || null)}
                  className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:border file:border-slate-200 file:text-xs file:font-medium file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100 file:cursor-pointer cursor-pointer"
                />
                {payDekont && <p className="text-xs text-slate-500 mt-1">Seçilen: {payDekont.name}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={handleMarkPaid}
                  className="flex-1 bg-emerald-700 text-white py-2.5 text-sm font-medium hover:bg-emerald-800 transition-colors flex items-center justify-center gap-2">
                  <CheckCircle size={16}/> Ödeme Yaptım
                </button>
                <button onClick={()=>{ setPayModal(null); setPayDekont(null); }}
                  className="flex-1 border border-slate-200 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors">
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Finance;
