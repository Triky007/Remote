import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
    Box, Card, CardContent, TextField, Button, Typography, Alert,
    CircularProgress, InputAdornment, IconButton, Stack
} from '@mui/material'
import { Visibility, VisibilityOff, Description as PdfIcon, Login as LoginIcon } from '@mui/icons-material'

const LoginPage = () => {
    const { login, loginWithToken, isAuthenticated, user } = useAuth()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()

    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [magicLinkLoading, setMagicLinkLoading] = useState(false)

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated && user) {
            navigate(user.role === 'admin' ? '/admin' : '/client', { replace: true })
        }
    }, [isAuthenticated, user, navigate])

    // Handle magic link token
    useEffect(() => {
        const token = searchParams.get('token')
        if (token) {
            handleMagicLogin(token)
        }
    }, [searchParams])

    const handleMagicLogin = async (token) => {
        setMagicLinkLoading(true)
        setError('')
        try {
            const userData = await loginWithToken(token)
            navigate(userData.role === 'admin' ? '/admin' : '/client', { replace: true })
        } catch (err) {
            setError(err.response?.data?.detail || 'Token inválido o expirado')
            setMagicLinkLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const userData = await login(username, password)
            navigate(userData.role === 'admin' ? '/admin' : '/client', { replace: true })
        } catch (err) {
            setError(err.response?.data?.detail || 'Error al iniciar sesión')
        } finally {
            setLoading(false)
        }
    }

    if (magicLinkLoading) {
        return (
            <Box sx={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #0f1d30 0%, #1e3a5f 50%, #2563eb 100%)'
            }}>
                <Card sx={{ p: 4, textAlign: 'center', maxWidth: 400 }}>
                    <CircularProgress size={48} sx={{ mb: 2 }} />
                    <Typography variant="h6">Verificando acceso...</Typography>
                    <Typography color="text.secondary" sx={{ mt: 1 }}>
                        Validando tu enlace de invitación
                    </Typography>
                </Card>
            </Box>
        )
    }

    return (
        <Box sx={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f1d30 0%, #1e3a5f 50%, #2563eb 100%)',
            p: 2
        }}>
            <Card sx={{
                width: '100%', maxWidth: 420, overflow: 'visible',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}>
                {/* Header */}
                <Box sx={{
                    background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
                    p: 4, textAlign: 'center', borderRadius: '16px 16px 0 0'
                }}>
                    <PdfIcon sx={{ fontSize: 56, color: 'white', mb: 1 }} />
                    <Typography variant="h5" sx={{ color: 'white', fontWeight: 700 }}>
                        Remote PDF Review
                    </Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.7)', mt: 0.5, fontSize: 14 }}>
                        Sistema de revisión de artes finales
                    </Typography>
                </Box>

                <CardContent sx={{ p: 4 }}>
                    {error && (
                        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError('')}>
                            {error}
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit}>
                        <Stack spacing={2.5}>
                            <TextField
                                label="Usuario"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                fullWidth
                                autoFocus
                                autoComplete="username"
                                required
                            />
                            <TextField
                                label="Contraseña"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                fullWidth
                                autoComplete="current-password"
                                required
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                                                {showPassword ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                            />
                            <Button
                                type="submit"
                                variant="contained"
                                size="large"
                                fullWidth
                                disabled={loading}
                                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <LoginIcon />}
                                sx={{
                                    py: 1.5, fontSize: 16, fontWeight: 600,
                                    background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
                                    '&:hover': { background: 'linear-gradient(135deg, #0f1d30 0%, #1d4ed8 100%)' },
                                }}
                            >
                                {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                            </Button>
                        </Stack>
                    </form>
                </CardContent>
            </Card>
        </Box>
    )
}

export default LoginPage
