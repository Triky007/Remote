import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/apiService'
import {
    Box, Typography, Button, Card, CardContent, Grid, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack,
    AppBar, Toolbar, IconButton, Menu, MenuItem, Alert, CircularProgress,
    Select, FormControl, InputLabel, Divider, Snackbar, Tabs, Tab,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, Tooltip, Switch, FormControlLabel, Checkbox, ListItemText,
    OutlinedInput
} from '@mui/material'
import {
    Add, Logout, Person, ArrowBack, Edit, Delete,
    PrecisionManufacturing, People, AccountTree, Save, Close
} from '@mui/icons-material'

// ─── Constants ───────────────────────────────────────────────────────────────

const MACHINE_TYPES = [
    { value: 'offset', label: 'Offset' },
    { value: 'digital', label: 'Digital' },
    { value: 'finishing', label: 'Acabado' },
    { value: 'cnc', label: 'CNC' },
    { value: 'laser', label: 'Láser' },
    { value: 'plotter', label: 'Plotter' },
    { value: 'other', label: 'Otro' },
]

const PROCESS_CATEGORIES = [
    { value: 'design', label: 'Diseño', color: '#4A90D9' },
    { value: 'prepress', label: 'Preimpresión', color: '#7B68EE' },
    { value: 'printing', label: 'Impresión', color: '#50C878' },
    { value: 'finishing', label: 'Acabado', color: '#E74C3C' },
    { value: 'shipping', label: 'Envío', color: '#1ABC9C' },
    { value: 'other', label: 'Otro', color: '#95A5A6' },
]

// ─── Machine Form Dialog ─────────────────────────────────────────────────────

const MachineDialog = ({ open, onClose, onSave, machine }) => {
    const [form, setForm] = useState({ name: '', type: 'other', description: '' })

    useEffect(() => {
        if (machine) {
            setForm({ name: machine.name, type: machine.type, description: machine.description || '' })
        } else {
            setForm({ name: '', type: 'other', description: '' })
        }
    }, [machine, open])

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{machine ? 'Editar Máquina' : 'Nueva Máquina'}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField label="Nombre" value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
                    <FormControl fullWidth>
                        <InputLabel>Tipo</InputLabel>
                        <Select value={form.type} label="Tipo"
                            onChange={(e) => setForm({ ...form, type: e.target.value })}>
                            {MACHINE_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <TextField label="Descripción" value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })} fullWidth multiline rows={2} />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancelar</Button>
                <Button variant="contained" onClick={() => onSave(form)} disabled={!form.name}
                    startIcon={<Save />}>Guardar</Button>
            </DialogActions>
        </Dialog>
    )
}

// ─── Client Form Dialog ──────────────────────────────────────────────────────

const ClientDialog = ({ open, onClose, onSave, client }) => {
    const isEdit = !!client
    const [form, setForm] = useState({
        username: '', password: '', email: '', full_name: '',
        company_name: '', cif: '', notification_email: '', address: '',
        city: '', postal_code: '', phone: '', contact_person: '', notes: ''
    })

    useEffect(() => {
        if (client) {
            setForm({
                username: client.username || '', password: '', email: client.email || '',
                full_name: client.full_name || '', company_name: client.company_name || '',
                cif: client.cif || '', notification_email: client.notification_email || '',
                address: client.address || '', city: client.city || '',
                postal_code: client.postal_code || '', phone: client.phone || '',
                contact_person: client.contact_person || '', notes: client.notes || ''
            })
        } else {
            setForm({
                username: '', password: '', email: '', full_name: '',
                company_name: '', cif: '', notification_email: '', address: '',
                city: '', postal_code: '', phone: '', contact_person: '', notes: ''
            })
        }
    }, [client, open])

    const f = (field) => ({
        value: form[field],
        onChange: (e) => setForm({ ...form, [field]: e.target.value }),
        fullWidth: true,
    })

    const canSave = isEdit ? true : (form.username && form.password && form.email)

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{isEdit ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
            <DialogContent>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1, mb: 1 }}>Datos de acceso</Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                        <TextField label="Usuario" {...f('username')} disabled={isEdit} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField label={isEdit ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}
                            type="password" {...f('password')} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField label="Email (login)" {...f('email')} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField label="Nombre completo" {...f('full_name')} />
                    </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Ficha comercial</Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                        <TextField label="Empresa" {...f('company_name')} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField label="CIF" {...f('cif')} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField label="Email notificaciones" {...f('notification_email')} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField label="Persona de contacto" {...f('contact_person')} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField label="Teléfono" {...f('phone')} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField label="Código postal" {...f('postal_code')} />
                    </Grid>
                    <Grid item xs={12} sm={8}>
                        <TextField label="Dirección" {...f('address')} />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <TextField label="Ciudad" {...f('city')} />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField label="Notas" {...f('notes')} multiline rows={2} />
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancelar</Button>
                <Button variant="contained" onClick={() => onSave(form)} disabled={!canSave}
                    startIcon={<Save />}>Guardar</Button>
            </DialogActions>
        </Dialog>
    )
}

