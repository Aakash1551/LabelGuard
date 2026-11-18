import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, getCurrentUser } from '../api/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('labelguard_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (_) {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('labelguard_token') || null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verifySession = async () => {
      if (token) {
        try {
          const profile = await getCurrentUser();
          setUser(profile);
          localStorage.setItem('labelguard_user', JSON.stringify(profile));
        } catch (_) {
          // Token is invalid/expired
          logout();
        }
      }
      setIsLoading(false);
    };

    verifySession();
  }, [token]);

  const login = async (email, password) => {
    const data = await loginUser(email, password);
    const userProfile = {
      id: data.user_id,
      email: data.email,
      fullName: data.full_name,
      role: data.role,
    };

    localStorage.setItem('labelguard_token', data.access_token);
    localStorage.setItem('labelguard_user', JSON.stringify(userProfile));

    setToken(data.access_token);
    setUser(userProfile);
    return userProfile;
  };

  const logout = () => {
    localStorage.removeItem('labelguard_token');
    localStorage.removeItem('labelguard_user');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    isAdmin: user ? ['ADMIN', 'SUPER_ADMIN'].includes(user.role) : false,
    role: user ? user.role : null,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
