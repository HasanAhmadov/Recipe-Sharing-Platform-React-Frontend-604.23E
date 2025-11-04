import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Register.css';

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
                throw new Error('Registration failed after multiple retries.');
            }
        }
    }
    throw new Error('Failed to reach server.');
};

const API_BASE_URL = 'https://rsp-api.up.railway.app';
const REGISTER_ENDPOINT = '/api/Auth/Register';

const Register = () => {
    const [username, setUsername] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    
    const navigate = useNavigate();

    const handleLoginRedirect = () => {
        navigate('/login');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setIsSuccess(false);

        if (!username || !name || !password) {
            setMessage('Bütün sahələr doldurulmalıdır.');
            return;
        }

        setIsLoading(true);

        const registerData = { username, name, password };
        const url = API_BASE_URL + REGISTER_ENDPOINT;

        try {
            const response = await fetchWithRetry(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(registerData),
            });

            const data = await response.json();

            if (response.ok) {
                setIsSuccess(true);
                console.log('Registration Successful:', data);
                setMessage('Hesab uğurla yaradıldı!');
                
                setTimeout(() => {
                    navigate('/login');
                }, 2000);

            } else {
                const errorDetail = data.title || data.errors ? JSON.stringify(data) : 'Bilinməyən xəta baş verdi.';
                setMessage(`Qeydiyyat xətası: ${errorDetail}`);
            }
        } catch (error) {
            console.error('Network or Retry Error:', error);
            setMessage('Serverə qoşulmaq mümkün olmadı. Zəhmət olmasa yenidən cəhd edin.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="register-container">
            <div className="register-card">
                
                {/* Loqo Bölməsi */}
                <div className="logo-section">
                {/* Loqo mətnini şəkillə əvəz edirik */}
                    <img src="/logo-metbexim.png" alt="Mətbəxim Logo" className="logo-image" />
                </div>

                {/* Form Title */}
                <h2 className="form-title">Hesab yarat</h2>

                {/* Status Message Area */}
                {message && (
                    <div className={`message ${isSuccess ? 'message-success' : 'message-error'}`}>
                        {message}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="register-form">
                    {/* Username Input */}
                    <div className="form-group">
                        <label htmlFor="username" className="form-label">
                            İstifadəçi adı
                        </label>
                        <div className="input-container">
                            <span className="input-icon">👤</span>
                            <input
                                id="username"
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

                    {/* Name Input */}
                    <div className="form-group">
                        <label htmlFor="name" className="form-label">
                            Ad
                        </label>
                        <div className="input-container">
                            <span className="input-icon">🧑</span>
                            <input
                                id="name"
                                type="text"
                                className="form-input"
                                placeholder="Adınızı daxil edin"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    {/* Password Input */}
                    <div className="form-group">
                        <label htmlFor="password" className="form-label">
                            Şifrə
                        </label>
                        <div className="input-container">
                            <span className="input-icon">🔒</span>
                            <input
                                id="password"
                                type="password"
                                className="form-input"
                                placeholder="Şifrənizi daxil edin"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={isLoading}
                                minLength={6}
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className={`submit-button ${isLoading ? 'loading' : ''}`}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Yaradılır...' : 'Hesab yarat'}
                    </button>
                </form>

                {/* Login Link */}
                <div className="login-link">
                    <p className="login-text">
                        Hesabınız var?&nbsp;
                        <button 
                            onClick={handleLoginRedirect}
                            className="login-button"
                        >
                            Daxil olun
                        </button>
                    </p>
                </div>

                {/* University Branding */}
                <div className="footer">
                    <img
                        src="/logo-adnsu.png"
                        alt="ADNSU Logo"
                        style={{ maxWidth: '300px', height: 'auto', display: 'block', margin: '0 auto' }}
                    />
                </div>
            </div>
        </div>
    );
};

export default Register;