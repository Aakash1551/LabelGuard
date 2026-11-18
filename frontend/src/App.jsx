import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Layout } from './components/layout/Layout';

// Pages
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { InspectionsList } from './pages/InspectionsList';
import { NewInspection } from './pages/NewInspection';
import { InspectionDetail } from './pages/InspectionDetail';
import { Products } from './pages/Products';
import { Users } from './pages/Users';
import { RulesCatalog } from './pages/RulesCatalog';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Authentication Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Application Shell */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="inspections" element={<InspectionsList />} />
            <Route path="inspections/new" element={<NewInspection />} />
            <Route path="inspections/:id" element={<InspectionDetail />} />
            <Route path="products" element={<Products />} />
            <Route path="rules" element={<RulesCatalog />} />

            {/* Admin-Only RBAC Route */}
            <Route
              path="users"
              element={
                <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
                  <Users />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
