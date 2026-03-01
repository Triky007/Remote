import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/apiService'
import {
    Box, Typography, Button, Card, CardContent, CardActions, Grid, Stack,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField, Avatar,
    IconButton, Tooltip, Snackbar, Alert, AppBar, Toolbar, Chip
} from '@mui/material'
import { ArrowBack, PersonAdd, Edit, Delete, AdminPanelSettings } from '@mui/icons-material'

const AdminUsersPage = () => {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [admins, setAdmins] = useState([])
    const [loading, setLoading] = useState(true)

    // Dialog
    const [adminDialog, setAdminDialog] = useState(false)
    const [editingAdmin, setEditingAdmin] = useState(null)
    const [deleteAdminId, setDeleteAdminId] = useState(null)
    const [adminForm, setAdminForm] = useState({ username: '', password: '', email: '', full_name: '' })
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })

    const loadAdmins = useCallback(async () => {
        try {
            const res = await api.get('/users')
            setAdmins(res.data.filter(u => u.role === 'admin'))
        } catch {
            setSnackbar({ open: true, message: 'Error cargando administradores', severity: 'error' })
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadAdmins() }, [loadAdmins])

    const openDialog = (admin = null) => {
        if (admin) {
            setEditingAdmin(admin)
            setAdminForm({ username: admin.username, password: '', email: admin.email || '', full_name: admin.full_name || '' })
        } else {
            setEditingAdmin(null)
            setAdminForm({ username: '', password: '', email: '', full_name: '' })
        }
        setAdminDialog(true)
    }

    const handleSave = async () => {
        try {
            if (editingAdmin) {
                const data = {}
                if (adminForm.full_name) data.full_name = adminForm.full_name
                if (adminForm.email) data.email = adminForm.email
                if (adminForm.password) data.password = adminForm.password
                await api.put(`/users/${editingAdmin.user_id}`, data)
            } else {
                await api.post('/users', { ...adminForm, role: 'admin' })
            }
            setAdminDialog(false)
            setSnackbar({ open: true, message: editingAdmin ? 'Admin actualizado' : 'Admin creado', severity: 'success' })
            loadAdmins()
        } catch (err) {
            setSnackbar({ open: true, message: err.response?.data?.detail || 'Error', severity: 'error' })
        }
    }

    const handleDelete = async () => {
        try {
            await api.delete(`/users/${deleteAdminId}`)
            setDeleteAdminId(null)
            setSnackbar({ open: true, message: 'Admin eliminado', severity: 'success' })
            loadAdmins()
        } catch (err) {
            setSnackbar({ open: true, message: err.response?.data?.detail || 'Error', severity: 'error' })
        }
    }

    return (
        <Box sx={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
            <AppBar position="sticky" sx={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)' }}>
                <Toolbar>
                    <IconButton color="inherit" onClick={() => navigate('/admin')} sx={{ mr: 1 }}>
                        <ArrowBack />
                    </IconButton>
                    <AdminPanelSettings sx={{ mr: 1 }} />
                    <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
                        Gestionar Administradores
                    </Typography>
                    <Chip label={`${admins.length} admin${admins.length !== 1 ? 's' : ''}`} color="warning" size="small" />
                </Toolbar>
            </AppBar>

            <Box sx={{ maxWidth: 900, mx: 'auto', p: 3 }}>
                <Stack direction="row" justifyContent="flex-end" sx={{ mb: 3 }}>
                    <Button variant="contained" startIcon={<PersonAdd />} onClick={() => openDialog()}>
                        Nuevo Administrador
                    </Button>
                </Stack>

                <Grid container spacing={2}>
                    {admins.map((admin) => (
                        <Grid item xs={12} sm={6} md={4} key={admin.user_id}>
                            <Card sx={{ transition: 'all 0.2s', '&:hover': { boxShadow: 4 } }}>
                                <CardContent>
                                    <Stack direction="row" alignItems="center" spacing={2}>
                                        <Avatar sx={{ bgcolor: '#7c3aed', width: 48, height: 48, fontSize: 20 }}>
                                            {(admin.full_name || admin.username)[0].toUpperCase()}
                                        </Avatar>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                                {admin.full_name || admin.username}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                @{admin.username}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {admin.email || 'Sin email'}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </CardContent>
                                <CardActions>
                                    <Tooltip title="Editar">
                                        <IconButton size="small" onClick={() => openDialog(admin)}>
                                            <Edit fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title={admin.user_id === user?.user_id ? 'No puedes eliminarte' : 'Eliminar'}>
                                        <span>
                                            <IconButton size="small" color="error"
                                                disabled={admin.user_id === user?.user_id}
                                                onClick={() => setDeleteAdminId(admin.user_id)}>
                                                <Delete fontSize="small" />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </CardActions>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </Box>

            {/* Create/Edit Dialog */}
            <Dialog open={adminDialog} onClose={() => setAdminDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editingAdmin ? 'Editar Administrador' : 'Nuevo Administrador'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField label="Nombre completo" value={adminForm.full_name}
                            onChange={(e) => setAdminForm({ ...adminForm, full_name: e.target.value })} fullWidth />
                        <TextField label="Usuario" value={adminForm.username}
                            onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })}
                            fullWidth disabled={!!editingAdmin} />
                        <TextField label="Email" type="email" value={adminForm.email}
                            onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} fullWidth />
                        <TextField label={editingAdmin ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}
                            type="password" value={adminForm.password}
                            onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} fullWidth />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAdminDialog(false)}>Cancelar</Button>
                    <Button variant="contained" onClick={handleSave}
                        disabled={!adminForm.username || (!editingAdmin && !adminForm.password)}>
                        {editingAdmin ? 'Guardar' : 'Crear'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirm */}
            <Dialog open={!!deleteAdminId} onClose={() => setDeleteAdminId(null)}>
                <DialogTitle>¿Eliminar administrador?</DialogTitle>
                <DialogContent>
                    <Typography>Esta acción no se puede deshacer.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteAdminId(null)}>Cancelar</Button>
                    <Button variant="contained" color="error" onClick={handleDelete}>Eliminar</Button>
                </DialogActions>
            </Dialog>

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

export default AdminUsersPage
