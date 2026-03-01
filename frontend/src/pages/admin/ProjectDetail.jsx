import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/apiService'
import PreflightResults from '../../components/PreflightResults'
import PdfPreview from '../../components/PdfPreview'
import XmfJsonViewer from '../../components/XmfJsonViewer'
import {
    Box, Typography, Button, Card, CardContent, Grid, Chip, Stack,
    TextField, Alert, CircularProgress, Divider, IconButton,
    Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem,
    FormControl, InputLabel, Paper, LinearProgress, Tooltip, Snackbar,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material'
import {
    ArrowBack, Upload, Search, Delete, Comment, Send, Description,
    CheckCircle, Warning, Error as ErrorIcon, Schedule, Add, Edit,
    PlayArrow, Stop, PrecisionManufacturing, CalendarMonth, Gavel,
    PrintOutlined as PrintIcon
} from '@mui/icons-material'

const statusColors = {
    pending: 'default', reviewing: 'info', client_approved: 'warning', approved: 'success', rejected: 'error', completed: 'primary'
}
const statusLabels = {
    pending: 'Pendiente', reviewing: 'En revisión', client_approved: 'Aprobado por Cliente', approved: 'Aprobado Producción', rejected: 'Rechazado', completed: 'Completado'
}
const preflightStatusIcons = {
    PASS: <CheckCircle sx={{ color: '#10b981' }} />,
    WARN: <Warning sx={{ color: '#f59e0b' }} />,
    FAIL: <ErrorIcon sx={{ color: '#ef4444' }} />,
    pending: <Schedule sx={{ color: '#9ca3af' }} />,
}

const processStatusLabels = {
    pending: 'Pendiente', in_progress: 'En proceso', completed: 'Completado', cancelled: 'Cancelado'
}
const processStatusColors = {
    pending: 'default', in_progress: 'info', completed: 'success', cancelled: 'error'
}

const AdminProjectDetail = () => {
    const { projectId } = useParams()
    const navigate = useNavigate()
    const [project, setProject] = useState(null)
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [preflightLoading, setPreflightLoading] = useState('')
    const [selectedPdf, setSelectedPdf] = useState(null)
    const [statusDialog, setStatusDialog] = useState(false)
    const [newStatus, setNewStatus] = useState('')
    const [comment, setComment] = useState('')
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })

    // Process management
    const [machines, setMachines] = useState([])
    const [processCatalog, setProcessCatalog] = useState([])
    const [addProcessDialog, setAddProcessDialog] = useState(false)
    const [editingProcess, setEditingProcess] = useState(null)
    const [newProcess, setNewProcess] = useState({ process_type_id: '', name: '', machine_id: '', estimated_hours: 1, priority: 1, start_date: '', end_date: '', fold_schemes: [] })
    const [showXmfViewer, setShowXmfViewer] = useState(false)

    // Edit project
    const [editProjectDialog, setEditProjectDialog] = useState(false)
    const [editProject, setEditProject] = useState({ name: '', description: '', product: '', copies: '', pages: '', size: 'A4', colors: '4/4', binding: 'none', paper: '', paper_size: 'A4' })

    const loadProject = useCallback(async () => {
        try {
            const [projRes, machRes, catRes] = await Promise.all([
                api.get(`/projects/${projectId}`),
                api.get('/machines?active_only=true'),
                api.get('/process-catalog?active_only=true'),
            ])
            setProject(projRes.data)
            setMachines(machRes.data)
            setProcessCatalog(catRes.data)
        } catch (err) {
            setSnackbar({ open: true, message: 'Error cargando proyecto', severity: 'error' })
        } finally {
            setLoading(false)
        }
    }, [projectId])

    useEffect(() => { loadProject() }, [loadProject])

    const handleUpload = async (event) => {
        const files = event.target.files
        if (!files.length) return

        setUploading(true)
        try {
            for (const file of files) {
                const formData = new FormData()
                formData.append('file', file)
                await api.post(`/projects/${projectId}/upload`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                })
            }
            setSnackbar({ open: true, message: `${files.length} PDF(s) subido(s)`, severity: 'success' })
            loadProject()
        } catch (err) {
            setSnackbar({ open: true, message: err.response?.data?.detail || 'Error subiendo', severity: 'error' })
        } finally {
            setUploading(false)
        }
    }

    const handlePreflight = async (filename) => {
        setPreflightLoading(filename)
        try {
            await api.post(`/projects/${projectId}/preflight/${filename}`)
            setSnackbar({ open: true, message: 'Preflight completado', severity: 'success' })
            loadProject()
        } catch (err) {
            setSnackbar({ open: true, message: 'Error en preflight', severity: 'error' })
        } finally {
            setPreflightLoading('')
        }
    }

    const handleDeletePdf = async (filename) => {
        try {
            await api.delete(`/projects/${projectId}/pdfs/${filename}`)
            setSnackbar({ open: true, message: 'PDF eliminado', severity: 'success' })
            if (selectedPdf?.filename === filename) setSelectedPdf(null)
            loadProject()
        } catch (err) {
            setSnackbar({ open: true, message: 'Error eliminando', severity: 'error' })
        }
    }

    const handleStatusChange = async () => {
        try {
            await api.put(`/projects/${projectId}/status`, { status: newStatus })
            setStatusDialog(false)
            setSnackbar({ open: true, message: 'Estado actualizado', severity: 'success' })
            loadProject()
        } catch (err) {
            setSnackbar({ open: true, message: 'Error', severity: 'error' })
        }
    }

    const handleAddComment = async () => {
        if (!comment.trim()) return
        try {
            await api.post(`/projects/${projectId}/comments`, {
                message: comment,
                pdf_filename: selectedPdf?.filename || null
            })
            setComment('')
            setSnackbar({ open: true, message: 'Comentario añadido', severity: 'success' })
            loadProject()
        } catch (err) {
            setSnackbar({ open: true, message: 'Error', severity: 'error' })
        }
    }

    // ── Process handlers ──
    const handleSelectCatalogProcess = (processTypeId) => {
        const cat = processCatalog.find(p => p.process_type_id === processTypeId)
        if (cat) {
            setNewProcess(prev => ({
                ...prev,
                process_type_id: processTypeId,
                name: cat.name,
                estimated_hours: cat.default_estimated_hours || 1,
                machine_id: '',
            }))
        }
    }

    // Check if selected machine is offset
    const selectedMachine = machines.find(m => m.machine_id === newProcess.machine_id)
    const isOffsetMachine = selectedMachine?.type === 'offset'

    // Check if project has offset processes (for XMF button)
    const hasOffsetProcess = (project?.processes || []).some(proc => {
        const m = machines.find(mm => mm.machine_id === proc.machine_id)
        return m?.type === 'offset'
    })

    const handleAddFoldScheme = () => {
        setNewProcess(prev => ({
            ...prev,
            fold_schemes: [...(prev.fold_schemes || []), { fold_catalog: 'F16', total_sheets: 1, is_duplex: false }]
        }))
    }

    const handleUpdateFoldScheme = (index, field, value) => {
        setNewProcess(prev => {
            const schemes = [...(prev.fold_schemes || [])]
            schemes[index] = { ...schemes[index], [field]: value }
            return { ...prev, fold_schemes: schemes }
        })
    }

    const handleRemoveFoldScheme = (index) => {
        setNewProcess(prev => ({
            ...prev,
            fold_schemes: (prev.fold_schemes || []).filter((_, i) => i !== index)
        }))
    }

    const handleAddProcess = async () => {
        try {
            if (editingProcess) {
                await api.put(`/projects/${projectId}/processes/${editingProcess.process_id}`, {
                    name: newProcess.name,
                    process_type_id: newProcess.process_type_id,
                    machine_id: newProcess.machine_id || null,
                    estimated_hours: parseFloat(newProcess.estimated_hours) || 1,
                    priority: parseInt(newProcess.priority) || 1,
                    start_date: newProcess.start_date || null,
                    end_date: newProcess.end_date || null,
                    fold_schemes: newProcess.fold_schemes || [],
                })
                setSnackbar({ open: true, message: 'Proceso actualizado', severity: 'success' })
            } else {
                await api.post(`/projects/${projectId}/processes`, {
                    ...newProcess,
                    machine_id: newProcess.machine_id || null,
                    estimated_hours: parseFloat(newProcess.estimated_hours) || 1,
                    priority: parseInt(newProcess.priority) || 1,
                })
                setSnackbar({ open: true, message: 'Proceso añadido', severity: 'success' })
            }
            setAddProcessDialog(false)
            setEditingProcess(null)
            setNewProcess({ process_type_id: '', name: '', machine_id: '', estimated_hours: 1, priority: 1, start_date: '', end_date: '', fold_schemes: [] })
            loadProject()
        } catch (err) {
            setSnackbar({ open: true, message: err.response?.data?.detail || 'Error', severity: 'error' })
        }
    }

    const openEditProcess = (proc) => {
        setEditingProcess(proc)
        setNewProcess({
            process_type_id: proc.process_type_id || '',
            name: proc.name,
            machine_id: proc.machine_id || '',
            estimated_hours: proc.estimated_hours || 1,
            priority: proc.priority || 1,
            start_date: proc.start_date ? proc.start_date.slice(0, 16) : '',
            end_date: proc.end_date ? proc.end_date.slice(0, 16) : '',
            fold_schemes: proc.fold_schemes || [],
        })
        setAddProcessDialog(true)
    }

    const handleDeleteProcess = async (processId) => {
        try {
            await api.delete(`/projects/${projectId}/processes/${processId}`)
            setSnackbar({ open: true, message: 'Proceso eliminado', severity: 'success' })
            loadProject()
        } catch (err) {
            setSnackbar({ open: true, message: 'Error', severity: 'error' })
        }
    }

    const handleProcessStatus = async (processId, newSt) => {
        try {
            await api.patch(`/projects/${projectId}/processes/${processId}/status`, { status: newSt })
            setSnackbar({ open: true, message: 'Estado actualizado', severity: 'success' })
            loadProject()
        } catch (err) {
            setSnackbar({ open: true, message: 'Error', severity: 'error' })
        }
    }

    const handleDeleteProject = async () => {
        if (!window.confirm('¿Eliminar este proyecto? Esta acción no se puede deshacer.')) return
        try {
            await api.delete(`/projects/${projectId}`)
            navigate('/admin')
        } catch (err) {
            setSnackbar({ open: true, message: 'Error al eliminar proyecto', severity: 'error' })
        }
    }

    const openEditProject = () => {
        const pi = project.product_info || {}
        setEditProject({
            name: project.name || '',
            description: project.description || '',
            product: pi.product || '',
            copies: pi.copies || '',
            pages: pi.pages || '',
            size: pi.size || 'A4',
            colors: pi.colors || '4/4',
            binding: pi.binding || 'none',
            paper: pi.paper || '',
            paper_size: pi.paper_size || 'A4',
        })
        setEditProjectDialog(true)
    }

    const handleSaveProject = async () => {
        try {
            await api.put(`/projects/${projectId}`, {
                name: editProject.name,
                description: editProject.description,
                product_info: {
                    product: editProject.product,
                    copies: parseInt(editProject.copies) || 0,
                    pages: parseInt(editProject.pages) || 0,
                    size: editProject.size,
                    colors: editProject.colors,
                    binding: editProject.binding,
                    paper: editProject.paper,
                    paper_size: editProject.paper_size,
                }
            })
            setEditProjectDialog(false)
            setSnackbar({ open: true, message: 'Proyecto actualizado', severity: 'success' })
            loadProject()
        } catch (err) {
            setSnackbar({ open: true, message: 'Error al actualizar', severity: 'error' })
        }
    }

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
        )
    }

    if (!project) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">Proyecto no encontrado</Alert>
                <Button sx={{ mt: 2 }} onClick={() => navigate('/admin')}>Volver</Button>
            </Box>
        )
    }

    return (
        <Box sx={{ minHeight: '100vh', backgroundColor: '#f0f2f5', p: 3 }}>
            <Box sx={{ mx: 'auto' }}>
                {/* Header */}
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                    <IconButton onClick={() => navigate('/admin')}><ArrowBack /></IconButton>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>{project.name}</Typography>
                        <Typography variant="body2" color="text.secondary">{project.description}</Typography>
                    </Box>
                    <Tooltip title="Editar proyecto">
                        <IconButton onClick={openEditProject}>
                            <Edit />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Eliminar proyecto">
                        <IconButton color="error" onClick={handleDeleteProject}>
                            <Delete />
                        </IconButton>
                    </Tooltip>
                    <Chip
                        label={statusLabels[project.status] || project.status}
                        color={statusColors[project.status] || 'default'}
                        onClick={() => { setNewStatus(project.status); setStatusDialog(true) }}
                        sx={{ cursor: 'pointer', fontWeight: 600 }}
                    />
                    {project.delivery_deadline && (
                        <Chip
                            icon={<CalendarMonth />}
                            label={`Entrega: ${new Date(project.delivery_deadline).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                            variant="outlined" color="warning" sx={{ fontWeight: 600 }}
                        />
                    )}
                    {project.status === 'client_approved' && (
                        <Button variant="contained" color="success" startIcon={<Gavel />}
                            onClick={async () => {
                                try {
                                    await api.put(`/projects/${projectId}/status`, { status: 'approved' })
                                    setSnackbar({ open: true, message: 'Proyecto aprobado para producción y planificado', severity: 'success' })
                                    loadProject()
                                } catch (err) {
                                    setSnackbar({ open: true, message: 'Error', severity: 'error' })
                                }
                            }}
                            sx={{ fontWeight: 700, px: 3 }}>
                            Aprobar Producción
                        </Button>
                    )}
                    {project.status === 'approved' && hasOffsetProcess && (
                        <Button variant="contained" color="warning" startIcon={<PrintIcon />}
                            onClick={() => setShowXmfViewer(true)}
                            sx={{ fontWeight: 700, px: 3 }}>
                            Enviar a XMF
                        </Button>
                    )}
                </Stack>

                {project.status === 'client_approved' && (
                    <Alert severity="info" sx={{ mb: 2 }} icon={<Gavel />}>
                        <strong>El cliente ha aprobado este proyecto.</strong> Pulse "Aprobar Producción" para iniciar la planificación automática.
                    </Alert>
                )}

                {/* ═══ Product Info Section ═══ */}
                {project.product_info && Object.keys(project.product_info).length > 0 && (
                    <Card sx={{ mb: 2 }}>
                        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                {project.product_info.product && (
                                    <Chip label={`Producto: ${project.product_info.product}`} size="small" variant="outlined" />
                                )}
                                {project.product_info.copies > 0 && (
                                    <Chip label={`${project.product_info.copies} ej.`} size="small" variant="outlined" color="primary" />
                                )}
                                {project.product_info.pages > 0 && (
                                    <Chip label={`${project.product_info.pages} pág.`} size="small" variant="outlined" color="secondary" />
                                )}
                                {project.product_info.size && (
                                    <Chip label={project.product_info.size} size="small" variant="outlined" />
                                )}
                                {project.product_info.colors && (
                                    <Chip label={`Colores: ${project.product_info.colors}`} size="small" variant="outlined" />
                                )}
                                {project.product_info.binding && project.product_info.binding !== 'none' && (
                                    <Chip label={`Enc: ${project.product_info.binding}`} size="small" variant="outlined" />
                                )}
                                {project.product_info.paper && (
                                    <Chip label={`Papel: ${project.product_info.paper}${project.product_info.paper_size ? ' (' + project.product_info.paper_size + ')' : ''}`} size="small" variant="outlined" />
                                )}
                            </Stack>
                        </CardContent>
                    </Card>
                )}

                <Card sx={{ mb: 2 }}>
                    <CardContent>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                <PrecisionManufacturing sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
                                Procesos ({(project.processes || []).length})
                            </Typography>
                            <Button variant="contained" size="small" startIcon={<Add />}
                                onClick={() => setAddProcessDialog(true)}>Añadir Proceso</Button>
                        </Stack>
                        {(project.processes || []).length === 0 ? (
                            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                                No hay procesos asignados
                            </Typography>
                        ) : (
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#f8fafc', fontSize: 13 } }}>
                                            <TableCell>Proceso</TableCell>
                                            <TableCell>Máquina</TableCell>
                                            <TableCell>Horas est.</TableCell>
                                            <TableCell>Inicio</TableCell>
                                            <TableCell>Fin</TableCell>
                                            <TableCell>Prioridad</TableCell>
                                            <TableCell>Estado</TableCell>
                                            <TableCell align="right">Acciones</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {(project.processes || []).map(proc => {
                                            const cat = processCatalog.find(c => c.process_type_id === proc.process_type_id)
                                            const machine = machines.find(m => m.machine_id === proc.machine_id)
                                            return (
                                                <TableRow key={proc.process_id} hover>
                                                    <TableCell>
                                                        <Stack direction="row" alignItems="center" spacing={1}>
                                                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: cat?.color || '#ccc' }} />
                                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{proc.name}</Typography>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {machine?.name || '—'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>{proc.estimated_hours}h</TableCell>
                                                    <TableCell>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {proc.start_date ? new Date(proc.start_date).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {proc.end_date ? new Date(proc.end_date).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip label={proc.priority} size="small" variant="outlined"
                                                            color={proc.priority >= 4 ? 'error' : proc.priority >= 3 ? 'warning' : 'default'} />
                                                    </TableCell>
                                                    <TableCell>
                                                        <FormControl size="small" sx={{ minWidth: 130 }}>
                                                            <Select value={proc.status} size="small"
                                                                sx={{ fontSize: 12, height: 28 }}
                                                                onChange={(e) => handleProcessStatus(proc.process_id, e.target.value)}>
                                                                {Object.entries(processStatusLabels).map(([k, v]) => (
                                                                    <MenuItem key={k} value={k} sx={{ fontSize: 13 }}>{v}</MenuItem>
                                                                ))}
                                                            </Select>
                                                        </FormControl>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Tooltip title="Editar">
                                                            <IconButton size="small"
                                                                onClick={() => openEditProcess(proc)}>
                                                                <Edit fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Eliminar">
                                                            <IconButton size="small" color="error"
                                                                onClick={() => handleDeleteProcess(proc.process_id)}>
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
                        )}
                    </CardContent>
                </Card>

                <Grid container spacing={2}>
                    {/* Left: PDFs + Comments */}
                    <Grid item xs={12} md={2}>
                        <Card>
                            <CardContent>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>Mis PDFs</Typography>
                                    <Button variant="contained" component="label" startIcon={uploading ? <CircularProgress size={16} /> : <Upload />} disabled={uploading} size="small">
                                        Subir PDF
                                        <input type="file" hidden accept=".pdf" multiple onChange={handleUpload} />
                                    </Button>
                                </Stack>

                                {uploading && <LinearProgress sx={{ mb: 2 }} />}

                                {project.pdfs?.length === 0 ? (
                                    <Box sx={{ textAlign: 'center', py: 4 }}>
                                        <Description sx={{ fontSize: 48, color: '#d1d5db', mb: 1 }} />
                                        <Typography color="text.secondary">No hay PDFs subidos</Typography>
                                    </Box>
                                ) : (
                                    project.pdfs?.map((pdf) => (
                                        <Paper key={pdf.filename} elevation={0} sx={{
                                            p: 1.5, mb: 1, border: selectedPdf?.filename === pdf.filename ? '2px solid #2563eb' : '1px solid #e5e7eb',
                                            borderRadius: 2, cursor: 'pointer', transition: 'all 0.15s',
                                            '&:hover': { borderColor: '#2563eb' }
                                        }}
                                            onClick={() => setSelectedPdf(pdf)}>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <Box sx={{ display: 'flex' }}>
                                                    {preflightStatusIcons[pdf.preflight_status] || preflightStatusIcons.pending}
                                                </Box>
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {pdf.original_filename}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {(pdf.file_size / 1024).toFixed(1)} KB · {new Date(pdf.uploaded_at).toLocaleDateString('es-ES')}
                                                    </Typography>
                                                </Box>
                                                <Stack direction="row" spacing={0}>
                                                    <Tooltip title="Ejecutar Preflight">
                                                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handlePreflight(pdf.filename) }}
                                                            disabled={preflightLoading === pdf.filename}>
                                                            {preflightLoading === pdf.filename ? <CircularProgress size={16} /> : <Search fontSize="small" />}
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Eliminar">
                                                        <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDeletePdf(pdf.filename) }}>
                                                            <Delete fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Stack>
                                            </Stack>
                                        </Paper>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        {/* Comments */}
                        <Card sx={{ mt: 2 }}>
                            <CardContent>
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Comentarios</Typography>
                                {project.comments?.length > 0 && project.comments.map((c) => (
                                    <Box key={c.comment_id} sx={{ mb: 2, p: 1.5, borderRadius: 2, backgroundColor: '#f9fafb' }}>
                                        <Stack direction="row" justifyContent="space-between">
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.username}</Typography>
                                            <Typography variant="caption" color="text.secondary">{new Date(c.created_at).toLocaleString('es-ES')}</Typography>
                                        </Stack>
                                        <Typography variant="body2" sx={{ mt: 0.5 }}>{c.message}</Typography>
                                        {c.pdf_filename && <Chip label={c.pdf_filename} size="small" sx={{ mt: 0.5, height: 20, fontSize: 10 }} />}
                                    </Box>
                                ))}
                                <Stack direction="row" spacing={1}>
                                    <TextField size="small" fullWidth placeholder="Escribir comentario..." value={comment} onChange={(e) => setComment(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddComment()} />
                                    <IconButton color="primary" onClick={handleAddComment} disabled={!comment.trim()}>
                                        <Send />
                                    </IconButton>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Center: Preflight results */}
                    <Grid item xs={12} md={3}>
                        <Card sx={{ position: 'sticky', top: 16 }}>
                            <CardContent>
                                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                                    {selectedPdf ? `Preflight: ${selectedPdf.original_filename}` : 'Seleccione un PDF'}
                                </Typography>
                                {selectedPdf?.preflight_result ? (
                                    <PreflightResults result={selectedPdf.preflight_result} />
                                ) : selectedPdf ? (
                                    <Box sx={{ textAlign: 'center', py: 4 }}>
                                        <Search sx={{ fontSize: 48, color: '#d1d5db', mb: 1 }} />
                                        <Typography color="text.secondary">Preflight pendiente</Typography>
                                        <Button variant="outlined" size="small" sx={{ mt: 1 }} startIcon={<Search />}
                                            onClick={() => handlePreflight(selectedPdf.filename)} disabled={preflightLoading === selectedPdf.filename}>
                                            Analizar
                                        </Button>
                                    </Box>
                                ) : (
                                    <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                                        Haga clic en un PDF para ver su análisis
                                    </Typography>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Right: PDF Preview */}
                    <Grid item xs={12} md={7}>
                        <Card sx={{ position: 'sticky', top: 16, height: 'calc(100vh - 120px)' }}>
                            <PdfPreview
                                projectId={projectId}
                                filename={selectedPdf?.filename}
                            />
                        </Card>
                    </Grid>
                </Grid>
            </Box>

            {/* Status Dialog */}
            <Dialog open={statusDialog} onClose={() => setStatusDialog(false)}>
                <DialogTitle>Cambiar Estado</DialogTitle>
                <DialogContent sx={{ minWidth: 300 }}>
                    <FormControl fullWidth sx={{ mt: 1 }}>
                        <InputLabel>Estado</InputLabel>
                        <Select value={newStatus} label="Estado" onChange={(e) => setNewStatus(e.target.value)}>
                            {Object.entries(statusLabels).map(([key, label]) => (
                                <MenuItem key={key} value={key}>{label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setStatusDialog(false)}>Cancelar</Button>
                    <Button variant="contained" onClick={handleStatusChange}>Guardar</Button>
                </DialogActions>
            </Dialog>

            {/* Add/Edit Process Dialog */}
            <Dialog open={addProcessDialog} onClose={() => { setAddProcessDialog(false); setEditingProcess(null) }} maxWidth="sm" fullWidth>
                <DialogTitle>{editingProcess ? 'Editar Proceso' : 'Añadir Proceso'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <FormControl fullWidth>
                            <InputLabel>Tipo de proceso</InputLabel>
                            <Select value={newProcess.process_type_id} label="Tipo de proceso"
                                onChange={(e) => handleSelectCatalogProcess(e.target.value)}>
                                {processCatalog.map(p => (
                                    <MenuItem key={p.process_type_id} value={p.process_type_id}>
                                        <Stack direction="row" alignItems="center" spacing={1}>
                                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: p.color || '#ccc' }} />
                                            <span>{p.name}</span>
                                        </Stack>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <TextField label="Nombre" value={newProcess.name}
                            onChange={(e) => setNewProcess({ ...newProcess, name: e.target.value })} fullWidth />
                        <FormControl fullWidth>
                            <InputLabel>Máquina</InputLabel>
                            <Select value={newProcess.machine_id} label="Máquina"
                                onChange={(e) => setNewProcess({ ...newProcess, machine_id: e.target.value })}>
                                <MenuItem value=""><em>Sin asignar</em></MenuItem>
                                {machines.map(m => (
                                    <MenuItem key={m.machine_id} value={m.machine_id}>{m.name} ({m.type})</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Stack direction="row" spacing={2}>
                            <TextField label="Horas estimadas" type="number" value={newProcess.estimated_hours}
                                onChange={(e) => setNewProcess({ ...newProcess, estimated_hours: e.target.value })}
                                fullWidth inputProps={{ min: 0.25, step: 0.25 }} />
                            <TextField label="Prioridad (1-5)" type="number" value={newProcess.priority}
                                onChange={(e) => setNewProcess({ ...newProcess, priority: e.target.value })}
                                fullWidth inputProps={{ min: 1, max: 5 }} />
                        </Stack>
                        {editingProcess && (
                            <Stack direction="row" spacing={2}>
                                <TextField label="Fecha inicio" type="datetime-local" value={newProcess.start_date}
                                    onChange={(e) => setNewProcess({ ...newProcess, start_date: e.target.value })}
                                    fullWidth InputLabelProps={{ shrink: true }} />
                                <TextField label="Fecha fin" type="datetime-local" value={newProcess.end_date}
                                    onChange={(e) => setNewProcess({ ...newProcess, end_date: e.target.value })}
                                    fullWidth InputLabelProps={{ shrink: true }} />
                            </Stack>
                        )}
                        {/* Fold schemes — only for offset machines */}
                        {isOffsetMachine && (
                            <Box>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Esquemas de plegado</Typography>
                                    <Button size="small" startIcon={<Add />} onClick={handleAddFoldScheme}>Añadir</Button>
                                </Stack>
                                {(newProcess.fold_schemes || []).length === 0 && (
                                    <Typography variant="caption" color="text.secondary">Sin esquemas — se usará F16 por defecto</Typography>
                                )}
                                {(newProcess.fold_schemes || []).map((scheme, idx) => (
                                    <Stack key={idx} direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                        <TextField size="small" label="Esquema" value={scheme.fold_catalog}
                                            onChange={(e) => handleUpdateFoldScheme(idx, 'fold_catalog', e.target.value)}
                                            sx={{ flex: 1 }} placeholder="F16-7" />
                                        <TextField size="small" label="Pliegos" type="number" value={scheme.total_sheets}
                                            onChange={(e) => handleUpdateFoldScheme(idx, 'total_sheets', parseInt(e.target.value) || 1)}
                                            sx={{ width: 90 }} inputProps={{ min: 1 }} />
                                        <FormControl size="small" sx={{ minWidth: 130 }}>
                                            <InputLabel>Trabajo</InputLabel>
                                            <Select value={scheme.is_duplex ? 'duplex' : 'normal'} label="Trabajo"
                                                onChange={(e) => handleUpdateFoldScheme(idx, 'is_duplex', e.target.value === 'duplex')}>
                                                <MenuItem value="normal">Retiración</MenuItem>
                                                <MenuItem value="duplex">Tira y retira</MenuItem>
                                            </Select>
                                        </FormControl>
                                        <IconButton size="small" color="error" onClick={() => handleRemoveFoldScheme(idx)}>
                                            <Delete fontSize="small" />
                                        </IconButton>
                                    </Stack>
                                ))}
                            </Box>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setAddProcessDialog(false); setEditingProcess(null) }}>Cancelar</Button>
                    <Button variant="contained" onClick={handleAddProcess}
                        disabled={!newProcess.process_type_id || !newProcess.name}>
                        {editingProcess ? 'Guardar' : 'Añadir'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Edit Project Dialog */}
            <Dialog open={editProjectDialog} onClose={() => setEditProjectDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Editar Proyecto</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField label="Nombre" value={editProject.name}
                            onChange={(e) => setEditProject({ ...editProject, name: e.target.value })} fullWidth />
                        <TextField label="Descripción" value={editProject.description}
                            onChange={(e) => setEditProject({ ...editProject, description: e.target.value })} fullWidth multiline rows={2} />
                        <Stack direction="row" spacing={2}>
                            <TextField label="Producto" value={editProject.product}
                                onChange={(e) => setEditProject({ ...editProject, product: e.target.value })} fullWidth />
                            <TextField label="Ejemplares" type="number" value={editProject.copies}
                                onChange={(e) => setEditProject({ ...editProject, copies: e.target.value })} sx={{ minWidth: 110 }} />
                            <TextField label="Páginas" type="number" value={editProject.pages}
                                onChange={(e) => setEditProject({ ...editProject, pages: e.target.value })} sx={{ minWidth: 100 }} />
                        </Stack>
                        <Stack direction="row" spacing={2}>
                            <FormControl fullWidth>
                                <InputLabel>Tamaño</InputLabel>
                                <Select value={editProject.size} label="Tamaño"
                                    onChange={(e) => setEditProject({ ...editProject, size: e.target.value })}>
                                    <MenuItem value="A5">A5</MenuItem>
                                    <MenuItem value="A4">A4</MenuItem>
                                    <MenuItem value="A3">A3</MenuItem>
                                    <MenuItem value="A2">A2</MenuItem>
                                    <MenuItem value="Carta">Carta</MenuItem>
                                    <MenuItem value="Personalizado">Personalizado</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl fullWidth>
                                <InputLabel>Colores</InputLabel>
                                <Select value={editProject.colors} label="Colores"
                                    onChange={(e) => setEditProject({ ...editProject, colors: e.target.value })}>
                                    <MenuItem value="4/4">4/4</MenuItem>
                                    <MenuItem value="4/1">4/1</MenuItem>
                                    <MenuItem value="4/0">4/0</MenuItem>
                                    <MenuItem value="1/1">1/1</MenuItem>
                                    <MenuItem value="1/0">1/0</MenuItem>
                                </Select>
                            </FormControl>
                        </Stack>
                        <Stack direction="row" spacing={2}>
                            <FormControl fullWidth>
                                <InputLabel>Encuadernación</InputLabel>
                                <Select value={editProject.binding} label="Encuadernación"
                                    onChange={(e) => setEditProject({ ...editProject, binding: e.target.value })}>
                                    <MenuItem value="none">Sin encuadernación</MenuItem>
                                    <MenuItem value="stapled">Grapado</MenuItem>
                                    <MenuItem value="perfect">Fresado</MenuItem>
                                    <MenuItem value="sewn">Cosido</MenuItem>
                                    <MenuItem value="spiral">Espiral</MenuItem>
                                    <MenuItem value="wire-o">Wire-O</MenuItem>
                                </Select>
                            </FormControl>
                            <TextField label="Papel" value={editProject.paper}
                                onChange={(e) => setEditProject({ ...editProject, paper: e.target.value })} fullWidth />
                            <FormControl sx={{ minWidth: 120 }}>
                                <InputLabel>Tam. papel</InputLabel>
                                <Select value={editProject.paper_size} label="Tam. papel"
                                    onChange={(e) => setEditProject({ ...editProject, paper_size: e.target.value })}>
                                    <MenuItem value="1000x700">1000×700</MenuItem>
                                    <MenuItem value="950x650">950×650</MenuItem>
                                    <MenuItem value="900x650">900×650</MenuItem>
                                </Select>
                            </FormControl>
                        </Stack>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditProjectDialog(false)}>Cancelar</Button>
                    <Button variant="contained" onClick={handleSaveProject} disabled={!editProject.name}>Guardar</Button>
                </DialogActions>
            </Dialog>

            {/* XMF JSON Viewer Modal */}
            {showXmfViewer && (
                <XmfJsonViewer projectId={projectId} onClose={() => setShowXmfViewer(false)} />
            )}

            <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
            </Snackbar>
        </Box>
    )
}

export default AdminProjectDetail
