import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bell, FileText, Users, ClipboardText, SignOut, X } from '@phosphor-icons/react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data } = await axios.get(`${API}/notifications`, { withCredentials: true });
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await axios.put(`${API}/notifications/${notificationId}/read`, {}, { withCredentials: true });
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar */}
      <div className="w-64 fixed left-0 top-0 h-screen border-r border-slate-200 bg-slate-50" data-testid="sidebar">
        <div className="p-6 border-b border-slate-200">
          <h1 className="text-xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Evrak Takip</h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>{user?.department}</p>
        </div>
        
        <nav className="p-4 space-y-1">
          <Link
            to="/"
            data-testid="nav-dashboard"
            className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
              isActive('/') ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <FileText size={20} weight={isActive('/') ? 'fill' : 'regular'} />
            <span>Kontrol Paneli</span>
          </Link>
          
          <Link
            to="/documents"
            data-testid="nav-documents"
            className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
              isActive('/documents') ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <ClipboardText size={20} weight={isActive('/documents') ? 'fill' : 'regular'} />
            <span>Belgeler</span>
          </Link>
          
          {user?.role === 'admin' && (
            <>
              <Link
                to="/users"
                data-testid="nav-users"
                className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive('/users') ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Users size={20} weight={isActive('/users') ? 'fill' : 'regular'} />
                <span>Kullanıcılar</span>
              </Link>
              
              <Link
                to="/departments"
                data-testid="nav-departments"
                className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive('/departments') ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <ClipboardText size={20} weight={isActive('/departments') ? 'fill' : 'regular'} />
                <span>Birimler</span>
              </Link>
              
              <Link
                to="/permission-groups"
                data-testid="nav-permission-groups"
                className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive('/permission-groups') ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Users size={20} weight={isActive('/permission-groups') ? 'fill' : 'regular'} />
                <span>Yetki Grupları</span>
              </Link>
              
              <Link
                to="/logs"
                data-testid="nav-logs"
                className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive('/logs') ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <ClipboardText size={20} weight={isActive('/logs') ? 'fill' : 'regular'} />
                <span>Sistem Logları</span>
              </Link>
            </>
          )}
        </nav>
        
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{user?.full_name}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              data-testid="logout-button"
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Çıkış Yap"
            >
              <SignOut size={20} />
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="ml-64 flex-1">
        {/* Header */}
        <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8" data-testid="header">
          <div>
            <h2 className="text-lg font-medium text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
              {location.pathname === '/' && 'Kontrol Paneli'}
              {location.pathname === '/documents' && 'Belgeler'}
              {location.pathname.startsWith('/documents/') && 'Belge Detayı'}
              {location.pathname === '/users' && 'Kullanıcı Yönetimi'}
              {location.pathname === '/departments' && 'Birim Yönetimi'}
              {location.pathname === '/permission-groups' && 'Yetki Grupları'}
              {location.pathname === '/logs' && 'Sistem Logları'}
            </h2>
          </div>
          
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              data-testid="notification-bell"
              className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            >
              <Bell size={24} weight={unreadCount > 0 ? 'fill' : 'regular'} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-600 rounded-full" data-testid="notification-badge"></span>
              )}
            </button>
            
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-96 bg-white border border-slate-200 shadow-lg z-50" data-testid="notification-dropdown">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Bildirimler</h3>
                  <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={20} />
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500">Bildirim yok</div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`p-4 border-b border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors ${
                          !notif.is_read ? 'bg-slate-50' : ''
                        }`}
                        onClick={() => {
                          if (!notif.is_read) markAsRead(notif.id);
                          if (notif.document_id) {
                            navigate(`/documents/${notif.document_id}`);
                            setShowNotifications(false);
                          }
                        }}
                        data-testid={`notification-item-${notif.id}`}
                      >
                        <p className="text-sm font-medium text-slate-900">{notif.title}</p>
                        <p className="text-xs text-slate-600 mt-1">{notif.message}</p>
                        <p className="text-xs text-slate-400 mt-2">
                          {new Date(notif.created_at).toLocaleString('tr-TR')}
                        </p>
                      </div>
                    ))
                  )}
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
