import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/apiService'
import {
    Box, Typography, Button, Card, CardContent, CardActions, Grid, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack,
    AppBar, Toolbar, IconButton, Menu, MenuItem, Alert, CircularProgress,
    Select, FormControl, InputLabel, Divider, Avatar, Tooltip, Snackbar
} from '@mui/material'
import {
    Add, Logout, Person, FolderOpen, Email, ContentCopy,
    CheckCircle, Warning, Error as ErrorIcon, Schedule, Settings,
    AdminPanelSettings
} from '@mui/icons-material'

const statusColors = {
    pending: 'default', reviewing: 'info', approved: 'success', rejected: 'error', completed: 'primary'
}
const statusLabels = {
    pending: 'Pendiente', reviewing: 'En revisión', approved: 'Aprobado', rejected: 'Rechazado', completed: 'Completado'
}

const AdminDashboard = () => {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const [projects, setProjects] = useState([])
    const [clients, setClients] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // Dialogs
    const [projectDialog, setProjectDialog] = useState(false)
    const [inviteDialog, setInviteDialog] = useState(false)
    const [inviteUserId, setInviteUserId] = useState('')
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })

    // Forms
    const [newProject, setNewProject] = useState({ name: '', description: '', client_user_id: '' })
    const [inviteData, setInviteData] = useState({ custom_message: '', expiry_hours: 72 })
    const [inviteResult, setInviteResult] = useState(null)

    // Menu
    const [anchorEl, setAnchorEl] = useState(null)

    const loadData = useCallback(async () => {
        try {
            const [projRes, clientRes] = await Promise.all([
                api.get('/projects'),
                api.get('/users/clients')
            ])
            setProjects(projRes.data)
            setClients(clientRes.data)
        } catch (err) {
            setError('Error cargando datos')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    const handleCreateProject = async () => {
        try {
            await api.post('/projects', newProject)
            setProjectDialog(false)
            setNewProject({ name: '', description: '', client_user_id: '' })
            setSnackbar({ open: true, message: 'Proyecto creado', severity: 'success' })
            loadData()
        } catch (err) {
            setSnackbar({ open: true, message: err.response?.data?.detail || 'Error', severity: 'error' })
        }
    }

    const handleInvite = async () => {
        try {
            const res = await api.post(`/users/${inviteUserId}/invite`, inviteData)
            setInviteResult(res.data)
            setSnackbar({ open: true, message: res.data.email_sent ? 'Invitación enviada por email' : 'Magic link generado', severity: 'success' })
        } catch (err) {
            setSnackbar({ open: true, message: err.response?.data?.detail || 'Error', severity: 'error' })
        }
    }

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
        setSnackbar({ open: true, message: 'Copiado al portapapeles', severity: 'info' })
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
            {/* Navbar */}
            <AppBar position="sticky" sx={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)' }}>
                <Toolbar>
                    <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
                        📄 Remote PDF Review
                    </Typography>
                    <Chip label="Admin" color="warning" size="small" sx={{ mr: 2, fontWeight: 600 }} />
                    <IconButton color="inherit" onClick={(e) => setAnchorEl(e.currentTarget)}>
                        <Person />
                    </IconButton>
                    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                        <MenuItem disabled>
                            <Typography variant="body2">{user?.full_name || user?.username}</Typography>
                        </MenuItem>
                        <Divider />
                        <MenuItem onClick={() => { setAnchorEl(null); navigate('/admin/users') }}>
                            <AdminPanelSettings sx={{ mr: 1 }} fontSize="small" /> Gestionar Admins
                        </MenuItem>
                        <MenuItem onClick={() => { logout(); navigate('/login') }}>
                            <Logout sx={{ mr: 1 }} fontSize="small" /> Cerrar sesión
                        </MenuItem>
                    </Menu>
                </Toolbar>
            </AppBar>

            {/* Content */}
            <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                {/* Stats */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={4}>
                        <Card>
                            <CardContent sx={{ textAlign: 'center' }}>
                                <Typography variant="h3" color="primary" sx={{ fontWeight: 700 }}>{projects.length}</Typography>
                                <Typography color="text.secondary">Proyectos</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Card>
                            <CardContent sx={{ textAlign: 'center' }}>
                                <Typography variant="h3" color="secondary" sx={{ fontWeight: 700 }}>{clients.length}</Typography>
                                <Typography color="text.secondary">Clientes</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Card>
                            <CardContent sx={{ textAlign: 'center' }}>
                                <Typography variant="h3" sx={{ fontWeight: 700, color: '#10b981' }}>
                                    {projects.reduce((acc, p) => acc + (p.pdfs?.length || 0), 0)}
                                </Typography>
                                <Typography color="text.secondary">PDFs totales</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Actions */}
                <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                    <Button variant="contained" startIcon={<Add />} onClick={() => setProjectDialog(true)}>
                        Nuevo Proyecto
                    </Button>
                    <Button variant="outlined" startIcon={<Settings />} onClick={() => navigate('/admin/catalogs')}
                        color="secondary">
                        Catálogos
                    </Button>
                </Stack>

                {/* Projects list */}
                <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>Proyectos</Typography>
                <Grid container spacing={2}>
                    {projects.length === 0 ? (
                        <Grid item xs={12}>
                            <Card sx={{ p: 4, textAlign: 'center' }}>
                                <FolderOpen sx={{ fontSize: 64, color: '#d1d5db', mb: 1 }} />
                                <Typography color="text.secondary">No hay proyectos aún</Typography>
                            </Card>
                        </Grid>
                    ) : (
                        projects.map((project) => (
                            <Grid item xs={12} sm={6} md={4} key={project.project_id}>
                                <Card sx={{ cursor: 'pointer', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 } }}
                                    onClick={() => navigate(`/admin/project/${project.project_id}`)}>
                                    <CardContent>
                                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                                            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: 16 }}>{project.name}</Typography>
                                            <Chip label={statusLabels[project.status] || project.status} color={statusColors[project.status] || 'default'} size="small" />
                                        </Stack>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
                                            {project.description || 'Sin descripción'}
                                        </Typography>
                                        <Divider sx={{ my: 1 }} />
                                        <Stack direction="row" justifyContent="space-between">
                                            <Typography variant="caption" color="text.secondary">
                                                {project.pdfs?.length || 0} PDFs
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {new Date(project.created_at).toLocaleDateString('es-ES')}
                                            </Typography>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))
                    )}
                </Grid>



            </Box>

            {/* Create Project Dialog */}
            <Dialog open={projectDialog} onClose={() => setProjectDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Nuevo Proyecto</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField label="Nombre" value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} fullWidth />
                        <TextField label="Descripción" value={newProject.description} onChange={(e) => setNewProject({ ...newProject, description: e.target.value })} fullWidth multiline rows={2} />
                        <FormControl fullWidth>
                            <InputLabel>Cliente asignado</InputLabel>
                            <Select value={newProject.client_user_id} label="Cliente asignado" onChange={(e) => setNewProject({ ...newProject, client_user_id: e.target.value })}>
                                {clients.map((c) => (
                                    <MenuItem key={c.user_id} value={c.user_id}>{c.full_name || c.username}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setProjectDialog(false)}>Cancelar</Button>
                    <Button variant="contained" onClick={handleCreateProject} disabled={!newProject.name || !newProject.client_user_id}>Crear</Button>
                </DialogActions>
            </Dialog>


            {/* Invite Dialog */}
            <Dialog open={inviteDialog} onClose={() => { setInviteDialog(false); setInviteResult(null) }} maxWidth="sm" fullWidth>
                <DialogTitle>Enviar Invitación</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField label="Mensaje personalizado (opcional)" value={inviteData.custom_message} onChange={(e) => setInviteData({ ...inviteData, custom_message: e.target.value })} fullWidth multiline rows={2} />
                        <TextField label="Horas de validez" type="number" value={inviteData.expiry_hours} onChange={(e) => setInviteData({ ...inviteData, expiry_hours: parseInt(e.target.value) || 72 })} fullWidth />
                    </Stack>
                    {inviteResult && (
                        <Alert severity="success" sx={{ mt: 2 }} action={
                            <IconButton size="small" onClick={() => copyToClipboard(inviteResult.magic_url)}>
                                <ContentCopy fontSize="small" />
                            </IconButton>
                        }>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>Magic Link generado</Typography>
                            <Typography variant="caption" sx={{ wordBreak: 'break-all', display: 'block', mt: 0.5 }}>
                                {inviteResult.magic_url}
                            </Typography>
                        </Alert>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setInviteDialog(false); setInviteResult(null) }}>Cerrar</Button>
                    {!inviteResult && (
                        <Button variant="contained" startIcon={<Email />} onClick={handleInvite}>Enviar</Button>
                    )}
                </DialogActions>
            </Dialog>

            {/* Snackbar */}
            <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    )
}

export default AdminDashboard