// ─── Process Type Form Dialog ────────────────────────────────────────────────

const ProcessTypeDialog = ({ open, onClose, onSave, processType }) => {
    const [form, setForm] = useState({
        name: '', category: 'other', default_estimated_hours: 1,
        requires_machine: false, allowed_machine_types: [], color: '#95A5A6', icon: 'settings'
    })

    useEffect(() => {
        if (processType) {
            setForm({
                name: processType.name, category: processType.category,
                default_estimated_hours: processType.default_estimated_hours,
                requires_machine: processType.requires_machine,
                allowed_machine_types: processType.allowed_machine_types || [],
                color: processType.color || '#95A5A6', icon: processType.icon || 'settings'
            })
        } else {
            setForm({
                name: '', category: 'other', default_estimated_hours: 1,
                requires_machine: false, allowed_machine_types: [], color: '#95A5A6', icon: 'settings'
            })
        }
    }, [processType, open])

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{processType ? 'Editar Plantilla' : 'Nueva Plantilla de Proceso'}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField label="Nombre" value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
                    <FormControl fullWidth>
                        <InputLabel>Categoría</InputLabel>
                        <Select value={form.category} label="Categoría"
                            onChange={(e) => setForm({ ...form, category: e.target.value })}>
                            {PROCESS_CATEGORIES.map(c =>
                                <MenuItem key={c.value} value={c.value}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: c.color }} />
                                        {c.label}
                                    </Box>
                                </MenuItem>
                            )}
                        </Select>
                    </FormControl>
                    <TextField label="Horas estimadas por defecto" type="number" value={form.default_estimated_hours}
                        onChange={(e) => setForm({ ...form, default_estimated_hours: parseFloat(e.target.value) || 1 })}
                        fullWidth inputProps={{ min: 0.25, step: 0.25 }} />
                    <Stack direction="row" alignItems="center" spacing={2}>
                        <TextField label="Color" type="color" value={form.color}
                            onChange={(e) => setForm({ ...form, color: e.target.value })}
                            sx={{ width: 120 }} inputProps={{ style: { height: 32 } }} />
                        <FormControlLabel
                            control={<Switch checked={form.requires_machine}
                                onChange={(e) => setForm({ ...form, requires_machine: e.target.checked })} />}
                            label="Requiere máquina"
                        />
                    </Stack>
                    {form.requires_machine && (
                        <FormControl fullWidth>
                            <InputLabel>Tipos de máquina permitidos</InputLabel>
                            <Select multiple value={form.allowed_machine_types}
                                onChange={(e) => setForm({ ...form, allowed_machine_types: e.target.value })}
                                input={<OutlinedInput label="Tipos de máquina permitidos" />}
                                renderValue={(sel) => sel.map(v => MACHINE_TYPES.find(t => t.value === v)?.label || v).join(', ')}>
                                {MACHINE_TYPES.map(t => (
                                    <MenuItem key={t.value} value={t.value}>
                                        <Checkbox checked={form.allowed_machine_types.includes(t.value)} />
                                        <ListItemText primary={t.label} />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancelar</Button>
                <Button variant="contained" onClick={() => onSave(form)} disabled={!form.name}
                    startIcon={<Save />}>Guardar</Button>
            </DialogActions>
        </Dialog>
    )
}

// ─── Confirm Delete Dialog ───────────────────────────────────────────────────

const ConfirmDialog = ({ open, onClose, onConfirm, title, message }) => (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent><Typography>{message}</Typography></DialogContent>
        <DialogActions>
            <Button onClick={onClose}>Cancelar</Button>
            <Button variant="contained" color="error" onClick={onConfirm}>Eliminar</Button>
        </DialogActions>
    </Dialog>
)

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════

const CatalogPage = () => {
    const { user, logout } = useAuth()
    const navigate = useNavigate()
    const [tab, setTab] = useState(0)
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
    const [anchorEl, setAnchorEl] = useState(null)

    // ── Machines state ──
    const [machines, setMachines] = useState([])
    const [machineDialog, setMachineDialog] = useState(false)
    const [editMachine, setEditMachine] = useState(null)
    const [deleteMachine, setDeleteMachine] = useState(null)

    // ── Clients state ──
    const [clients, setClients] = useState([])
    const [clientDialog, setClientDialog] = useState(false)
    const [editClient, setEditClient] = useState(null)
    const [deleteClient, setDeleteClient] = useState(null)

    // ── Process Types state ──
    const [processTypes, setProcessTypes] = useState([])
    const [processDialog, setProcessDialog] = useState(false)
    const [editProcess, setEditProcess] = useState(null)
    const [deleteProcess, setDeleteProcess] = useState(null)

    const [loading, setLoading] = useState(true)

    const showSnack = (message, severity = 'success') => setSnackbar({ open: true, message, severity })

    // ── Load data ──
    const loadAll = useCallback(async () => {
        try {
            const [mRes, cRes, pRes] = await Promise.all([
                api.get('/machines'),
                api.get('/clients'),
                api.get('/process-catalog'),
            ])
            setMachines(mRes.data)
            setClients(cRes.data)
            setProcessTypes(pRes.data)
        } catch (err) {
            showSnack('Error cargando catálogos', 'error')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadAll() }, [loadAll])

    // ── Machine handlers ──
    const handleSaveMachine = async (form) => {
        try {
            if (editMachine) {
                await api.put(`/machines/${editMachine.machine_id}`, form)
                showSnack('Máquina actualizada')
            } else {
                await api.post('/machines', form)
                showSnack('Máquina creada')
            }
            setMachineDialog(false)
            setEditMachine(null)
            loadAll()
        } catch (err) {
            showSnack(err.response?.data?.detail || 'Error', 'error')
        }
    }

    const handleDeleteMachine = async () => {
        try {
            await api.delete(`/machines/${deleteMachine.machine_id}`)
            showSnack('Máquina eliminada')
            setDeleteMachine(null)
            loadAll()
        } catch (err) {
            showSnack(err.response?.data?.detail || 'Error', 'error')
        }
    }

    // ── Client handlers ──
    const handleSaveClient = async (form) => {
        try {
            if (editClient) {
                const data = { ...form }
                if (!data.password) delete data.password
                await api.put(`/clients/${editClient.client_id}`, data)
                showSnack('Cliente actualizado')
            } else {
                await api.post('/clients', form)
                showSnack('Cliente creado')
            }
            setClientDialog(false)
            setEditClient(null)
            loadAll()
        } catch (err) {
            showSnack(err.response?.data?.detail || 'Error', 'error')
        }
    }

    const handleDeleteClient = async () => {
        try {
            await api.delete(`/clients/${deleteClient.client_id}`)
            showSnack('Cliente eliminado')
            setDeleteClient(null)
            loadAll()
        } catch (err) {
            showSnack(err.response?.data?.detail || 'Error', 'error')
        }
    }

    // ── Process Type handlers ──
    const handleSaveProcess = async (form) => {
        try {
            if (editProcess) {
                await api.put(`/process-catalog/${editProcess.process_type_id}`, form)
                showSnack('Plantilla actualizada')
            } else {
                await api.post('/process-catalog', form)
                showSnack('Plantilla creada')
            }
            setProcessDialog(false)
            setEditProcess(null)
            loadAll()
        } catch (err) {
            showSnack(err.response?.data?.detail || 'Error', 'error')
        }
    }

    const handleDeleteProcess = async () => {
        try {
            await api.delete(`/process-catalog/${deleteProcess.process_type_id}`)
            showSnack('Plantilla eliminada')
            setDeleteProcess(null)
            loadAll()
        } catch (err) {
            showSnack(err.response?.data?.detail || 'Error', 'error')
        }
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
                    <IconButton color="inherit" onClick={() => navigate('/admin')} sx={{ mr: 1 }}>
                        <ArrowBack />
                    </IconButton>
                    <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
                        ⚙️ Catálogos
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
                        <MenuItem onClick={() => { logout(); navigate('/login') }}>
                            <Logout sx={{ mr: 1 }} fontSize="small" /> Cerrar sesión
                        </MenuItem>
                    </Menu>
                </Toolbar>
            </AppBar>

            {/* Content */}
            <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
                {/* Tabs */}
                <Paper sx={{ mb: 3 }}>
                    <Tabs value={tab} onChange={(_, v) => setTab(v)}
                        sx={{ '& .MuiTab-root': { fontWeight: 600, textTransform: 'none', fontSize: 15 } }}>
                        <Tab icon={<PrecisionManufacturing />} iconPosition="start" label={`Máquinas (${machines.length})`} />
                        <Tab icon={<People />} iconPosition="start" label={`Clientes (${clients.length})`} />
                        <Tab icon={<AccountTree />} iconPosition="start" label={`Procesos (${processTypes.length})`} />
                    </Tabs>
                </Paper>

                {/* ═══ Tab 0: Machines ═══ */}
                {tab === 0 && (
                    <>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                            <Typography variant="h5" sx={{ fontWeight: 600 }}>Catálogo de Máquinas</Typography>
                            <Button variant="contained" startIcon={<Add />}
                                onClick={() => { setEditMachine(null); setMachineDialog(true) }}>
                                Nueva Máquina
                            </Button>
                        </Stack>
                        <TableContainer component={Paper}>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#f8fafc' } }}>
                                        <TableCell>Nombre</TableCell>
                                        <TableCell>Tipo</TableCell>
                                        <TableCell>Descripción</TableCell>
                                        <TableCell>Estado</TableCell>
                                        <TableCell align="right">Acciones</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {machines.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                                No hay máquinas. Crea la primera.
                                            </TableCell>
                                        </TableRow>
                                    ) : machines.map(m => (
                                        <TableRow key={m.machine_id} hover>
                                            <TableCell sx={{ fontWeight: 600 }}>{m.name}</TableCell>
                                            <TableCell>
                                                <Chip label={MACHINE_TYPES.find(t => t.value === m.type)?.label || m.type}
                                                    size="small" variant="outlined" />
                                            </TableCell>
                                            <TableCell sx={{ color: 'text.secondary' }}>{m.description || '—'}</TableCell>
                                            <TableCell>
                                                <Chip label={m.active ? 'Activa' : 'Inactiva'} size="small"
                                                    color={m.active ? 'success' : 'default'} />
                                            </TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="Editar">
                                                    <IconButton size="small" onClick={() => { setEditMachine(m); setMachineDialog(true) }}>
                                                        <Edit fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Eliminar">
                                                    <IconButton size="small" color="error" onClick={() => setDeleteMachine(m)}>
                                                        <Delete fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </>
                )}

                {/* ═══ Tab 1: Clients ═══ */}
                {tab === 1 && (
                    <>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                            <Typography variant="h5" sx={{ fontWeight: 600 }}>Catálogo de Clientes</Typography>
                            <Button variant="contained" startIcon={<Add />}
                                onClick={() => { setEditClient(null); setClientDialog(true) }}>
                                Nuevo Cliente
                            </Button>
                        </Stack>
                        <TableContainer component={Paper}>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#f8fafc' } }}>
                                        <TableCell>Empresa</TableCell>
                                        <TableCell>Contacto</TableCell>
                                        <TableCell>Email</TableCell>
                                        <TableCell>Teléfono</TableCell>
                                        <TableCell>Ciudad</TableCell>
                                        <TableCell align="right">Acciones</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {clients.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                                No hay clientes. Crea el primero.
                                            </TableCell>
                                        </TableRow>
                                    ) : clients.map(c => (
                                        <TableRow key={c.client_id} hover>
                                            <TableCell sx={{ fontWeight: 600 }}>{c.company_name || c.full_name || c.username}</TableCell>
                                            <TableCell>{c.contact_person || c.full_name || '—'}</TableCell>
                                            <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>
                                                {c.notification_email || c.email || '—'}
                                            </TableCell>
                                            <TableCell>{c.phone || '—'}</TableCell>
                                            <TableCell>{c.city || '—'}</TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="Editar">
                                                    <IconButton size="small" onClick={() => { setEditClient(c); setClientDialog(true) }}>
                                                        <Edit fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Eliminar">
                                                    <IconButton size="small" color="error" onClick={() => setDeleteClient(c)}>
                                                        <Delete fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </>
                )}

                {/* ═══ Tab 2: Process Types ═══ */}
                {tab === 2 && (
                    <>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                            <Typography variant="h5" sx={{ fontWeight: 600 }}>Catálogo de Procesos</Typography>
                            <Button variant="contained" startIcon={<Add />}
                                onClick={() => { setEditProcess(null); setProcessDialog(true) }}>
                                Nueva Plantilla
                            </Button>
                        </Stack>
                        <TableContainer component={Paper}>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#f8fafc' } }}>
                                        <TableCell>Nombre</TableCell>
                                        <TableCell>Categoría</TableCell>
                                        <TableCell>Horas est.</TableCell>
                                        <TableCell>Máquina</TableCell>
                                        <TableCell>Estado</TableCell>
                                        <TableCell align="right">Acciones</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {processTypes.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                                No hay plantillas. Crea la primera.
                                            </TableCell>
                                        </TableRow>
                                    ) : processTypes.map(p => {
                                        const cat = PROCESS_CATEGORIES.find(c => c.value === p.category)
                                        return (
                                            <TableRow key={p.process_type_id} hover>
                                                <TableCell>
                                                    <Stack direction="row" alignItems="center" spacing={1}>
                                                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: p.color || '#ccc' }} />
                                                        <Typography sx={{ fontWeight: 600 }}>{p.name}</Typography>
                                                    </Stack>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip label={cat?.label || p.category} size="small" variant="outlined"
                                                        sx={{ borderColor: cat?.color, color: cat?.color }} />
                                                </TableCell>
                                                <TableCell>{p.default_estimated_hours}h</TableCell>
                                                <TableCell>
                                                    {p.requires_machine ? (
                                                        <Chip label={p.allowed_machine_types?.length
                                                            ? p.allowed_machine_types.map(t => MACHINE_TYPES.find(mt => mt.value === t)?.label || t).join(', ')
                                                            : 'Cualquiera'} size="small" color="info" variant="outlined" />
                                                    ) : <Typography variant="caption" color="text.secondary">No</Typography>}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip label={p.active ? 'Activa' : 'Inactiva'} size="small"
                                                        color={p.active ? 'success' : 'default'} />
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Tooltip title="Editar">
                                                        <IconButton size="small" onClick={() => { setEditProcess(p); setProcessDialog(true) }}>
                                                            <Edit fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Eliminar">
                                                        <IconButton size="small" color="error" onClick={() => setDeleteProcess(p)}>
                                                            <Delete fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </>
                )}
            </Box>

            {/* Dialogs */}
            <MachineDialog open={machineDialog} onClose={() => { setMachineDialog(false); setEditMachine(null) }}
                onSave={handleSaveMachine} machine={editMachine} />
            <ClientDialog open={clientDialog} onClose={() => { setClientDialog(false); setEditClient(null) }}
                onSave={handleSaveClient} client={editClient} />
            <ProcessTypeDialog open={processDialog} onClose={() => { setProcessDialog(false); setEditProcess(null) }}
                onSave={handleSaveProcess} processType={editProcess} />

            <ConfirmDialog open={!!deleteMachine} onClose={() => setDeleteMachine(null)} onConfirm={handleDeleteMachine}
                title="Eliminar máquina" message={`¿Eliminar "${deleteMachine?.name}"?`} />
            <ConfirmDialog open={!!deleteClient} onClose={() => setDeleteClient(null)} onConfirm={handleDeleteClient}
                title="Eliminar cliente" message={`¿Eliminar "${deleteClient?.company_name || deleteClient?.username}"? Se eliminará también el usuario.`} />
            <ConfirmDialog open={!!deleteProcess} onClose={() => setDeleteProcess(null)} onConfirm={handleDeleteProcess}
                title="Eliminar plantilla" message={`¿Eliminar "${deleteProcess?.name}"?`} />

            {/* Snackbar */}
            <Snackbar open={snackbar.open} autoHideDuration={4000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    )
}

export default CatalogPage
