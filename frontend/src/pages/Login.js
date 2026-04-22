import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SignIn, UserPlus } from '@phosphor-icons/react';

const Login = () => {
  const navigate = useNavigate();
  const { login, register, user } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('MUHASEBE');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (user && user !== false) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (isLogin) {
      const result = await login(email, password);
      if (result.success) {
        navigate('/');
      } else {
        setError(result.error);
      }
    } else {
      const result = await register(email, password, fullName, department);
      if (result.success) {
        navigate('/');
      } else {
        setError(result.error);
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Image */}
      <div 
        className="hidden lg:flex lg:w-1/2 bg-cover bg-center relative"
        style={{ backgroundImage: 'url(https://static.prod-images.emergentagent.com/jobs/f8d6562d-9bc6-42cd-90f8-cdabe55c7535/images/b7d5730305d10eae83f2d04934b1c6537c6af8fe8b448e4b271ccbb97b4f4bf2.png)' }}
      >
        <div className="absolute inset-0 bg-slate-900/60"></div>
        <div className="relative z-10 flex flex-col justify-center p-12 text-white">
          <h1 className="text-4xl font-semibold mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>Evrak Takip Sistemi</h1>
          <p className="text-lg text-slate-200" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
            Belgelerinizi hızlı, güvenli ve verimli bir şekilde yönetin.
          </p>
        </div>
      </div>
      
      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="bg-white border border-slate-200 p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {isLogin ? 'Giriş Yap' : 'Kayıt Ol'}
              </h2>
              <p className="text-sm text-slate-600" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                {isLogin ? 'Hesabınıza giriş yapın' : 'Yeni hesap oluşturun'}
              </p>
            </div>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm" data-testid="error-message">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                    Ad Soyad
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    data-testid="input-fullname"
                    className="w-full border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white"
                    placeholder="Adınızı girin"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                  E-posta
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="input-email"
                  className="w-full border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white"
                  placeholder="email@ornek.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                  Şifre
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="input-password"
                  className="w-full border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none transition-all bg-white"
                  placeholder="Şifrenizi girin"
                />
              </div>
              
              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                    Birim
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    required
                    data-testid="select-department"
                    className="w-full border border-slate-200 px-4 py-2 text-sm focus:border-slate-900 focus:ring-1 focus:ring-slate-900 outline-none bg-white"
                  >
                    <option value="MUHASEBE">MUHASEBE</option>
                    <option value="IHRACAT">IHRACAT</option>
                    <option value="URETIM_OPERASYON">URETIM & OPERASYON</option>
                    <option value="YONETIM">YONETIM</option>
                  </select>
                </div>
              )}
              
              <button
                type="submit"
                disabled={loading}
                data-testid="submit-button"
                className="w-full bg-slate-900 text-white px-6 py-2.5 text-sm font-medium hover:bg-slate-800 focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLogin ? <SignIn size={20} /> : <UserPlus size={20} />}
                <span>{loading ? 'Lütfen bekleyin...' : isLogin ? 'Giriş Yap' : 'Kayıt Ol'}</span>
              </button>
            </form>
            
            <div className="mt-6 text-center">
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                data-testid="toggle-mode-button"
                className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
              >
                {isLogin ? 'Hesabınız yok mu? Kayıt olun' : 'Zaten hesabınız var mı? Giriş yapın'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
