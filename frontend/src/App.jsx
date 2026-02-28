import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { Box, CircularProgress } from '@mui/material'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import AdminDashboard from './pages/admin/Dashboard'
import AdminProjectDetail from './pages/admin/ProjectDetail'
import AdminCatalogPage from './pages/admin/CatalogPage'
import ClientDashboard from './pages/client/Dashboard'
import ClientProjectDetail from './pages/client/ProjectDetail'

const App = () => {
    const { loading, isAuthenticated, user } = useAuth()

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <CircularProgress />
            </Box>
        )
    }

    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Admin routes */}
            <Route path="/admin" element={
                <ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>
            } />
            <Route path="/admin/project/:projectId" element={
                <ProtectedRoute requiredRole="admin"><AdminProjectDetail /></ProtectedRoute>
            } />
            <Route path="/admin/catalogs" element={
                <ProtectedRoute requiredRole="admin"><AdminCatalogPage /></ProtectedRoute>
            } />

            {/* Client routes */}
            <Route path="/client" element={
                <ProtectedRoute requiredRole="client"><ClientDashboard /></ProtectedRoute>
            } />
            <Route path="/client/project/:projectId" element={
                <ProtectedRoute requiredRole="client"><ClientProjectDetail /></ProtectedRoute>
            } />

            {/* Default redirect */}
            <Route path="/" element={
                isAuthenticated ?
                    <Navigate to={user?.role === 'admin' ? '/admin' : '/client'} replace /> :
                    <Navigate to="/login" replace />
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

export default App
