import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Pagination, { usePagination } from '../components/Pagination';
import axios from 'axios';
import { MagnifyingGlass } from '@phosphor-icons/react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ACTION_LABELS = {
  login:                  'Giriş Yaptı',
  login_failed:           'Başarısız Giriş',
  register:               'Kayıt Oldu',
  upload_document:        'Belge Yükledi',
  download_document:      'Belge İndirdi',
  route_document:         'Belge Yönlendirdi',
  document_accept:        'Belgeyi Kabul Etti',
  document_approve:       'Belgeyi Onayladı',
  document_reject:        'Belgeyi Reddetti',
  document_iade:          'Belgeyi İade Etti',
  document_revize:        'Revize İstedi',
  document_geri_al:       'Belgeyi Geri Aldı',
  document_not_related:   'İlgisiz İşaretledi',
  add_attachment:         'Ek Belge Yükledi',
  create_user:            'Kullanıcı Oluşturdu',
  update_user:            'Kullanıcı Güncelledi',
  delete_user:            'Kullanıcı Sildi',
  change_password:        'Şifre Değiştirdi',
  create_department:      'Birim Oluşturdu',
  update_department:      'Birim Güncelledi',
  delete_department:      'Birim Sildi',
  create_vendor:          'Cari Oluşturdu',
  update_vendor:          'Cari Güncelledi',
  delete_vendor:          'Cari Sildi',
  import_vendors:         'Toplu Cari Aktardı',
  create_permission_group:'Yetki Grubu Oluşturdu',
  update_permission_group:'Yetki Grubu Güncelledi',
  delete_permission_group:'Yetki Grubu Sildi',
  finance_mark_paid:      'Ödeme İşaretledi',
  dekont_yuklendi:        'Dekont Yükledi',
};

const ACTION_COLORS = {
  login:                  'bg-blue-50 text-blue-700 border-blue-200',
  login_failed:           'bg-red-50 text-red-600 border-red-200',
  register:               'bg-green-50 text-green-700 border-green-200',
  upload_document:        'bg-purple-50 text-purple-700 border-purple-200',
  download_document:      'bg-slate-100 text-slate-600 border-slate-200',
  route_document:         'bg-yellow-50 text-yellow-700 border-yellow-200',
  document_accept:        'bg-blue-50 text-blue-700 border-blue-200',
  document_approve:       'bg-green-50 text-green-700 border-green-200',
  document_reject:        'bg-red-50 text-red-700 border-red-200',
  document_iade:          'bg-orange-50 text-orange-700 border-orange-200',
  document_revize:        'bg-orange-50 text-orange-700 border-orange-200',
  finance_mark_paid:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  create_user:            'bg-green-50 text-green-700 border-green-200',
  update_user:            'bg-yellow-50 text-yellow-700 border-yellow-200',
  delete_user:            'bg-red-50 text-red-700 border-red-200',
  change_password:        'bg-indigo-50 text-indigo-700 border-indigo-200',
  create_vendor:          'bg-teal-50 text-teal-700 border-teal-200',
  update_vendor:          'bg-teal-50 text-teal-700 border-teal-200',
  delete_vendor:          'bg-red-50 text-red-700 border-red-200',
  import_vendors:         'bg-teal-50 text-teal-700 border-teal-200',
};

const ENTITY_TR = {
  document: 'Belge',
  user: 'Kullanıcı',
  department: 'Birim',
  vendor: 'Cari',
  permission_group: 'Yetki Grubu',
  bulk: 'Toplu',
};

