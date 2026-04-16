import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import { Plus, Pencil, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PermissionGroups = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', permissions: [] });

  const permissionOptions = [
    { value: 'view_documents', label: 'Belge Görüntüleme' },
    { value: 'create_documents', label: 'Belge Oluşturma' },
    { value: 'edit_documents', label: 'Belge Düzenleme' },
    { value: 'delete_documents', label: 'Belge Silme' },
    { value: 'approve_documents', label: 'Belge Onaylama' },
    { value: 'route_documents', label: 'Belge Yönlendirme' }
  ];

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const { data } = await axios.get(`${API}/permission-groups`, { withCredentials: true });
      setGroups(data);
    } catch (error) {
      toast.error('Yetki grupları yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingGroup) {
        await axios.put(`${API}/permission-groups/${editingGroup.id}`, formData, { withCredentials: true });
        toast.success('Yetki grubu güncellendi');
      } else {
        await axios.post(`${API}/permission-groups`, formData, { withCredentials: true });
        toast.success('Yetki grubu oluşturuldu');
      }
      setShowModal(false);
      resetForm();
      fetchGroups();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Bir hata oluştu');
    }
  };

  const handleEdit = (group) => {
    setEditingGroup(group);
    setFormData({ name: group.name, description: group.description, permissions: group.permissions || [] });
    setShowModal(true);
  };

  const handleDelete = async (groupId) => {
    if (!window.confirm('Bu yetki grubunu silmek istediğinizden emin misiniz?')) return;
    try {
      await axios.delete(`${API}/permission-groups/${groupId}`, { withCredentials: true });
      toast.success('Yetki grubu silindi');
      fetchGroups();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Yetki grubu silinemedi');
    }
  };

  const resetForm = () => {
    setEditingGroup(null);
    setFormData({ name: '', description: '', permissions: [] });
  };

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
            <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Yetki Grupları</h1>
            <p className="text-sm text-slate-600 mt-1">Toplam {groups.length} grup</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            data-testid="add-group-button"
            className="bg-slate-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            <span>Grup Ekle</span>
          </button>
        </div>
        
        <div className="bg-white border border-slate-200 p-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-200" data-testid="groups-table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Grup Adı</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Açıklama</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Yetkiler</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors" data-testid={`group-row-${group.id}`}>
                    <td className="py-4 px-4 text-sm text-slate-900 font-medium">{group.name}</td>
                    <td className="py-4 px-4 text-sm text-slate-600">{group.description || '-'}</td>
                    <td className="py-4 px-4 text-sm text-slate-600">
                      <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium border bg-slate-100 text-slate-700 border-slate-300">
                        {group.permissions?.length || 0} yetki
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(group)}
                          data-testid={`edit-group-${group.id}`}
                          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          title="Düzenle"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(group.id)}
                          data-testid={`delete-group-${group.id}`}
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
        
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50" data-testid="group-modal">
            <div className="bg-white border border-slate-200 p-8 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-semibold text-slate-900 mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {editingGroup ? 'Grubu Düzenle' : 'Yeni Grup Ekle'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Grup Adı</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                    data-testid="input-group-name"
                    className="w-full border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white"
                    placeholder="ör: Muhasebe Ekibi"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    data-testid="input-group-description"
                    rows="2"
                    className="w-full border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white"
                    placeholder="Grup hakkında açıklama"
                  />
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
                          data-testid={`group-permission-${perm.value}`}
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
                    data-testid="submit-group-button"
                    className="flex-1 bg-slate-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors"
                  >
                    {editingGroup ? 'Güncelle' : 'Oluştur'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); resetForm(); }}
                    data-testid="cancel-group-button"
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

export default PermissionGroups;