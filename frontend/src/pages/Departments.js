import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import axios from 'axios';
import { Plus, Pencil, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Departments = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const { data } = await axios.get(`${API}/departments`, { withCredentials: true });
      setDepartments(data);
    } catch (error) {
      toast.error('Birimler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDept) {
        await axios.put(`${API}/departments/${editingDept.id}`, formData, { withCredentials: true });
        toast.success('Birim güncellendi');
      } else {
        await axios.post(`${API}/departments`, formData, { withCredentials: true });
        toast.success('Birim oluşturuldu');
      }
      setShowModal(false);
      resetForm();
      fetchDepartments();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Bir hata oluştu');
    }
  };

  const handleEdit = (dept) => {
    setEditingDept(dept);
    setFormData({ name: dept.name, description: dept.description });
    setShowModal(true);
  };

  const handleDelete = async (deptId) => {
    if (!window.confirm('Bu birimi silmek istediğinizden emin misiniz?')) return;
    try {
      await axios.delete(`${API}/departments/${deptId}`, { withCredentials: true });
      toast.success('Birim silindi');
      fetchDepartments();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Birim silinemedi');
    }
  };

  const resetForm = () => {
    setEditingDept(null);
    setFormData({ name: '', description: '' });
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
            <h1 className="text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Birim Yönetimi</h1>
            <p className="text-sm text-slate-600 mt-1">Toplam {departments.length} birim</p>
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            data-testid="add-department-button"
            className="bg-slate-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            <span>Birim Ekle</span>
          </button>
        </div>
        
        <div className="bg-white border border-slate-200 p-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-200" data-testid="departments-table">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Birim Adı</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Açıklama</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">Oluşturma Tarihi</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-4">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => (
                  <tr key={dept.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors" data-testid={`dept-row-${dept.id}`}>
                    <td className="py-4 px-4 text-sm text-slate-900 font-medium">{dept.name}</td>
                    <td className="py-4 px-4 text-sm text-slate-600">{dept.description || '-'}</td>
                    <td className="py-4 px-4 text-sm text-slate-600">
                      {new Date(dept.created_at).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(dept)}
                          data-testid={`edit-dept-${dept.id}`}
                          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          title="Düzenle"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(dept.id)}
                          data-testid={`delete-dept-${dept.id}`}
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
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50" data-testid="department-modal">
            <div className="bg-white border border-slate-200 p-8 w-full max-w-md">
              <h3 className="text-xl font-semibold text-slate-900 mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {editingDept ? 'Birimi Düzenle' : 'Yeni Birim Ekle'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Birim Adı</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                    data-testid="input-dept-name"
                    className="w-full border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white"
                    placeholder="ör: IT, Pazarlama"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Açıklama</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    data-testid="input-dept-description"
                    rows="3"
                    className="w-full border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white"
                    placeholder="Birim hakkında açıklama"
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    data-testid="submit-dept-button"
                    className="flex-1 bg-slate-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-slate-800 transition-colors"
                  >
                    {editingDept ? 'Güncelle' : 'Oluştur'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); resetForm(); }}
                    data-testid="cancel-dept-button"
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

export default Departments;