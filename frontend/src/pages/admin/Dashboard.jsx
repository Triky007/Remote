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
    AdminPanelSettings, CalendarViewWeek, FileUpload
} from '@mui/icons-material'

const statusColors = {
    pending: 'default', reviewing: 'info', client_approved: 'warning', approved: 'success', rejected: 'error', completed: 'primary'
}
const statusLabels = {
    pending: 'Pendiente', reviewing: 'En revisión', client_approved: 'Aprobado Cliente', approved: 'En producción', rejected: 'Rechazado', completed: 'Completado'
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
    const [newProject, setNewProject] = useState({
        name: '', description: '', client_user_id: '',
        copies: '', product: '', size: 'A4', colors: '4/4', binding: 'none', paper: '', pages: '', paper_size: '1000x700'
    })
    const [importedProcesses, setImportedProcesses] = useState([])
    const [inviteData, setInviteData] = useState({ custom_message: '', expiry_hours: 72 })
    const [inviteResult, setInviteResult] = useState(null)

    // Menu
    const [anchorEl, setAnchorEl] = useState(null)
    const [machines, setMachines] = useState([])
    const [processCatalog, setProcessCatalog] = useState([])

    const loadData = useCallback(async () => {
        try {
            const [projRes, clientRes, machRes, catRes] = await Promise.all([
                api.get('/projects'),
                api.get('/users/clients'),
                api.get('/machines?active_only=true'),
                api.get('/process-catalog?active_only=true'),
            ])
            setProjects(projRes.data)
            setClients(clientRes.data)
            setMachines(machRes.data)
            setProcessCatalog(catRes.data)
        } catch (err) {
            setError('Error cargando datos')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    const handleCreateProject = async () => {
        try {
            const res = await api.post('/projects', {
                name: newProject.name,
                description: newProject.description,
                client_user_id: newProject.client_user_id,
                product_info: {
                    copies: parseInt(newProject.copies) || 0,
                    pages: parseInt(newProject.pages) || 0,
                    product: newProject.product,
                    size: newProject.size,
                    colors: newProject.colors,
                    binding: newProject.binding,
                    paper: newProject.paper,
                    paper_size: newProject.paper_size,
                }
            })
            const projectId = res.data?.project?.project_id

            // Auto-create imported processes
            if (projectId && importedProcesses.length > 0) {
                let created = 0
                for (const proc of importedProcesses) {
                    try {
                        // Resolve machine by name if not a valid UUID
                        let machineId = proc.machine_id || null
                        if (machineId && !machineId.match(/^[0-9a-f-]{36}$/i)) {
                            const match = machines.find(m => m.name.toLowerCase().includes(machineId.toLowerCase()))
                            machineId = match?.machine_id || null
                        }
                        // Resolve process type by name if not a valid UUID
                        let processTypeId = proc.process_type_id || ''
                        if (processTypeId && !processTypeId.match(/^[0-9a-f-]{36}$/i)) {
                            const match = processCatalog.find(p => p.name.toLowerCase().includes(processTypeId.toLowerCase()))
                            processTypeId = match?.process_type_id || processTypeId
                        }
                        await api.post(`/projects/${projectId}/processes`, {
                            process_type_id: processTypeId,
                            name: proc.name || 'Proceso',
                            machine_id: machineId,
                            estimated_hours: proc.estimated_hours || 1,
                            priority: proc.priority || 1,
                            notes: proc.notes || '',
                            fold_schemes: proc.fold_schemes || [],
                        })
                        created++
                    } catch (e) {
                        console.error('Error creando proceso:', e)
                    }
                }
                if (created > 0) {
                    setSnackbar({ open: true, message: `Proyecto creado con ${created} proceso(s)`, severity: 'success' })
                } else {
                    setSnackbar({ open: true, message: 'Proyecto creado (error en procesos)', severity: 'warning' })
                }
            } else {
                setSnackbar({ open: true, message: 'Proyecto creado', severity: 'success' })
            }

            setProjectDialog(false)
            setNewProject({
                name: '', description: '', client_user_id: '',
                copies: '', product: '', size: 'A4', colors: '4/4', binding: 'none', paper: '', pages: '', paper_size: '1000x700'
            })
            setImportedProcesses([])
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

    const handleImportJson = (event) => {
        const file = event.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result)
                const pi = data.product_info || {}
                // Try to match client by company_name
                let clientId = data.client_user_id || ''
                if (!clientId && data.client_info?.company_name) {
                    const match = clients.find(c =>
                        (c.full_name || '').toLowerCase().includes(data.client_info.company_name.toLowerCase()) ||
                        (c.username || '').toLowerCase().includes(data.client_info.company_name.toLowerCase())
                    )
                    if (match) clientId = match.user_id
                }
                setNewProject({
                    name: data.name || '',
                    description: data.description || '',
                    client_user_id: clientId,
                    product: pi.product || '',
                    copies: pi.copies || '',
                    pages: pi.pages || '',
                    size: pi.size || 'A4',
                    colors: pi.colors || '4/4',
                    binding: pi.binding || 'none',
                    paper: pi.paper || '',
                    paper_size: pi.paper_size || '1000x700',
                })
                setSnackbar({ open: true, message: 'JSON importado correctamente', severity: 'success' })
                // Store processes for auto-creation
                if (Array.isArray(data.processes) && data.processes.length > 0) {
                    setImportedProcesses(data.processes)
                } else {
                    setImportedProcesses([])
                }
            } catch (err) {
                setSnackbar({ open: true, message: 'Error al leer el JSON: formato inválido', severity: 'error' })
            }
        }
        reader.readAsText(file)
        event.target.value = '' // reset for re-import
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
                    <Button variant="contained" startIcon={<CalendarViewWeek />}
                        onClick={() => navigate('/admin/planning')}
                        sx={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)' }}>
                        Planificación
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

            <Dialog open={projectDialog} onClose={() => setProjectDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        Nuevo Proyecto
                        <Button size="small" variant="outlined" startIcon={<FileUpload />} component="label">
                            Importar JSON
                            <input type="file" hidden accept=".json" onChange={handleImportJson} />
                        </Button>
                    </Stack>
                </DialogTitle>
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

                        <Divider sx={{ my: 1 }}><Typography variant="caption" color="text.secondary">Información del producto</Typography></Divider>

                        <Stack direction="row" spacing={2}>
                            <TextField label="Producto" value={newProject.product}
                                onChange={(e) => setNewProject({ ...newProject, product: e.target.value })}
                                fullWidth placeholder="Ej: Folleto, Libro, Tarjeta..." />
                            <TextField label="Ejemplares" type="number" value={newProject.copies}
                                onChange={(e) => setNewProject({ ...newProject, copies: e.target.value })}
                                sx={{ minWidth: 120 }} inputProps={{ min: 1 }} />
                            <TextField label="Páginas" type="number" value={newProject.pages}
                                onChange={(e) => setNewProject({ ...newProject, pages: e.target.value })}
                                sx={{ minWidth: 100 }} inputProps={{ min: 1 }} />
                        </Stack>
                        <Stack direction="row" spacing={2}>
                            <FormControl fullWidth>
                                <InputLabel>Tamaño</InputLabel>
                                <Select value={newProject.size} label="Tamaño"
                                    onChange={(e) => setNewProject({ ...newProject, size: e.target.value })}>
                                    <MenuItem value="A5">A5 (148×210 mm)</MenuItem>
                                    <MenuItem value="A4">A4 (210×297 mm)</MenuItem>
                                    <MenuItem value="A3">A3 (297×420 mm)</MenuItem>
                                    <MenuItem value="A2">A2 (420×594 mm)</MenuItem>
                                    <MenuItem value="Carta">Carta (216×279 mm)</MenuItem>
                                    <MenuItem value="Personalizado">Personalizado</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl fullWidth>
                                <InputLabel>Colores</InputLabel>
                                <Select value={newProject.colors} label="Colores"
                                    onChange={(e) => setNewProject({ ...newProject, colors: e.target.value })}>
                                    <MenuItem value="4/4">4/4 (Color ambas caras)</MenuItem>
                                    <MenuItem value="4/1">4/1 (Color / B&N)</MenuItem>
                                    <MenuItem value="4/0">4/0 (Color una cara)</MenuItem>
                                    <MenuItem value="1/1">1/1 (B&N ambas caras)</MenuItem>
                                    <MenuItem value="1/0">1/0 (B&N una cara)</MenuItem>
                                </Select>
                            </FormControl>
                        </Stack>
                        <Stack direction="row" spacing={2}>
                            <FormControl fullWidth>
                                <InputLabel>Encuadernación</InputLabel>
                                <Select value={newProject.binding} label="Encuadernación"
                                    onChange={(e) => setNewProject({ ...newProject, binding: e.target.value })}>
                                    <MenuItem value="none">Sin encuadernación</MenuItem>
                                    <MenuItem value="stapled">Grapado</MenuItem>
                                    <MenuItem value="perfect">Fresado (Hot-melt)</MenuItem>
                                    <MenuItem value="sewn">Cosido</MenuItem>
                                    <MenuItem value="spiral">Espiral</MenuItem>
                                    <MenuItem value="wire-o">Wire-O</MenuItem>
                                </Select>
                            </FormControl>
                            <TextField label="Papel" value={newProject.paper}
                                onChange={(e) => setNewProject({ ...newProject, paper: e.target.value })}
                                fullWidth placeholder="Ej: Estucado 135g" />
                            <FormControl sx={{ minWidth: 150 }}>
                                <InputLabel>Tamaño papel</InputLabel>
                                <Select value={newProject.paper_size} label="Tamaño papel"
                                    onChange={(e) => setNewProject({ ...newProject, paper_size: e.target.value })}>
                                    <MenuItem value="1000x700">1000×700</MenuItem>
                                    <MenuItem value="950x650">950×650</MenuItem>
                                    <MenuItem value="900x650">900×650</MenuItem>
                                </Select>
                            </FormControl>
                        </Stack>
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
