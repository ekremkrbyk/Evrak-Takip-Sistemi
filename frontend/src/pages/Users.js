import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import { UserPlus, Pencil, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Users = () => {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [permissionGroups, setPermissionGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    department: '',
    role: 'user',
    permissions: [],
    permission_group_id: '',
    is_manager: false
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, deptsRes, groupsRes] = await Promise.all([
        axios.get(`${API}/users`, { withCredentials: true }),
        axios.get(`${API}/departments`, { withCredentials: true }),
        axios.get(`${API}/permission-groups`, { withCredentials: true })
      ]);
      setUsers(usersRes.data);
      setDepartments(deptsRes.data);
      setPermissionGroups(groupsRes.data);
    } catch (error) {
      toast.error('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await axios.put(`${API}/users/${editingUser.id}`, {
          full_name: formData.full_name,
          department: formData.department,
          role: formData.role,
          permissions: formData.permissions,
          permission_group_id: formData.permission_group_id,
          is_manager: formData.is_manager
        }, { withCredentials: true });
        toast.success('Kullanıcı güncellendi');
      } else {
        await axios.post(`${API}/users`, formData, { withCredentials: true });
        toast.success('Kullanıcı oluşturuldu');
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Bir hata oluştu');
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      full_name: user.full_name,
      department: user.department,
      role: user.role,
      permissions: user.permissions || [],
      permission_group_id: user.permission_group_id || '',
      is_manager: !!user.is_manager
    });
    setShowModal(true);
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) return;
    try {
      await axios.delete(`${API}/users/${userId}`, { withCredentials: true });
      toast.success('Kullanıcı silindi');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Kullanıcı silinemedi');
    }
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      full_name: '',
      department: departments[0]?.name || '',
      role: 'user',
      permissions: [],
      permission_group_id: '',
      is_manager: false
    });
  };

  const permissionOptions = [
    { value: 'view_documents', label: 'Belge Görüntüleme' },
    { value: 'create_documents', label: 'Belge Oluşturma' },
    { value: 'edit_documents', label: 'Belge Düzenleme' },
    { value: 'delete_documents', label: 'Belge Silme' },
    { value: 'approve_documents', label: 'Belge Onaylama' },
    { value: 'route_documents', label: 'Belge Yönlendirme' }
  ];

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Kullanıcı Yönetimi</h1>
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
        
        <div className="bg-white border border-slate-200 p-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-200" data-testid="users-table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Ad Soyad</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">E-posta</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Birim</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Rol</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Kayıt Tarihi</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors" data-testid={`user-row-${user.id}`}>
                    <td className="py-4 px-4 text-sm text-slate-900">{user.full_name}</td>
                    <td className="py-4 px-4 text-sm text-slate-600">{user.email}</td>
                    <td className="py-4 px-4 text-sm text-slate-600">{user.department}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium border ${
                          user.role === 'admin' 
                            ? 'bg-slate-900 text-white border-slate-900' 
                            : 'bg-slate-100 text-slate-700 border-slate-300'
                        }`}>
                          {user.role === 'admin' ? 'Admin' : 'Kullanıcı'}
                        </span>
                        {user.is_manager && (
                          <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium border bg-amber-50 text-amber-700 border-amber-300" data-testid={`manager-badge-${user.id}`}>Yönetici</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-600">
                      {new Date(user.created_at).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          data-testid={`edit-user-${user.id}`}
                          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          title="Düzenle"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          data-testid={`delete-user-${user.id}`}
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Sil"
                        >
                          <Trash size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* User Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50" data-testid="user-modal">
            <div className="bg-white border border-slate-200 p-8 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-semibold text-slate-900 mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {editingUser ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı Ekle'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ad Soyad</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    required
                    data-testid="input-user-fullname"
                    className="w-full border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white"
                  />
                </div>
                
                {!editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">E-posta</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      required
                      data-testid="input-user-email"
                      className="w-full border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white"
                    />
                  </div>
                )}
                
                {!editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Şifre</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      required
                      data-testid="input-user-password"
                      className="w-full border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white"
                    />
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Birim</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    required
                    data-testid="select-user-department"
                    className="w-full border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white"
                  >
                    <option value="">Birim seçin</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.name}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Yetki Grubu (Opsiyonel)</label>
                  <select
                    value={formData.permission_group_id}
                    onChange={(e) => setFormData({...formData, permission_group_id: e.target.value})}
                    data-testid="select-user-permission-group"
                    className="w-full border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white"
                  >
                    <option value="">Yetki grubu seçmeyin (manuel yetki)</option>
                    {permissionGroups.map(group => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">Yetki grubu seçilirse, aşağıdaki manuel yetkiler göz ardı edilir</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    required
                    data-testid="select-user-role"
                    className="w-full border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white"
                  >
                    <option value="user">Kullanıcı</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200">
                  <input
                    type="checkbox"
                    id="is_manager"
                    checked={formData.is_manager}
                    onChange={(e) => setFormData({...formData, is_manager: e.target.checked})}
                    data-testid="checkbox-is-manager"
                    className="w-4 h-4"
                  />
                  <label htmlFor="is_manager" className="text-sm text-slate-700 cursor-pointer">
                    <span className="font-medium">Birim Yöneticisi</span>
                    <span className="text-xs text-slate-500 ml-2">(Bu birimdeki belgeleri onaylayabilir, damga basabilir)</span>
                  </label>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Yetkiler</label>
                  <div className="space-y-2">
                    {permissionOptions.map(perm => (
                      <label key={perm.value} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(perm.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({...formData, permissions: [...formData.permissions, perm.value]});
                            } else {
                              setFormData({...formData, permissions: formData.permissions.filter(p => p !== perm.value)});
                            }
                          }}
                          data-testid={`permission-${perm.value}`}
                          className="w-4 h-4 border-slate-300 text-slate-900 focus:ring-slate-900"
                        />
                        <span className="text-sm text-slate-700">{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    data-testid="submit-user-button"
                    className="flex-1 bg-slate-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors"
                  >
                    {editingUser ? 'Güncelle' : 'Oluştur'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); resetForm(); }}
                    data-testid="cancel-user-button"
                    className="flex-1 bg-white text-slate-900 border border-slate-200 px-6 py-2.5 text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
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

export default Users;
