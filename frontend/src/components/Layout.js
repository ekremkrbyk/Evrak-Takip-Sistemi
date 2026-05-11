import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Bell, FileText, Users, ClipboardText, SignOut, X, Wallet,
  Buildings, CurrencyCircleDollar, HardDrive, ChartBar, Eye, EyeSlash
} from '@phosphor-icons/react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Layout = ({ children }) => {
  const { user, logout, checkAuth } = useAuth();
  const location  = useLocation();
  const navigate  = useNavigate();

  const [notifications,      setNotifications]      = useState([]);
  const [showNotifications,  setShowNotifications]  = useState(false);
  const [unreadCount,        setUnreadCount]        = useState(0);
  const [patronViewAll,      setPatronViewAll]      = useState(user?.view_all_documents !== false);

  // Patron belge modu - local state senkron
  useEffect(() => { setPatronViewAll(user?.view_all_documents !== false); }, [user]);

  const isAdmin      = user?.role === 'admin' || user?.role === 'superadmin';
  const isSuperAdmin = user?.role === 'superadmin';
  const canVendors   = isAdmin || !!user?.can_manage_vendors;
  // İhracat raporu: ihracat birimi adları veya admin
  const IHRACAT_DEPTS = ['IHRACAT', 'İHRACAT', 'EXPORT', 'DIŞ TİCARET', 'DIS TICARET'];
  const canIhracat   = isAdmin || IHRACAT_DEPTS.some(d => (user?.department || '').toUpperCase().includes(d.replace('İ','I')));

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    return () => clearInterval(interval);
  }, []);

  const seenIdsRef = React.useRef(new Set());

  const fetchNotifications = async () => {
    try {
      const { data } = await axios.get(`${API}/notifications`, { withCredentials: true });
      if ('Notification' in window && Notification.permission === 'granted') {
        data.forEach((n) => {
          if (!n.is_read && !seenIdsRef.current.has(n.id)) {
            try { new Notification(n.title || 'Evrak Takip', { body: n.message || '', tag: n.id }); } catch (_) {}
          }
          seenIdsRef.current.add(n.id);
        });
      } else {
        data.forEach((n) => seenIdsRef.current.add(n.id));
      }
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } catch { /* silent */ }
  };

  const markAsRead = async (id) => {
    try { await axios.put(`${API}/notifications/${id}/read`, {}, { withCredentials: true }); fetchNotifications(); } catch {}
  };
  const markAllAsRead = async () => {
    if (unreadCount === 0) return;
    try { await axios.put(`${API}/notifications/read-all`, {}, { withCredentials: true }); fetchNotifications(); } catch {}
  };
  const onBellClick = () => setShowNotifications(v => !v);
  const handleLogout = async () => { await logout(); navigate('/login'); };
  const isActive = (path) => location.pathname === path;

  // Patron belge modu toggle
  const handlePatronToggle = async () => {
    const newVal = !patronViewAll;
    try {
      await axios.put(`${API}/users/${user.id}`, { view_all_documents: newVal }, { withCredentials: true });
      setPatronViewAll(newVal);
      await checkAuth();          // AuthContext user state'ini güncelle
      // Belgeler sayfasındaysak yenile ki liste değişsin
      if (window.location.pathname === '/' || window.location.pathname === '/documents') {
        window.location.reload();
      }
    } catch { }
  };

  const navLink = (to, testId, Icon, label) => (
    <Link to={to} data-testid={testId}
      className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
        isActive(to) ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
      }`}>
      <Icon size={20} weight={isActive(to) ? 'fill' : 'regular'} />
      <span>{label}</span>
    </Link>
  );

  const pageTitle = () => {
    const p = location.pathname;
    if (p === '/')                        return 'Kontrol Paneli';
    if (p === '/documents')               return 'Belgeler';
    if (p.startsWith('/documents/'))      return 'Belge Detayı';
    if (p === '/users')                   return 'Kullanıcı Yönetimi';
    if (p === '/departments')             return 'Birim Yönetimi';
    if (p === '/vendors')                 return 'Cari Hesaplar';
    if (p === '/permission-groups')       return 'Yetki Grupları';
    if (p === '/logs')                    return 'Sistem Logları';
    if (p === '/finance')                 return 'Finans';
    if (p === '/backup')                  return 'Yedekleme';
    if (p === '/ihracat-rapor')           return 'İhracat Raporu';
    return '';
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar */}
      <div className="w-64 fixed left-0 top-0 h-screen border-r border-slate-200 bg-slate-50 flex flex-col" data-testid="sidebar">
        <div className="p-6 border-b border-slate-200">
          <h1 className="text-xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Evrak Takip</h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">{user?.department}</p>
          {/* Patron rolü göstergesi */}
          {isSuperAdmin && (
            <span className="inline-flex mt-1 px-2 py-0.5 text-xs font-semibold bg-purple-900 text-white">PATRON</span>
          )}
        </div>

        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {navLink('/', 'nav-dashboard', FileText, 'Kontrol Paneli')}
          {navLink('/documents', 'nav-documents', ClipboardText, 'Belgeler')}

          {/* Patron belge modu toggle — sadece patrona görünür */}
          {isSuperAdmin && (
            <button
              onClick={handlePatronToggle}
              className={`w-full flex items-center gap-3 px-4 py-2 text-xs font-medium transition-colors rounded-none border-l-2 ${
                patronViewAll
                  ? 'border-green-500 text-green-700 bg-green-50 hover:bg-green-100'
                  : 'border-slate-400 text-slate-500 bg-slate-100 hover:bg-slate-200'
              }`}
              title="Tıkla: Tüm Belgeler ↔ Sadece İlgili Belgeler"
            >
              {patronViewAll ? <Eye size={16} /> : <EyeSlash size={16} />}
              <span>{patronViewAll ? 'Tüm Belgeler Görünüyor' : 'Sadece İlgili Belgeler'}</span>
            </button>
          )}

          {/* Finans — admin, superadmin, finans birimi */}
          {(isAdmin || ['FINANS','FIN','MUHASEBE'].some(d => (user?.department||'').toUpperCase().includes(d))) && (
            navLink('/finance', 'nav-finance', CurrencyCircleDollar, 'Finans')
          )}

          {/* İhracat Raporu */}
          {navLink('/ihracat-rapor', 'nav-ihracat', ChartBar, 'Dönemsel Rapor')}

          {/* Admin bloku — admin VE superadmin */}
          {isAdmin && (<>
            {navLink('/users', 'nav-users', Users, 'Kullanıcılar')}
            {navLink('/departments', 'nav-departments', Buildings, 'Birimler')}
            {navLink('/logs', 'nav-logs', ClipboardText, 'Sistem Logları')}
            {navLink('/backup', 'nav-backup', HardDrive, 'Yedekleme')}
          </>)}

          {/* Cari Hesaplar — admin, superadmin veya can_manage_vendors */}
          {canVendors && navLink('/vendors', 'nav-vendors', Wallet, 'Cari Hesaplar')}
        </nav>

        {/* Alt kullanıcı bilgisi */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{user?.full_name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
            <button onClick={handleLogout} data-testid="logout-button"
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors" title="Çıkış Yap">
              <SignOut size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64 flex-1">
        {/* Header */}
        <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8" data-testid="header">
          <h2 className="text-lg font-medium text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {pageTitle()}
          </h2>

          {/* Bildirimler */}
          <div className="relative">
            <button onClick={onBellClick} data-testid="notification-bell"
              className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors">
              <Bell size={24} weight={unreadCount > 0 ? 'fill' : 'regular'} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-600 rounded-full" data-testid="notification-badge" />
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-96 bg-white border border-slate-200 shadow-lg z-50" data-testid="notification-dropdown">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Bildirimler</h3>
                  <div className="flex items-center gap-2">
                    {notifications.some(n => !n.is_read) && (
                      <button onClick={markAllAsRead}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 hover:bg-blue-50 transition-colors">
                        Tümünü Okundu İşaretle
                      </button>
                    )}
                    <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-600">
                      <X size={20} />
                    </button>
                  </div>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-500">Bildirim yok</div>
                  ) : notifications.map((notif) => (
                    <div key={notif.id}
                      className={`p-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${!notif.is_read ? 'bg-blue-50/40' : ''}`}
                      onClick={() => {
                        if (!notif.is_read) markAsRead(notif.id);
                        if (notif.document_id) { navigate(`/documents/${notif.document_id}`); setShowNotifications(false); }
                      }}
                      data-testid={`notification-item-${notif.id}`}>
                      {!notif.is_read && <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-2 align-middle" />}
                      <p className="text-sm font-medium text-slate-900 inline">{notif.title}</p>
                      <p className="text-xs text-slate-600 mt-1">{notif.message}</p>
                      <p className="text-xs text-slate-400 mt-1">{new Date(notif.created_at).toLocaleString('tr-TR')}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Page Content */}
        <div className="p-8 min-h-screen bg-white">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;
