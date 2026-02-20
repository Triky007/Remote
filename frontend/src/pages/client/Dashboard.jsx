import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/apiService'
import {
    Box, Typography, Button, Card, CardContent, Grid, Chip, Stack,
    AppBar, Toolbar, IconButton, Menu, MenuItem, Divider, CircularProgress
} from '@mui/material'
import {
    Logout, Person, FolderOpen, CheckCircle, Warning, Error as ErrorIcon, Schedule
} from '@mui/icons-material'

const statusColors = {
    pending: 'default', reviewing: 'info', approved: 'success', rejected: 'error', completed: 'primary'
}
const statusLabels = {
    pending: 'Pendiente', reviewing: 'En revisión', approved: 'Aprobado', rejected: 'Rechazado', completed: 'Completado'
}

const ClientDashboard = () => {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const [projects, setProjects] = useState([])
    const [loading, setLoading] = useState(true)
    const [anchorEl, setAnchorEl] = useState(null)

    const loadProjects = useCallback(async () => {
        try {
            const res = await api.get('/projects')
            setProjects(res.data)
        } catch (err) {
            console.error('Error loading projects:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadProjects() }, [loadProjects])

    const getPreflightSummary = (pdfs) => {
        if (!pdfs || pdfs.length === 0) return null
        const pass = pdfs.filter(p => p.preflight_status === 'PASS').length
        const warn = pdfs.filter(p => p.preflight_status === 'WARN').length
        const fail = pdfs.filter(p => p.preflight_status === 'FAIL').length
        const pending = pdfs.filter(p => p.preflight_status === 'pending').length
        return { pass, warn, fail, pending }
    }

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <CircularProgress />
            </Box>
        )
    }

    return (
        <Box sx={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
            <AppBar position="sticky" sx={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)' }}>
                <Toolbar>
                    <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>📄 Remote PDF Review</Typography>
                    <Chip label="Cliente" color="success" size="small" variant="outlined"
                        sx={{ mr: 2, fontWeight: 600, color: 'white', borderColor: 'rgba(255,255,255,0.5)' }} />
                    <IconButton color="inherit" onClick={(e) => setAnchorEl(e.currentTarget)}><Person /></IconButton>
                    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                        <MenuItem disabled><Typography variant="body2">{user?.full_name || user?.username}</Typography></MenuItem>
                        <Divider />
                        <MenuItem onClick={() => { logout(); navigate('/login') }}>
                            <Logout sx={{ mr: 1 }} fontSize="small" /> Cerrar sesión
                        </MenuItem>
                    </Menu>
                </Toolbar>
            </AppBar>

            <Box sx={{ maxWidth: 1000, mx: 'auto', p: 3 }}>
                <Typography variant="h5" sx={{ mb: 0.5, fontWeight: 700 }}>
                    Bienvenido, {user?.full_name || user?.username}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    Aquí puede ver sus proyectos y subir artes finales para revisión.
                </Typography>

                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Mis Proyectos</Typography>

                {projects.length === 0 ? (
                    <Card sx={{ p: 4, textAlign: 'center' }}>
                        <FolderOpen sx={{ fontSize: 64, color: '#d1d5db', mb: 1 }} />
                        <Typography color="text.secondary">No tiene proyectos asignados</Typography>
                    </Card>
                ) : (
                    <Grid container spacing={2}>
                        {projects.map((project) => {
                            const summary = getPreflightSummary(project.pdfs)
                            return (
                                <Grid item xs={12} sm={6} key={project.project_id}>
                                    <Card sx={{
                                        cursor: 'pointer', transition: 'all 0.2s',
                                        '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 }
                                    }} onClick={() => navigate(`/client/project/${project.project_id}`)}>
                                        <CardContent>
                                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                                                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: 16 }}>{project.name}</Typography>
                                                <Chip label={statusLabels[project.status] || project.status} color={statusColors[project.status] || 'default'} size="small" />
                                            </Stack>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
                                                {project.description || 'Sin descripción'}
                                            </Typography>

                                            <Divider sx={{ my: 1 }} />

                                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                <Typography variant="caption" color="text.secondary">{project.pdfs?.length || 0} PDFs</Typography>
                                                {summary && (
                                                    <Stack direction="row" spacing={0.5}>
                                                        {summary.pass > 0 && <Chip icon={<CheckCircle sx={{ fontSize: '14px !important' }} />} label={summary.pass} size="small" color="success" variant="outlined" sx={{ height: 22 }} />}
                                                        {summary.warn > 0 && <Chip icon={<Warning sx={{ fontSize: '14px !important' }} />} label={summary.warn} size="small" color="warning" variant="outlined" sx={{ height: 22 }} />}
                                                        {summary.fail > 0 && <Chip icon={<ErrorIcon sx={{ fontSize: '14px !important' }} />} label={summary.fail} size="small" color="error" variant="outlined" sx={{ height: 22 }} />}
                                                    </Stack>
                                                )}
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            )
                        })}
                    </Grid>
                )}
            </Box>
        </Box>
    )
}

export default ClientDashboard
