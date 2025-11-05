import React, { useState, useEffect, useRef } from 'react';
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
  const [animatingHeart, setAnimatingHeart] = useState(null); // Track which post is animating { postId, type: 'like' | 'unlike' }
  const [lastTap, setLastTap] = useState(null); // Track last tap time for double-tap detection
  const [shareMessage, setShareMessage] = useState(null); // transient share/copy feedback
  const shareTimerRef = useRef(null); // timer to clear message
  const { user, logout } = useAuth();

  // Prefer environment variable for deployment flexibility
  const API_BASE = import.meta.env.VITE_API_BASE || 'https://rsp-api.up.railway.app';

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
      const response = await fetch(`${API_BASE}/api/Likes/LikeReceiptById/${postId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ receiptId: postId }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          handleLogout();
          throw new Error('Token etibarsızdır');
        }
        throw new Error('Like failed');
      }

      const data = await response.json();
      const isLiked = data.liked;

      // Trigger heart animation only when liking
      if (isLiked) {
        setAnimatingHeart({ postId, type: 'like' });
        setTimeout(() => setAnimatingHeart(null), 1000); // Remove animation after 1 second
      }

      // Update feed posts
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id === postId) {
            const currentLikes = p.likesCount || p.count || 0;
            const wasLiked = p.likedByUser || false;
            
            // Calculate new likes count based on the response
            let newLikesCount;
            if (isLiked && !wasLiked) {
              // Just liked
              newLikesCount = currentLikes + 1;
            } else if (!isLiked && wasLiked) {
              // Just unliked
              newLikesCount = Math.max(0, currentLikes - 1);
            } else {
              // State is already in sync
              newLikesCount = currentLikes;
            }
            
            return {
              ...p,
              likedByUser: isLiked,
              count: newLikesCount,
              likesCount: newLikesCount,
            };
          }
          return p;
        })
      );

      // Update profile posts if viewing profile
      setUserPosts((prev) =>
        prev.map((p) => {
          if (p.id === postId) {
            const currentLikes = p.likesCount || p.count || 0;
            const wasLiked = p.likedByUser || false;
            
            let newLikesCount;
            if (isLiked && !wasLiked) {
              newLikesCount = currentLikes + 1;
            } else if (!isLiked && wasLiked) {
              newLikesCount = Math.max(0, currentLikes - 1);
            } else {
              newLikesCount = currentLikes;
            }
            
            return {
              ...p,
              likedByUser: isLiked,
              count: newLikesCount,
            };
          }
          return p;
        })
      );
    } catch (err) {
      console.error('Like error:', err);
      setError('Bəyənmə zamanı xəta baş verdi');
    }
  };

  // Detect mobile environment (basic heuristic)
  const isMobile = () => {
    if (typeof navigator === 'undefined') return false;
    return /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 600;
  };

  const buildShareUrl = (post) => {
    // Canonical link – if future /recipe/:id route exists, adjust here
    const origin = window.location.origin;
    // Using query param so current app can parse in future if needed
    return `${origin}/?recipeId=${post.id}`;
  };

  const showShareToast = (text) => {
    setShareMessage(text);
    if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    shareTimerRef.current = setTimeout(() => setShareMessage(null), 2500);
  };

  const copyToClipboardFallback = (text) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.top = '-1000px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch (e) {
      console.error('Clipboard fallback failed', e);
      return false;
    }
  };

  const handleShare = async (post) => {
    if (!post) return;
    const url = buildShareUrl(post);
    const message = `${post.title || 'Resept'} – Bax: ${url}`;

    // Mobile path: Try Web Share API first
    if (isMobile()) {
      if (navigator.share) {
        try {
          await navigator.share({ title: post.title || 'Resept', text: post.title || 'Resept', url });
          showShareToast('Paylaşıldı');
          return;
        } catch (err) {
          // User cancelled or share failed; fallback to WhatsApp
          console.warn('Web Share API failed or canceled, falling back to WhatsApp', err);
        }
      }
      // WhatsApp fallback
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
      showShareToast('WhatsApp açılır...');
      return;
    }

    // Desktop: copy to clipboard
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        showShareToast('Link kopyalandı');
      } else {
        const ok = copyToClipboardFallback(url);
        showShareToast(ok ? 'Link kopyalandı' : 'Kopyalama alınmadı');
      }
    } catch (e) {
      console.error('Clipboard write failed', e);
      const ok = copyToClipboardFallback(url);
      showShareToast(ok ? 'Link kopyalandı' : 'Kopyalama alınmadı');
    }
  };

  // Handle double-tap for mobile devices
  const handleImageTap = (postId) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300; // 300ms window for double-tap

    if (lastTap && (now - lastTap) < DOUBLE_TAP_DELAY) {
      // This is a double-tap
      handleLike(postId);
      setLastTap(null);
    } else {
      // This is a single tap, wait to see if another tap comes
      setLastTap(now);
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
    if (viewMode === 'feed') {
      // If already on feed, refresh the page
      window.location.reload();
    } else {
      // Otherwise, just switch back to feed view
      setViewMode('feed');
      setSelectedUser(null);
      setUserPosts([]);
    }
  };

  const handleLogout = () => {
    logout();s
    window.location.href = '/login';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'yeni';
    
    // Parse the UTC date string
    const date = new Date(dateString);
    const now = new Date();
    
    // Calculate difference in milliseconds, then convert to seconds
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    // Debugging: log the values
    console.log('Date string:', dateString);
    console.log('Parsed date:', date.toISOString());
    console.log('Current time:', now.toISOString());
    console.log('Difference in seconds:', diff);
    
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
                      <div 
                        className="post-image" 
                        onDoubleClick={() => handleLike(post.id)}
                        onClick={() => handleImageTap(post.id)}
                      >
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
                        {animatingHeart?.postId === post.id && animatingHeart.type === 'like' && (
                          <div className="heart-animation">
                            <Heart size={80} fill="white" color="white" />
                          </div>
                        )}
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
                          <Share2 size={24} onClick={() => handleShare(post)} />
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
                    <div 
                      className="post-image" 
                      onDoubleClick={() => handleLike(post.id)}
                      onClick={() => handleImageTap(post.id)}
                    >
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
                      {animatingHeart?.postId === post.id && animatingHeart.type === 'like' && (
                        <div className="heart-animation">
                          <Heart size={80} fill="white" color="white" />
                        </div>
                      )}
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
                        <Share2 size={24} onClick={() => handleShare(post)} />
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
      {shareMessage && (
        <div className="share-toast">{shareMessage}</div>
      )}
    </div>
  );
};

export default Dashboard;