function formatDetails(action, details) {
  if (!details || Object.keys(details).length === 0) return '—';
  const parts = [];
  if (details.title)         parts.push(`"${details.title}"`);
  if (details.name)          parts.push(`"${details.name}"`);
  if (details.email)         parts.push(details.email);
  if (details.target_email)  parts.push(`→ ${details.target_email}`);
  if (details.target === 'self') parts.push('kendi şifresi');
  if (details.file_name)     parts.push(details.file_name);
  if (details.category)      parts.push(details.category);
  if (details.note && details.note !== 'Ödeme yapıldı') parts.push(`Not: ${details.note}`);
  if (details.route_muhasebe) parts.push('→ Muhasebe');
  if (details.dekont)        parts.push(`Dekont: ${details.dekont}`);
  if (details.created != null) parts.push(`${details.created} eklendi`);
  if (details.skipped != null) parts.push(`${details.skipped} atlandı`);
  if (details.from_department) parts.push(`${details.from_department} → ${details.to_department || '?'}`);
  if (details.to_department && !details.from_department) parts.push(`→ ${details.to_department}`);
  if (details.role)          parts.push(`Rol: ${details.role === 'superadmin' ? 'Patron' : details.role === 'admin' ? 'Admin' : details.role}`);
  if (details.ip)            parts.push(`IP: ${details.ip}`);
  return parts.length ? parts.join(' · ') : JSON.stringify(details).slice(0, 80);
}

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const { page, pageSize, setPageSize, totalPages, pageData, goTo, total, start } = usePagination(filteredLogs, 50);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('all');

  useEffect(() => { fetchLogs(); }, []);

  useEffect(() => {
    let filtered = logs;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(log =>
        (log.user_name || '').toLowerCase().includes(q) ||
        (ACTION_LABELS[log.action] || log.action).toLowerCase().includes(q) ||
        (log.entity_type || '').toLowerCase().includes(q) ||
        (log.user_dept || '').toLowerCase().includes(q) ||
        formatDetails(log.action, log.details).toLowerCase().includes(q)
      );
    }
    if (filterAction !== 'all') {
      filtered = filtered.filter(log => log.action === filterAction);
    }
    setFilteredLogs(filtered);
  }, [logs, searchQuery, filterAction]);

  const fetchLogs = async () => {
    try {
      const { data } = await axios.get(`${API}/logs?limit=300`, { withCredentials: true });
      setLogs(data);
      setFilteredLogs(data);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally { setLoading(false); }
  };

  const uniqueActions = [...new Set(logs.map(log => log.action))].sort();

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-600 text-sm">Yükleniyor...</div>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Sistem Logları</h1>
          <p className="text-sm text-slate-600 mt-1">{filteredLogs.length} / {logs.length} kayıt gösteriliyor</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-md relative">
            <MagnifyingGlass size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Kullanıcı, işlem, detay ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="search-logs"
              className="w-full border border-slate-200 pl-10 pr-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white"
            />
          </div>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            data-testid="filter-action"
            className="border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 outline-none bg-white"
          >
            <option value="all">Tüm İşlemler</option>
            {uniqueActions.map(action => (
              <option key={action} value={action}>
                {ACTION_LABELS[action] || action}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white border border-slate-200 overflow-x-auto">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-slate-500">Log kaydı bulunamadı</p>
            </div>
          ) : (
            <table className="w-full text-sm" data-testid="logs-table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4 whitespace-nowrap">Tarih / Saat</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4 whitespace-nowrap">Kullanıcı</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4 whitespace-nowrap">İşlem</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4 whitespace-nowrap">Nesne Tipi</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Detaylar</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4 whitespace-nowrap">IP</th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((log, index) => (
                  <tr key={log.id || index} className="border-b border-slate-100 hover:bg-slate-50 transition-colors" data-testid={`log-row-${index}`}>
                    <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('tr-TR')}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <p className="text-sm font-medium text-slate-900">{log.user_name || '—'}</p>
                      {log.user_dept && <p className="text-xs text-slate-400">{log.user_dept}</p>}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium border whitespace-nowrap ${ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap">
                      {ENTITY_TR[log.entity_type] || log.entity_type || '—'}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-700 max-w-xs">
                      {formatDetails(log.action, log.details)}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400 font-mono whitespace-nowrap">
                      {log.ip_address || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pageSize={pageSize} setPageSize={setPageSize} totalPages={totalPages} goTo={goTo} total={total} start={start} />
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Logs;
