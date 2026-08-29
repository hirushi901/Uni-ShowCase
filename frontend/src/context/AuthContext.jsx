import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const AuthContext = createContext(null);

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error('Failed to parse user session:', e);
      return null;
    }
  });
  const [socket, setSocket] = useState(null);

  // Connect / disconnect socket when auth state changes
  useEffect(() => {
    if (token) {
      const s = io(BACKEND_URL, {
        auth: { token },
        transports: ['websocket', 'polling']
      });

      s.on('connect', () => {
        console.log('[Socket] Connected with authenticated session');
      });

      s.on('connect_error', (err) => {
        console.warn('[Socket] Connection error:', err.message);
      });

      setSocket(s);

      return () => {
        s.disconnect();
        setSocket(null);
      };
    }
  }, [token]);

  const login = (newToken, newUser) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    if (socket) socket.disconnect();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setSocket(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, socket }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
