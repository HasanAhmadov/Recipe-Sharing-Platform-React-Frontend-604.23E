import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import './Login.css';

const fetchWithRetry = async (url, options, maxRetries = 3) => {
    let delay = 1000;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.status === 429) {
                throw new Error('Rate limit exceeded. Retrying...');
            }
            return response;
        } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error.message);
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
            } else {
                throw new Error('Login failed after multiple retries.');
            }
        }
    }
    throw new Error('Failed to reach server.');
};

// Environment-driven API base for Netlify / other deployments
const API_BASE_URL = import.meta.env.VITE_API_BASE || 'https://rsp-api.up.railway.app';
const LOGIN_ENDPOINT = '/api/Auth/Login';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleRegisterRedirect = () => {
        navigate('/register');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setIsSuccess(false);

        if (!username || !password) {
            setMessage('İstifadəçi adı və şifrə tələb olunur.');
            return;
        }

        setIsLoading(true);

        const loginData = { username, password };
        const url = API_BASE_URL + LOGIN_ENDPOINT;

        try {
            const response = await fetchWithRetry(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(loginData),
            });

            const data = await response.json();

            if (response.ok) {
                setIsSuccess(true);
                console.log('Login Successful:', data);
                
                // Use the login function from AuthContext to update state
                login(data);
                
                setMessage(`Xoş gəlmisiniz, ${data.name}! Uğurla daxil oldunuz.`);
                
                // Check if there's a redirect URL stored (for shared links)
                const redirectUrl = localStorage.getItem('redirectAfterLogin');
                if (redirectUrl) {
                    localStorage.removeItem('redirectAfterLogin');
                    window.location.href = redirectUrl; // Use full navigation to preserve query params
                } else {
                    navigate('/dashboard');
                }

            } else {
                // Handle different error cases
                const errorMessage = typeof data === 'string' ? data : data.message || data.title;
                
                if (errorMessage === 'Invalid username or password.' || response.status === 400) {
                    setMessage('Yanlış istifadəçi adı və ya şifrə');
                } else {
                    const errorDetail = data.title || data.errors ? JSON.stringify(data) : 'Bilinməyən xəta baş verdi.';
                    setMessage(`Giriş xətası: ${errorDetail}`);
                }
            }
        } catch (error) {
            console.error('Network or Retry Error:', error);
            setMessage('Serverə qoşulmaq mümkün olmadı. Zəhmət olmasa yenidən cəhd edin.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                
                {/* Logo Section */}
                <div className="logo-section">
                <img
                    src="/logo-metbexim.png"
                    alt="Mətbəxim Logo"
                    className="logo-image"
                    onError={(e) => {
                        console.error('Logo failed to load:', e.target.src);
                        e.target.style.display = 'none';
                    }}
                    onLoad={() => console.log('Logo loaded successfully')}
                />
                </div>

                {/* Form Title */}
                <h2 className="form-title">Daxil ol</h2>

                {/* Status Message Area */}
                {message && (
                    <div className={`message ${isSuccess ? 'message-success' : 'message-error'}`}>
                        {message}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="login-form">
                    {/* Username Input */}
                    <div className="form-group">
                        <label htmlFor="login-username" className="form-label">
                            İstifadəçi adı
                        </label>
                        <div className="input-container">
                            <span className="input-icon">👤</span>
                            <input
                                id="login-username"
                                type="text"
                                className="form-input"
                                placeholder="İstifadəçi adınızı daxil edin"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    {/* Password Input */}
                    <div className="form-group">
                        <label htmlFor="login-password" className="form-label">
                            Şifrə
                        </label>
                        <div className="input-container">
                            <span className="input-icon">🔒</span>
                            <input
                                id="login-password"
                                type="password"
                                className="form-input"
                                placeholder="Şifrənizi daxil edin"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className={`submit-button ${isLoading ? 'loading' : ''}`}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Daxil olunur...' : 'Daxil ol'}
                    </button>
                </form>

                {/* Register Link */}
                <div className="register-link">
                    <p className="register-text">
                        Hesabınız yoxdur?&nbsp;
                        <button 
                            onClick={handleRegisterRedirect}
                            className="register-button"
                        >
                            Hesab yaradın
                        </button>
                    </p>
                </div>

                {/* University Branding */}
                <div className="footer">
                    <img
                        src="/logo-adnsu.png"
                        alt="ADNSU Logo"
                        style={{ maxWidth: '260px', height: 'auto', display: 'block', margin: '0 auto' }}
                    />
                </div>
            </div>
        </div>
    );
};

export default Login;