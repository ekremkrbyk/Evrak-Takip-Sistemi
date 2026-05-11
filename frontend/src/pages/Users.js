import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import { UserPlus, Pencil, Trash, Key, Eye, EyeSlash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const permissionOptions = [
  { value: 'view_documents',   label: 'Belge Görüntüleme' },
  { value: 'create_documents', label: 'Belge Oluşturma' },
  { value: 'edit_documents',   label: 'Belge Düzenleme' },
  { value: 'delete_documents', label: 'Belge Silme' },
  { value: 'approve_documents',label: 'Belge Onaylama' },
  { value: 'route_documents',  label: 'Belge Yönlendirme' },
];

const emptyForm = {
  email: '', password: '', full_name: '', department: '',
  role: 'user', permissions: [], permission_group_id: '',
  is_manager: false, can_manage_vendors: false,
};

const Users = () => {
  const { user: me } = useAuth();
  const isSuperAdmin = me?.role === 'superadmin';

  const [users,            setUsers]            = useState([]);
  const [departments,      setDepartments]      = useState([]);
  const [permissionGroups, setPermissionGroups] = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [showModal,        setShowModal]        = useState(false);
  const [editingUser,      setEditingUser]      = useState(null);
  const [formData,         setFormData]         = useState(emptyForm);

  // Şifre değiştirme modal
  const [pwModal,   setPwModal]   = useState(null); // { id, name }
  const [pwNew,     setPwNew]     = useState('');
  const [pwShow,    setPwShow]    = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [usersRes, deptsRes, groupsRes] = await Promise.all([
        axios.get(`${API}/users`,             { withCredentials: true }),
        axios.get(`${API}/departments`,        { withCredentials: true }),
        axios.get(`${API}/permission-groups`,  { withCredentials: true }),
      ]);
      setUsers(usersRes.data);
      setDepartments(deptsRes.data);
      setPermissionGroups(groupsRes.data);
    } catch {
      toast.error('Veriler yüklenirken hata oluştu');
    } finally { setLoading(false); }
  };

  // ── CRUD ──────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await axios.put(`${API}/users/${editingUser.id}`, {
          full_name:          formData.full_name,
          department:         formData.department,
          role:               formData.role,
          permissions:        formData.permissions,
          permission_group_id:formData.permission_group_id,
          is_manager:         formData.is_manager,
          can_manage_vendors: formData.can_manage_vendors,
        }, { withCredentials: true });
        toast.success('Kullanıcı güncellendi');
      } else {
        await axios.post(`${API}/users`, formData, { withCredentials: true });
        toast.success('Kullanıcı oluşturuldu');
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Bir hata oluştu');
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      email:              user.email,
      password:           '',
      full_name:          user.full_name,
      department:         user.department,
      role:               user.role,
      permissions:        user.permissions || [],
      permission_group_id:user.permission_group_id || '',
      is_manager:         !!user.is_manager,
      can_manage_vendors: !!user.can_manage_vendors,
    });
    setShowModal(true);
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) return;
    try {
      await axios.delete(`${API}/users/${userId}`, { withCredentials: true });
      toast.success('Kullanıcı silindi');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Kullanıcı silinemedi');
    }
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormData({ ...emptyForm, department: departments[0]?.name || '' });
  };

  // ── Şifre Değiştir ────────────────────────────────────────
  const handleChangePassword = async () => {
    if (pwNew.length < 8) { toast.error('Şifre en az 8 karakter olmalı'); return; }
    setPwLoading(true);
    try {
      const { data } = await axios.post(`${API}/auth/change-password`,
        { target_user_id: pwModal.id, new_password: pwNew },
        { withCredentials: true }
      );
      toast.success(data.message || 'Şifre değiştirildi');
      setPwModal(null); setPwNew(''); setPwShow(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Şifre değiştirilemedi');
    } finally { setPwLoading(false); }
  };

  // ── Patron belge modu toggle ──────────────────────────────
  const handlePatronToggle = async (userId, currentVal) => {
    try {
      await axios.put(`${API}/users/${userId}`,
        { view_all_documents: !currentVal },
        { withCredentials: true }
      );
      toast.success(!currentVal ? 'Tüm belgeler modu açıldı' : 'Sadece ilgili belgeler modu açıldı');
      fetchData();
    } catch (err) {
      toast.error('Güncelleme başarısız');
    }
  };

  // ── Rol badge ────────────────────────────────────────────
  const roleBadge = (user) => {
    if (user.role === 'superadmin')
      return <span className="inline-flex px-2.5 py-0.5 text-xs font-semibold border bg-purple-900 text-white border-purple-900">Patron</span>;
    if (user.role === 'admin')
      return <span className="inline-flex px-2.5 py-0.5 text-xs font-semibold border bg-slate-900 text-white border-slate-900">Admin</span>;
    return <span className="inline-flex px-2.5 py-0.5 text-xs font-medium border bg-slate-100 text-slate-700 border-slate-300">Kullanıcı</span>;
  };

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Kullanıcı Yönetimi
            </h1>
            <p className="text-sm text-slate-600 mt-1">Toplam {users.length} kullanıcı</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            data-testid="add-user-button"
            className="bg-slate-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            <UserPlus size={20} />
            <span>Kullanıcı Ekle</span>
          </button>
        </div>

        <div className="bg-white border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="users-table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Ad Soyad</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">E-posta</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Birim</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Rol / Yetki</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Kayıt</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors" data-testid={`user-row-${user.id}`}>
                    <td className="py-4 px-4 text-sm text-slate-900 font-medium">{user.full_name}</td>
                    <td className="py-4 px-4 text-sm text-slate-600">{user.email}</td>
                    <td className="py-4 px-4 text-sm text-slate-600">{user.department}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1 flex-wrap">
                        {roleBadge(user)}
                        {user.is_manager && (
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium border bg-amber-50 text-amber-700 border-amber-300" data-testid={`manager-badge-${user.id}`}>Yönetici</span>
                        )}
                        {user.can_manage_vendors && (
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium border bg-blue-50 text-blue-700 border-blue-300">Cari Yön.</span>
                        )}
                        {/* Patron belge modu toggle */}
                        {user.role === 'superadmin' && isSuperAdmin && (
                          <button
                            onClick={() => handlePatronToggle(user.id, user.view_all_documents !== false)}
                            className={`inline-flex px-2 py-0.5 text-xs font-medium border transition-colors ${
                              user.view_all_documents !== false
                                ? 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100'
                                : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                            }`}
                            title="Tıkla: Tüm Belgeler / Sadece İlgili"
                          >
                            {user.view_all_documents !== false ? '📋 Tüm Belgeler' : '📌 Sadece İlgili'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-500">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString('tr-TR') : '—'}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(user)}
                          data-testid={`edit-user-${user.id}`}
                          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          title="Düzenle"
                        ><Pencil size={17} /></button>
                        <button
                          onClick={() => { setPwModal({ id: user.id, name: user.full_name }); setPwNew(''); setPwShow(false); }}
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Şifre Değiştir"
                        ><Key size={17} /></button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          data-testid={`delete-user-${user.id}`}
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Sil"
                        ><Trash size={17} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Kullanıcı Ekle/Düzenle Modal ── */}
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" data-testid="user-modal">
            <div className="bg-white border border-slate-200 p-8 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-semibold text-slate-900 mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {editingUser ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı Ekle'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ad Soyad</label>
                  <input type="text" value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required data-testid="input-user-fullname"
                    className="w-full border border-slate-200 px-4 py-2 text-sm outline-none focus:border-slate-900 bg-white" />
                </div>

                {!editingUser && (<>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">E-posta</label>
                    <input type="email" value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required data-testid="input-user-email"
                      className="w-full border border-slate-200 px-4 py-2 text-sm outline-none focus:border-slate-900 bg-white" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Şifre</label>
                    <input type="password" value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required data-testid="input-user-password"
                      className="w-full border border-slate-200 px-4 py-2 text-sm outline-none focus:border-slate-900 bg-white" />
                  </div>
                </>)}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Birim</label>
                  <select value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    required data-testid="select-user-department"
                    className="w-full border border-slate-200 px-4 py-2 text-sm outline-none focus:border-slate-900 bg-white">
                    <option value="">Birim seçin</option>
                    {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Yetki Grubu (Opsiyonel)</label>
                  <select value={formData.permission_group_id}
                    onChange={(e) => setFormData({ ...formData, permission_group_id: e.target.value })}
                    data-testid="select-user-permission-group"
                    className="w-full border border-slate-200 px-4 py-2 text-sm outline-none focus:border-slate-900 bg-white">
                    <option value="">Manuel yetki kullan</option>
                    {permissionGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Yetki grubu seçilirse manuel yetkiler göz ardı edilir</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                  <select value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    required data-testid="select-user-role"
                    className="w-full border border-slate-200 px-4 py-2 text-sm outline-none focus:border-slate-900 bg-white">
                    <option value="user">Kullanıcı</option>
                    <option value="admin">Admin</option>
                    {/* Superadmin seçeneği SADECE oturumdaki kullanıcı patron ise görünür */}
                    {isSuperAdmin && <option value="superadmin">Patron (Süper Admin)</option>}
                  </select>
                </div>

                {/* Birim Yöneticisi */}
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100">
                  <input type="checkbox" id="is_manager" checked={formData.is_manager}
                    onChange={(e) => setFormData({ ...formData, is_manager: e.target.checked })}
                    data-testid="checkbox-is-manager" className="w-4 h-4 mt-0.5" />
                  <label htmlFor="is_manager" className="text-sm text-slate-700 cursor-pointer">
                    <span className="font-medium">Birim Yöneticisi</span>
                    <span className="text-xs text-slate-500 block">Belgeleri onaylayabilir, damga basabilir</span>
                  </label>
                </div>

                {/* Cari Yönetimi */}
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100">
                  <input type="checkbox" id="can_manage_vendors" checked={formData.can_manage_vendors}
                    onChange={(e) => setFormData({ ...formData, can_manage_vendors: e.target.checked })}
                    className="w-4 h-4 mt-0.5" />
                  <label htmlFor="can_manage_vendors" className="text-sm text-slate-700 cursor-pointer">
                    <span className="font-medium">Cari Hesap Yönetimi</span>
                    <span className="text-xs text-slate-500 block">Cari sayfasına erişebilir ve düzenleyebilir</span>
                  </label>
                </div>

                {/* Manuel yetkiler */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Manuel Yetkiler</label>
                  <div className="space-y-2">
                    {permissionOptions.map(perm => (
                      <label key={perm.value} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox"
                          checked={formData.permissions.includes(perm.value)}
                          onChange={(e) => {
                            const perms = e.target.checked
                              ? [...formData.permissions, perm.value]
                              : formData.permissions.filter(p => p !== perm.value);
                            setFormData({ ...formData, permissions: perms });
                          }}
                          data-testid={`permission-${perm.value}`}
                          className="w-4 h-4" />
                        <span className="text-sm text-slate-700">{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="submit" data-testid="submit-user-button"
                    className="flex-1 bg-slate-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors">
                    {editingUser ? 'Güncelle' : 'Oluştur'}
                  </button>
                  <button type="button" onClick={() => { setShowModal(false); resetForm(); }}
                    data-testid="cancel-user-button"
                    className="flex-1 bg-white text-slate-900 border border-slate-200 px-6 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors">
                    İptal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Şifre Değiştir Modal ── */}
        {pwModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-slate-200 p-8 w-full max-w-sm">
              <h3 className="text-lg font-semibold text-slate-900 mb-1">Şifre Değiştir</h3>
              <p className="text-sm text-slate-500 mb-6">{pwModal.name}</p>
              <div className="relative mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Yeni Şifre</label>
                <input
                  type={pwShow ? 'text' : 'password'}
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  placeholder="En az 8 karakter"
                  className="w-full border border-slate-200 px-4 py-2 pr-10 text-sm outline-none focus:border-slate-900 bg-white"
                />
                <button type="button" onClick={() => setPwShow(v => !v)}
                  className="absolute right-3 top-8 text-slate-400 hover:text-slate-700">
                  {pwShow ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="flex gap-3">
                <button onClick={handleChangePassword} disabled={pwLoading}
                  className="flex-1 bg-slate-900 text-white py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50">
                  {pwLoading ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
                <button onClick={() => { setPwModal(null); setPwNew(''); }}
                  className="flex-1 border border-slate-200 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors">
                  İptal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Users;
