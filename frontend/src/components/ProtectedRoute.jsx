import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Box, CircularProgress } from '@mui/material'

const ProtectedRoute = ({ children, requiredRole }) => {
    const { isAuthenticated, loading, user } = useAuth()

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <CircularProgress />
            </Box>
        )
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    if (requiredRole && user?.role !== requiredRole) {
        // Redirect to the appropriate dashboard
        return <Navigate to={user?.role === 'admin' ? '/admin' : '/client'} replace />
    }

    return children
}

export default ProtectedRoute
