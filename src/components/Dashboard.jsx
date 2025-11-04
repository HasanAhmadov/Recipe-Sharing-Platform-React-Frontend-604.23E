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
  const { user, logout } = useAuth();

  const API_BASE = 'https://rsp-api.up.railway.app';

  // Fetch all receipts on initial load
  useEffect(() => {
    if (user) {
      fetchAllReceipts();
    }
  }, [user]);

  const getAuthHeaders = () => {
    return {
      'Authorization': `Bearer ${user?.token}`,
      'Content-Type': 'application/json',
    };
  };

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
        `${API_BASE}/api/Search/SearchReceipts?query=${encodeURIComponent(searchQuery)}`, 
        {
          method: 'GET',
          headers: getAuthHeaders(),
        }
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

      // Update the post in local state
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? { 
                ...post, 
                likedByUser: !post.likedByUser,
                likesCount: post.likedByUser ? (post.likesCount - 1) : (post.likesCount + 1)
              } 
            : post
        )
      );
    } catch (err) {
      console.error('Like error:', err);
      setError('Bəyənmə zamanı xəta baş verdi');
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}d`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}s`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}g`;
    return `${Math.floor(diff / 604800)}h`;
  };

  if (!user) {
    return (
      <div className="dashboard">
        <div className="error-container">
          <div className="error-message">
            <h2>Giriş tələb olunur</h2>
            <p>Zəhmət olmasa yenidən daxil olun</p>
            <button onClick={() => window.location.href = '/login'} className="login-btn">
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
        <div className="logo">
          <h1>Metbəxim</h1>
        </div>
        
        <nav className="nav-menu">
          <button className="nav-item active">
            <Home size={24} />
            <span>Ana səhifə</span>
          </button>
          
          <button className="nav-item">
            <PlusSquare size={24} />
            <span>Yarat</span>
          </button>
          
          <button className="nav-item">
            <User size={24} />
            <span>Profil</span>
          </button>
          
          <button className="nav-item" onClick={handleLogout}>
            <LogOut size={24} />
            <span>Çıxış et</span>
          </button>
        </nav>
      </div>

      <div className="main-content">
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
                    <div className="avatar">
                      <User size={20} />
                    </div>
                    <span className="username">{post.username || post.userName || 'İstifadəçi'}</span>
                    <span className="post-time">• {formatDate(post.createdAt)}</span>
                  </div>
                </div>

                <div className="post-image">
                  <img 
                    src={post.imageUrl?.startsWith('http') ? post.imageUrl : `${API_BASE}${post.imageUrl}`}
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
                    <Heart size={24} fill={post.likedByUser ? 'currentColor' : 'none'} />
                  </button>
                  <button className="action-btn">
                    <Share2 size={24} />
                  </button>
                  <span className="likes-count">{post.likesCount || post.count || 0} bəyənmə</span>
                </div>

                <div className="post-caption">
                  <span className="caption-username">{post.username || post.userName || 'İstifadəçi'}</span>
                  {' '}{post.title}
                </div>

                {post.description && (
                  <div className="post-description">
                    {post.description}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;