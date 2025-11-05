import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/AuthContext';
import Register from './components/Register';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Create from './components/Create';
import './App.css';

// Component to handle root path and preserve query params
const RootRedirect = () => {
  const queryParams = window.location.search;
  
  // Check if user is logged in
  const token = localStorage.getItem('accessToken');
  
  if (token) {
    // User is logged in, go to dashboard with params
    return <Navigate to={`/dashboard${queryParams}`} replace />;
  } else {
    // User not logged in
    if (queryParams) {
      // Store the full URL for after login
      localStorage.setItem('redirectAfterLogin', `/dashboard${queryParams}`);
    }
    return <Navigate to="/login" replace />;
  }
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/create" element={<Create />} />
            <Route path="/" element={<RootRedirect />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;