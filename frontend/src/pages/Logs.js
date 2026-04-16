import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import { MagnifyingGlass } from '@phosphor-icons/react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    let filtered = logs;
    
    if (searchQuery) {
      filtered = filtered.filter(log => 
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.entity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.user_id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (filterAction !== 'all') {
      filtered = filtered.filter(log => log.action === filterAction);
    }
    
    setFilteredLogs(filtered);
  }, [logs, searchQuery, filterAction]);

  const fetchLogs = async () => {
    try {
      const { data } = await axios.get(`${API}/logs?limit=200`, { withCredentials: true });
      setLogs(data);
      setFilteredLogs(data);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action) => {
    const actionMap = {
      login: 'bg-blue-50 text-blue-700 border-blue-300',
      register: 'bg-green-50 text-green-700 border-green-300',
      upload_document: 'bg-purple-50 text-purple-700 border-purple-300',
      route_document: 'bg-yellow-50 text-yellow-700 border-yellow-300',
      document_accept: 'bg-blue-50 text-blue-700 border-blue-300',
      document_approve: 'bg-green-50 text-green-700 border-green-300',
      document_reject: 'bg-red-50 text-red-700 border-red-300',
      create_user: 'bg-green-50 text-green-700 border-green-300',
      update_user: 'bg-yellow-50 text-yellow-700 border-yellow-300',
      delete_user: 'bg-red-50 text-red-700 border-red-300',
      download_document: 'bg-slate-100 text-slate-700 border-slate-300'
    };
    return actionMap[action] || 'bg-slate-100 text-slate-700 border-slate-300';
  };

  const actionLabels = {
    login: 'Giriş',
    register: 'Kayıt',
    upload_document: 'Belge Yükleme',
    route_document: 'Belge Yönlendirme',
    document_accept: 'Belge Kabul',
    document_approve: 'Belge Onay',
    document_reject: 'Belge Red',
    create_user: 'Kullanıcı Oluşturma',
    update_user: 'Kullanıcı Güncelleme',
    delete_user: 'Kullanıcı Silme',
    download_document: 'Belge İndirme'
  };

  const uniqueActions = [...new Set(logs.map(log => log.action))];

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
        <div>
          <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Sistem Logları</h1>
          <p className="text-sm text-slate-600 mt-1">Toplam {logs.length} log kaydı</p>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-md relative">
            <MagnifyingGlass size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Log ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="search-logs"
              className="w-full border border-slate-200 pl-10 pr-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white"
            />
          </div>
          
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            data-testid="filter-action"
            className="border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white"
          >
            <option value="all">Tüm İşlemler</option>
            {uniqueActions.map(action => (
              <option key={action} value={action}>
                {actionLabels[action] || action}
              </option>
            ))}
          </select>
        </div>
        
        {/* Logs Table */}
        <div className="bg-white border border-slate-200 p-6">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-slate-500">Log kaydı bulunamadı</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-200" data-testid="logs-table">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Tarih/Saat</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">İşlem</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Kullanıcı ID</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Entity Tipi</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Entity ID</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Detaylar</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, index) => (
                    <tr key={log.id || index} className="border-b border-slate-200 hover:bg-slate-50 transition-colors" data-testid={`log-row-${index}`}>
                      <td className="py-4 px-4 text-sm text-slate-600">
                        {new Date(log.timestamp).toLocaleString('tr-TR')}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium border ${getActionBadge(log.action)}`}>
                          {actionLabels[log.action] || log.action}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm text-slate-600 font-mono text-xs">
                        {log.user_id?.substring(0, 8)}...
                      </td>
                      <td className="py-4 px-4 text-sm text-slate-600">{log.entity_type}</td>
                      <td className="py-4 px-4 text-sm text-slate-600 font-mono text-xs">
                        {log.entity_id?.substring(0, 8)}...
                      </td>
                      <td className="py-4 px-4 text-sm text-slate-600">
                        {log.details && Object.keys(log.details).length > 0 ? (
                          <span className="text-xs">{JSON.stringify(log.details).substring(0, 50)}...</span>
                        ) : (
                          '-'
                        )}
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

export default Logs;
