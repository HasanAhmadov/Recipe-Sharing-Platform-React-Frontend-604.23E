import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if user is logged in on app start
        const token = localStorage.getItem('accessToken');
        const username = localStorage.getItem('username');
        const name = localStorage.getItem('name');
        
        if (token && username) {
            setUser({ username, name, token });
        }
        setLoading(false);
    }, []);

    const login = (userData) => {
        localStorage.setItem('accessToken', userData.accessToken);
        localStorage.setItem('username', userData.username);
        localStorage.setItem('name', userData.name);
        localStorage.setItem('expiresAt', userData.expiresAt);
        
        setUser({
            username: userData.username,
            name: userData.name,
            token: userData.accessToken
        });
    };

    const logout = () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('username');
        localStorage.removeItem('name');
        localStorage.removeItem('expiresAt');
        setUser(null);
    };

    const value = {
        user,
        login,
        logout,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};