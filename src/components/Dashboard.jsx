import React, { useState, useEffect } from 'react';
import { Search, Heart, Share2, Home, PlusSquare, User, LogOut } from 'lucide-react';
import { useAuth } from './AuthContext';
import './Dashboard.css';

const Dashboard = () => {
  const [posts, setPosts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('feed'); // 'feed' | 'profile'
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [userLoading, setUserLoading] = useState(false);
  const { user, logout } = useAuth();

  const API_BASE = 'https://rsp-api.up.railway.app';

  // Fetch all receipts on initial load
  useEffect(() => {
    if (user) {
      fetchAllReceipts();
    }
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'profile' && user && viewMode !== 'profile') {
      fetchCurrentUserProfile();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const flag = localStorage.getItem('forceProfileView');
      if (flag === '1') {
        localStorage.removeItem('forceProfileView');
        fetchCurrentUserProfile();
      }
    }
  }, [user]);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${user?.token}`,
    'Content-Type': 'application/json',
  });

  const fetchAllReceipts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/Receipts/GetAllReceipts`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          handleLogout();
          throw new Error('Token etibarsızdır');
        }
        throw new Error('Failed to fetch receipts');
      }

      const data = await response.json();
      setPosts(data);
      setError(null);
    } catch (err) {
      setError('Reseptlər yüklənərkən xəta baş verdi: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      fetchAllReceipts();
      return;
    }
    try {
      setSearchLoading(true);
      const response = await fetch(
        `${API_BASE}/api/Search/SearchReceipts?q=${encodeURIComponent(searchQuery)}`,
        { method: 'GET', headers: getAuthHeaders() }
      );

      if (!response.ok) {
        if (response.status === 401) {
          handleLogout();
          throw new Error('Token etibarsızdır');
        }
        throw new Error('Search failed');
      }

      const data = await response.json();
      setPosts(data);
      setError(null);
    } catch (err) {
      setError('Axtarış zamanı xəta baş verdi: ' + err.message);
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleLike = async (postId) => {
    if (!user) {
      setError('Zəhmət olmasa yenidən daxil olun');
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/Receipts/${postId}/like`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          handleLogout();
          throw new Error('Token etibarsızdır');
        }
        throw new Error('Like failed');
      }

      // Update feed posts
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                likedByUser: !p.likedByUser,
                count: p.likedByUser ? (p.count || p.likesCount || 1) - 1 : (p.count || p.likesCount || 0) + 1,
                likesCount: p.likedByUser
                  ? (p.likesCount || p.count || 1) - 1
                  : (p.likesCount || p.count || 0) + 1,
              }
            : p
        )
      );

      // Update profile posts if viewing profile
      setUserPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                likedByUser: !p.likedByUser,
                count: p.likedByUser ? (p.count || 1) - 1 : (p.count || 0) + 1,
              }
            : p
        )
      );
    } catch (err) {
      console.error('Like error:', err);
      setError('Bəyənmə zamanı xəta baş verdi');
    }
  };

  const handleUserClick = async (userId) => {
    try {
      setUserLoading(true);
      setViewMode('profile');

      const userResponse = await fetch(`${API_BASE}/api/User/GetUserById/${userId}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      if (!userResponse.ok) {
        if (userResponse.status === 401) {
          handleLogout();
          throw new Error('Token etibarsızdır');
        }
        throw new Error('Failed to fetch user');
      }
      const userData = await userResponse.json();
      setSelectedUser(userData);

      const receiptsResponse = await fetch(
        `${API_BASE}/api/Receipts/GetReceiptsByUserId/${userId}`,
        { method: 'GET', headers: getAuthHeaders() }
      );
      if (!receiptsResponse.ok) {
        if (receiptsResponse.status === 401) {
          handleLogout();
          throw new Error('Token etibarsızdır');
        }
        throw new Error('Failed to fetch user receipts');
      }
      const receiptsData = await receiptsResponse.json();
      setUserPosts(receiptsData);
      setError(null);
    } catch (err) {
      setError('İstifadəçi məlumatları yüklənərkən xəta: ' + err.message);
      console.error(err);
    } finally {
      setUserLoading(false);
    }
  };

  const fetchCurrentUserProfile = async () => {
    try {
      setUserLoading(true);
      setViewMode('profile');

      // Get user from session
      const sessionResponse = await fetch(`${API_BASE}/api/User/GetUserFromSession`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      
      if (!sessionResponse.ok) {
        if (sessionResponse.status === 401) {
          handleLogout();
          throw new Error('Token etibarsızdır');
        }
        throw new Error('Failed to fetch session user');
      }
      
      const sessionUser = await sessionResponse.json();
      
      // Get full user details
      const userResponse = await fetch(`${API_BASE}/api/User/GetUserById/${sessionUser.id}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!userResponse.ok) {
        if (userResponse.status === 401) {
          handleLogout();
          throw new Error('Token etibarsızdır');
        }
        throw new Error('Failed to fetch user details');
      }

      const userData = await userResponse.json();
      setSelectedUser(userData);

      // Get user's receipts
      const receiptsResponse = await fetch(
        `${API_BASE}/api/Receipts/GetReceiptsByUserId/${userData.id}`,
        { method: 'GET', headers: getAuthHeaders() }
      );

      if (!receiptsResponse.ok) {
        if (receiptsResponse.status === 401) {
          handleLogout();
          throw new Error('Token etibarsızdır');
        }
        throw new Error('Failed to fetch user receipts');
      }

      const receiptsData = await receiptsResponse.json();
      setUserPosts(receiptsData);
      setError(null);
    } catch (err) {
      setError('Profil yüklənərkən xəta: ' + err.message);
      console.error(err);
    } finally {
      setUserLoading(false);
    }
  };

  const handleBackToFeed = () => {
    setViewMode('feed');
    setSelectedUser(null);
    setUserPosts([]);
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 0 || isNaN(diff)) return 'yeni';
    if (diff < 10) return 'yeni';
    if (diff < 60) return `${diff}s`;
    const minutes = Math.floor(diff / 60);
    if (minutes < 60) return `${minutes}dəq`;
    const hours = Math.floor(diff / 3600);
    if (hours < 24) return `${hours}saat`;
    const days = Math.floor(diff / 86400);
    if (days < 7) return `${days}gün`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}həftə`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}ay`;
    const years = Math.floor(days / 365);
    return `${years}il`;
  };

  if (!user) {
    return (
      <div className="dashboard">
        <div className="error-container">
          <div className="error-message">
            <h2>Giriş tələb olunur</h2>
            <p>Zəhmət olmasa yenidən daxil olun</p>
            <button onClick={() => (window.location.href = '/login')} className="login-btn">
              Daxil ol
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="sidebar">
        <div className="logo-section">
          <img src="/logo-metbexim.png" alt="Mətbəxim Logo" className="logo-image" />
        </div>
        <nav className="nav-menu">
          <button
            className={`nav-item ${viewMode === 'feed' ? 'active' : ''}`}
            onClick={handleBackToFeed}
          >
            <Home size={24} />
            <span>Ana səhifə</span>
          </button>
          <button className="nav-item" onClick={() => (window.location.href = '/create')}>
            <PlusSquare size={24} />
            <span>Yarat</span>
          </button>
          <button
            className="nav-item"
            onClick={fetchCurrentUserProfile}
          >
            <User size={24} />
            <span>Profil</span>
          </button>
          <button className="nav-item logout-btn" onClick={handleLogout}>
            <LogOut size={24} />
            <span>Çıxış et</span>
          </button>
        </nav>
      </div>

      <div className="main-content">
        {viewMode === 'profile' ? (
          <div className="profile-view">
            <div className="profile-header">
              <button className="back-button" onClick={handleBackToFeed}>
                <span>Geri</span>
              </button>
              <div className="profile-avatar">
                <User size={64} />
              </div>
              <div className="profile-info">
                <h2 className="profile-username">{selectedUser?.username}</h2>
                <p className="profile-name">{selectedUser?.name}</p>
                <p className="profile-recipe-count">{userPosts.length} resept</p>
              </div>
            </div>

            <div className="profile-posts">
              {userLoading ? (
                <div className="loading">Yüklənir...</div>
              ) : userPosts.length === 0 ? (
                <div className="no-results">Bu istifadəçinin heç bir resepti yoxdur</div>
              ) : (
                <div className="feed">
                  {userPosts.map((post) => (
                    <div key={post.id} className="post-card">
                      <div className="post-header">
                        <div className="user-info">
                          <div className="avatar">
                            <User size={20} />
                          </div>
                          <span className="username">{selectedUser.username}</span>
                          <span className="post-time">• {formatDate(post.createdAt)}</span>
                        </div>
                      </div>
                      <div className="post-image">
                        <img
                          src={
                            post.imageUrl?.startsWith('http')
                              ? post.imageUrl
                              : `${API_BASE}${post.imageUrl}`
                          }
                          alt={post.title}
                          onError={(e) => {
                            e.target.src = 'https://via.placeholder.com/600x400?text=Resept';
                          }}
                        />
                      </div>
                      <div className="post-actions">
                        <button
                          className={`action-btn ${post.likedByUser ? 'liked' : ''}`}
                          onClick={() => handleLike(post.id)}
                          disabled={!user}
                        >
                          <Heart
                            size={24}
                            fill={post.likedByUser ? 'currentColor' : 'none'}
                          />
                        </button>
                        <button className="action-btn">
                          <Share2 size={24} />
                        </button>
                        <span className="likes-count">{post.count || 0} bəyənmə</span>
                      </div>
                      <div className="post-caption">
                        <span className="caption-username">{selectedUser.username}</span>{' '}
                        {post.title}
                      </div>
                      {post.description && (
                        <div className="post-description">{post.description}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="search-bar">
              <form onSubmit={handleSearch}>
                <Search size={20} className="search-icon" />
                <input
                  type="text"
                  placeholder="Axtar"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={!user}
                />
                {searchLoading && <span className="loading-text">Axtarılır...</span>}
              </form>
            </div>
            <div className="feed">
              {loading ? (
                <div className="loading">Yüklənir...</div>
              ) : error ? (
                <div className="error">
                  {error}
                  <button onClick={fetchAllReceipts} className="retry-btn">
                    Yenidən yoxla
                  </button>
                </div>
              ) : posts.length === 0 ? (
                <div className="no-results">Heç bir resept tapılmadı</div>
              ) : (
                posts.map((post) => (
                  <div key={post.id} className="post-card">
                    <div className="post-header">
                      <div className="user-info">
                        <div
                          className="avatar clickable"
                          onClick={() => handleUserClick(post.userId)}
                        >
                          <User size={20} />
                        </div>
                        <span
                          className="username clickable"
                          onClick={() => handleUserClick(post.userId)}
                        >
                          {post.username || post.userName || 'İstifadəçi'}
                        </span>
                        <span className="post-time">• {formatDate(post.createdAt)}</span>
                      </div>
                    </div>
                    <div className="post-image">
                      <img
                        src={
                          post.imageUrl?.startsWith('http')
                            ? post.imageUrl
                            : `${API_BASE}${post.imageUrl}`
                        }
                        alt={post.title}
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/600x400?text=Resept';
                        }}
                      />
                    </div>
                    <div className="post-actions">
                      <button
                        className={`action-btn ${post.likedByUser ? 'liked' : ''}`}
                        onClick={() => handleLike(post.id)}
                        disabled={!user}
                      >
                        <Heart
                          size={24}
                          fill={post.likedByUser ? 'currentColor' : 'none'}
                        />
                      </button>
                      <button className="action-btn">
                        <Share2 size={24} />
                      </button>
                      <span className="likes-count">
                        {post.likesCount || post.count || 0} bəyənmə
                      </span>
                    </div>
                    <div className="post-caption">
                      <span className="caption-username">
                        {post.username || post.userName || 'İstifadəçi'}
                      </span>{' '}
                      {post.title}
                    </div>
                    {post.description && (
                      <div className="post-description">{post.description}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;