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

  // Handle shared recipe links with recipeId query parameter
  useEffect(() => {
    if (user && posts.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const recipeId = params.get('recipeId');
      
      if (recipeId) {
        // Scroll to the recipe with this ID after posts are loaded
        setTimeout(() => {
          const postElement = document.querySelector(`[data-post-id="${recipeId}"]`);
          if (postElement) {
            postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Optional: Add a highlight effect
            postElement.style.transition = 'background-color 0.5s';
            postElement.style.backgroundColor = 'rgba(255, 215, 0, 0.1)';
            setTimeout(() => {
              postElement.style.backgroundColor = '';
            }, 2000);
            
            // Clean up URL without reloading - only after successful scroll
            window.history.replaceState({}, '', '/dashboard');
          } else {
            // If post not found, try again after a bit more time
            console.log('Recipe not found yet, waiting...');
            setTimeout(() => {
              const retryElement = document.querySelector(`[data-post-id="${recipeId}"]`);
              if (retryElement) {
                retryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                retryElement.style.transition = 'background-color 0.5s';
                retryElement.style.backgroundColor = 'rgba(255, 215, 0, 0.1)';
                setTimeout(() => {
                  retryElement.style.backgroundColor = '';
                }, 2000);
                window.history.replaceState({}, '', '/dashboard');
              }
            }, 1000);
          }
        }, 300); // Reduced initial timeout since we now wait for posts to load
      }
    }
  }, [user, posts]);

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

  // Track in-flight like requests to prevent duplicate rapid submissions
  const [pendingLikes, setPendingLikes] = useState({});

  const handleLike = async (postId, showAnimation = false) => {
    if (!user) {
      setError('Zəhmət olmasa yenidən daxil olun');
      return;
    }

    // Guard: if a like/unlike for this post is already pending, skip
    if (pendingLikes[postId]) {
      console.log('Like already pending for post:', postId);
      return;
    }

    // Clear any previous errors
    setError(null);
    setPendingLikes((prev) => ({ ...prev, [postId]: true }));

    try {
      console.log('Sending like request for post:', postId);
      
      const response = await fetch(`${API_BASE}/api/Likes/LikeReceiptById/${postId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user?.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ receiptId: postId }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          handleLogout();
          throw new Error('Token etibarsızdır');
        }
        const errorText = await response.text();
        console.error('API Error Response:', response.status, errorText);
        throw new Error(`Like failed: ${response.status}`);
      }

      // Parse JSON response - API returns { liked: true/false }
      const data = await response.json();
      console.log('Like API Response:', data);

      const isLiked = data.liked;

      // Show heart animation only when liking (and requested via showAnimation flag)
      if (isLiked && showAnimation) {
        setAnimatingHeart({ postId, type: 'like' });
        setTimeout(() => setAnimatingHeart(null), 1000);
      }

      // Update feed posts
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id === postId) {
            const wasLiked = p.likedByUser || false;
            const currentLikes = p.likesCount || p.count || 0;
            
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
            const wasLiked = p.likedByUser || false;
            const currentLikes = p.likesCount || p.count || 0;
            
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
              likesCount: newLikesCount,
            };
          }
          return p;
        })
      );
    } catch (err) {
      console.error('Like error:', err);
      setError('Bəyənmə zamanı xəta baş verdi: ' + err.message);
    } finally {
      // Clear pending flag regardless of success or failure
      setPendingLikes((prev) => {
        const clone = { ...prev };
        delete clone[postId];
        return clone;
      });
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

  // Handle double-tap for mobile (double-click for desktop is separate)
  const handleImageTap = (postId) => {
    if (!isMobile()) return; // Desktop uses native onDoubleClick
    
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300; // 300ms window for double-tap

    // lastTap is an object { time, postId }
    if (lastTap && (now - lastTap.time) < DOUBLE_TAP_DELAY && lastTap.postId === postId) {
      // This is a double-tap - only like if not already liked
      const post = posts.find(p => p.id === postId) || userPosts.find(p => p.id === postId);
      if (post && !post.likedByUser) {
        handleLike(postId, true); // true = show animation
      }
      setLastTap(null);
    } else {
      // This is a single tap, wait to see if another tap comes
      setLastTap({ time: now, postId });
    }
  };

  // Handle double-click on desktop - only like if not already liked
  const handleImageDoubleClick = (postId) => {
    const post = posts.find(p => p.id === postId) || userPosts.find(p => p.id === postId);
    if (post && !post.likedByUser) {
      handleLike(postId, true); // true = show animation
    }
  };

  const handleUserClick = async (userId) => {
    try {
      setUserLoading(true);
      setViewMode('profile');
      
      // Scroll to top when switching to profile view
      window.scrollTo({ top: 0, behavior: 'smooth' });

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
      // Scroll to top when returning to feed
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleLogout = () => {
    const confirmed = window.confirm('Çıxmaq istədiyinizə əminsiniz?');
    if (confirmed) {
      logout();
      window.location.href = '/login';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'yeni';
    
    // Parse the UTC date string
    const date = new Date(dateString);
    const now = new Date();
    
    // Calculate difference in milliseconds, then convert to seconds
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
    if (weeks < 5) return `${weeks}həftə`;
    const months = Math.floor(days / 30);
    if (months > 0 && months < 12) return `${months}ay`;
    if (days < 365) return `${weeks}həftə`; // Fallback for edge cases
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
            className={`nav-item ${viewMode === 'profile' && selectedUser?.username === user?.username ? 'active' : ''}`}
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
              {selectedUser?.username === user?.username && (
                <button className="profile-logout-btn" onClick={handleLogout}>
                  <LogOut size={20} />
                  <span>Çıxış et</span>
                </button>
              )}
            </div>

            <div className="profile-posts">
              {userLoading ? (
                <div className="loading">Yüklənir...</div>
              ) : userPosts.length === 0 ? (
                <div className="no-results">Bu istifadəçinin heç bir resepti yoxdur</div>
              ) : (
                <div className="feed">
                  {userPosts.map((post) => (
                    <div key={post.id} className="post-card" data-post-id={post.id}>
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
                        onClick={() => handleImageTap(post.id)}
                        onDoubleClick={() => handleImageDoubleClick(post.id)}
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
                          onClick={() => handleLike(post.id, false)}
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
                <div className="search-input-wrapper">
                  <Search size={20} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Axtar"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={!user}
                  />
                </div>
              </form>
              {searchLoading && <span className="loading-text">Axtarılır...</span>}
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
                  <div key={post.id} className="post-card" data-post-id={post.id}>
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
                      onClick={() => handleImageTap(post.id)}
                      onDoubleClick={() => handleImageDoubleClick(post.id)}
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
                        onClick={() => handleLike(post.id, false)}
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