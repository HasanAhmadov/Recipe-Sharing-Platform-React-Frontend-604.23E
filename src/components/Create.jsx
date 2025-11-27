import React, { useState } from 'react';
import { Home, PlusSquare, User, LogOut, ArrowLeft, Upload, Image } from 'lucide-react';
import { useAuth } from './AuthContext';
import './Create.css';

const Create = () => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const { user, logout } = useAuth();

  const API_BASE = 'https://rsp-api.up.railway.app';

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedImage) {
      setError('Zəhmət olmasa şəkil seçin');
      return;
    }

    if (!title.trim()) {
      setError('Zəhmət olmasa başlıq daxil edin');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      formData.append('Title', title);
      formData.append('Image', selectedImage);

      const response = await fetch(`${API_BASE}/api/Receipts/UploadReceipt`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 401) {
          handleLogout();
          throw new Error('Token etibarsızdır');
        }
        throw new Error('Upload failed');
      }

      const result = await response.json();
      setSuccess('Resept uğurla yükləndi!');
      setTitle('');
      setSelectedImage(null);
      setImagePreview(null);
      
      const fileInput = document.getElementById('image-upload');
      if (fileInput) fileInput.value = '';

      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);

    } catch (err) {
      setError('Yükləmə zamanı xəta baş verdi: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTitle('');
    setSelectedImage(null);
    setImagePreview(null);
    setError(null);
    setSuccess(null);
    
    const fileInput = document.getElementById('image-upload');
    if (fileInput) fileInput.value = '';
  };

  const handleLogout = () => {
    const confirmed = window.confirm('Çıxmaq istədiyinizə əminsiniz?');
    if (confirmed) {
      logout();
      window.location.href = '/login';
    }
  };

  const goToDashboard = () => {
    window.location.href = '/dashboard';
  };

  const goToProfile = () => {
    localStorage.setItem('forceProfileView', '1');
    window.location.href = '/dashboard';
  };

  if (!user) {
    return (
      <div className="error-container">
        <div className="error-message">
          <h2>Giriş tələb olunur</h2>
          <p>Zəhmət olmasa yenidən daxil olun</p>
          <button onClick={() => window.location.href = '/login'} className="login-btn">
            Daxil ol
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="create-container">
      <div className="sidebar">
        <div className="logo-section">
          <img
            src="/logo-metbexim.png"
            alt="Mətbəxim Logo"
            className="logo-image"
          />
        </div>
        
        <nav className="nav-menu">
          <button className="nav-item" onClick={goToDashboard}>
            <Home size={24} />
            <span>Ana səhifə</span>
          </button>
          
          <button className="nav-item active">
            <PlusSquare size={24} />
            <span>Yarat</span>
          </button>
          
          <button className="nav-item" onClick={goToProfile}>
            <User size={24} />
            <span>Profil</span>
          </button>
          
          <button className="nav-item logout-btn" onClick={handleLogout}>
            <LogOut size={24} />
            <span>Çıxış et</span>
          </button>
        </nav>
      </div>

      <div className="create-content">
        <div className="create-header">
          <h1>Yeni resept yarat</h1>
        </div>

        <div className="create-form-container">
          <form className="create-form" onSubmit={handleSubmit}>
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {success && (
              <div className="success-message">
                {success}
              </div>
            )}

            <div className="form-section">
              <h2>Resept</h2>
              <div className="input-group">
                <label htmlFor="title">Başlıq</label>
                <input
                  id="title"
                  type="text"
                  placeholder="Reseptin başlığını daxil edin"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={1000}
                  disabled={loading}
                />
                <span className="char-count">{title.length}/1000</span>
              </div>
            </div>

            <div className="form-section">
              <h2>Şəkil</h2>
              <div className="image-upload-section">
                {imagePreview ? (
                  <div className="image-preview">
                    <img src={imagePreview} alt="Preview" />
                    <button 
                      type="button" 
                      className="change-image-btn"
                      onClick={() => document.getElementById('image-upload').click()}
                      disabled={loading}
                    >
                      Şəkli dəyiş
                    </button>
                  </div>
                ) : (
                  <div className="upload-placeholder">
                    <Image size={48} className="upload-icon" />
                    <p>Yükləyəcəyiniz şəkli seçin</p>
                    <label htmlFor="image-upload" className="upload-button">
                      <Upload size={16} />
                      Şəkil Seç
                    </label>
                  </div>
                )}
                
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-actions">
              <button 
                type="button" 
                className="cancel-btn"
                onClick={handleReset}
                disabled={loading}
              >
                Təmizlə
              </button>
              <button 
                type="submit" 
                className="submit-btn"
                disabled={loading || !selectedImage || !title.trim()}
              >
                {loading ? 'Yüklənir...' : 'Yüklə'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Create;