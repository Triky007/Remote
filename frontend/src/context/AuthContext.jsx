import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/apiService'

const AuthContext = createContext(null)

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (!context) throw new Error('useAuth must be used within AuthProvider')
    return context
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [token, setToken] = useState(localStorage.getItem('remote_token'))
    const [loading, setLoading] = useState(true)

    const checkAuth = useCallback(async () => {
        const savedToken = localStorage.getItem('remote_token')
        if (!savedToken) {
            setLoading(false)
            return
        }

        try {
            const response = await api.get('/auth/me')
            setUser(response.data)
            setToken(savedToken)
        } catch (error) {
            localStorage.removeItem('remote_token')
            localStorage.removeItem('remote_user')
            setUser(null)
            setToken(null)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        checkAuth()
    }, [checkAuth])

    const login = async (username, password) => {
        const response = await api.post('/auth/login', { username, password })
        const { token: newToken, user: userData } = response.data

        localStorage.setItem('remote_token', newToken)
        localStorage.setItem('remote_user', JSON.stringify(userData))
        setToken(newToken)
        setUser(userData)

        return userData
    }

    const loginWithToken = async (magicToken) => {
        const response = await api.post('/auth/magic-link', { token: magicToken })
        const { token: newToken, user: userData } = response.data

        localStorage.setItem('remote_token', newToken)
        localStorage.setItem('remote_user', JSON.stringify(userData))
        setToken(newToken)
        setUser(userData)

        return userData
    }

    const logout = () => {
        localStorage.removeItem('remote_token')
        localStorage.removeItem('remote_user')
        setUser(null)
        setToken(null)
    }

    const value = {
        user,
        token,
        loading,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        isClient: user?.role === 'client',
        login,
        loginWithToken,
        logout,
        checkAuth,
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
