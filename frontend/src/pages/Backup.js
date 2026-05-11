import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import { toast } from 'sonner';
import { HardDrive, ArrowDown, ArrowClockwise, CheckCircle, Warning } from '@phosphor-icons/react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Backup = () => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [backing, setBacking]   = useState(false);
  const [sinceDays, setSinceDays] = useState(0);  // 0=tümü, 7=son 7 gün, 30=son 30 gün

  const fetchBackups = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/admin/backups`, { withCredentials: true });
      setBackups(data);
    } catch (e) {
      toast.error('Yedekler yüklenemedi');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBackups(); }, [fetchBackups]);

  const handleBackup = async () => {
    setBacking(true);
    try {
      const { data } = await axios.post(`${API}/admin/backup`, { since_days: sinceDays }, { withCredentials: true });
      toast.success(`Yedek alındı: ${data.file} (${data.size_mb} MB)`);
      fetchBackups();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Yedekleme başarısız');
    } finally { setBacking(false); }
  };

  const handleDownload = async (filename) => {
    try {
      const resp = await axios.get(`${API}/admin/backups/${filename}/download`,
        { withCredentials: true, responseType: 'blob' });
      const url = URL.createObjectURL(resp.data);
      const a   = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('İndirme başarısız');
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('tr-TR');
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Yedekleme Sistemi
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Otomatik yedekler her gece saat 03:00'te alınır. Manuel yedek de alabilirsiniz.
            </p>
          </div>
          <button
            onClick={handleBackup}
            disabled={backing}
            className="bg-slate-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            <HardDrive size={18} />
            {backing ? 'Yedek Alınıyor...' : 'Şimdi Yedek Al'}
          </button>
          <select value={sinceDays} onChange={e => setSinceDays(Number(e.target.value))}
            className="border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-900 bg-white">
            <option value={0}>Tüm Dosyalar</option>
            <option value={7}>Son 7 Gün</option>
            <option value={30}>Son 30 Gün</option>
            <option value={90}>Son 90 Gün</option>
          </select>
        </div>

        {/* Bilgi Kartları */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 p-5">
            <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-1">Toplam Yedek</p>
            <p className="text-3xl font-semibold text-slate-900">{backups.length}</p>
          </div>
          <div className="bg-white border border-slate-200 p-5">
            <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-1">Son Yedek</p>
            <p className="text-sm font-medium text-slate-900">
              {backups[0] ? formatDate(backups[0].created_at) : '—'}
            </p>
          </div>
          <div className="bg-white border border-slate-200 p-5">
            <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider mb-1">Otomatik Yedek</p>
            <div className="flex items-center gap-2 mt-1">
              <CheckCircle size={18} className="text-emerald-600" weight="fill"/>
              <span className="text-sm text-emerald-700 font-medium">Aktif — Her gece 03:00</span>
            </div>
          </div>
        </div>

        {/* Email Ayarları Bilgisi */}
        <div className="bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <Warning size={18} className="text-amber-600 mt-0.5 shrink-0" weight="fill"/>
          <div className="text-sm text-amber-800">
            <p className="font-medium mb-1">Brevo Email Bildirimi Kurulumu</p>
            <p>Yedek tamamlandığında email almak için <code className="bg-amber-100 px-1">.env</code> dosyasına şunları ekleyin:</p>
            <pre className="mt-2 bg-amber-100 p-2 text-xs font-mono rounded">
{`BREVO_API_KEY=your_brevo_smtp_key
BREVO_SENDER_EMAIL=noreply@sirketiniz.com
BACKUP_EMAIL=admin@sirketiniz.com
BACKUP_DIR=C:\\Backups\\EvrakTakip   # isteğe bağlı
BACKUP_HOUR=3                        # kaçıncı saatte (varsayılan: 3)`}
            </pre>
          </div>
        </div>

        {/* Yedekler Listesi */}
        <div className="bg-white border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Mevcut Yedekler</h2>
            <button onClick={fetchBackups} className="text-slate-400 hover:text-slate-700 p-1">
              <ArrowClockwise size={16}/>
            </button>
          </div>
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-400">Yükleniyor...</div>
          ) : backups.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">
              Henüz yedek yok. İlk yedeği almak için "Şimdi Yedek Al" butonuna basın.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-6">Dosya Adı</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-6">Boyut</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-6">Oluşturulma</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-6">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b, i) => (
                  <tr key={b.name} className={`border-b border-slate-50 hover:bg-slate-50 ${i === 0 ? 'bg-emerald-50/40' : ''}`}>
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-2">
                        <HardDrive size={15} className="text-slate-400"/>
                        <span className="font-mono text-xs text-slate-700">{b.name}</span>
                        {i === 0 && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5">En son</span>}
                      </div>
                    </td>
                    <td className="py-3 px-6 text-slate-600">{b.size_mb} MB</td>
                    <td className="py-3 px-6 text-slate-600">{formatDate(b.created_at)}</td>
                    <td className="py-3 px-6">
                      <button
                        onClick={() => handleDownload(b.name)}
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 px-3 py-1.5 hover:bg-slate-50 transition-colors"
                      >
                        <ArrowDown size={13}/> İndir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Backup;
