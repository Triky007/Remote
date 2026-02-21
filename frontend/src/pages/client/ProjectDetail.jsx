import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/apiService'
import PreflightResults from '../../components/PreflightResults'
import PdfPreview from '../../components/PdfPreview'
import {
    Box, Typography, Button, Card, CardContent, Grid, Stack, Chip,
    TextField, IconButton, CircularProgress, Paper, LinearProgress, Alert, Snackbar, Tooltip
} from '@mui/material'
import {
    ArrowBack, Upload, Search, Description, Send,
    CheckCircle, Warning, Error as ErrorIcon, Schedule
} from '@mui/icons-material'

const preflightStatusIcons = {
    PASS: <CheckCircle sx={{ color: '#10b981' }} />,
    WARN: <Warning sx={{ color: '#f59e0b' }} />,
    FAIL: <ErrorIcon sx={{ color: '#ef4444' }} />,
    pending: <Schedule sx={{ color: '#9ca3af' }} />,
}
const statusLabels = {
    pending: 'Pendiente', reviewing: 'En revisión', approved: 'Aprobado', rejected: 'Rechazado', completed: 'Completado'
}
const statusColors = {
    pending: 'default', reviewing: 'info', approved: 'success', rejected: 'error', completed: 'primary'
}

const ClientProjectDetail = () => {
    const { projectId } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const [project, setProject] = useState(null)
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [preflightLoading, setPreflightLoading] = useState('')
    const [selectedPdf, setSelectedPdf] = useState(null)
    const [comment, setComment] = useState('')
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })

    const loadProject = useCallback(async () => {
        try {
            const res = await api.get(`/projects/${projectId}`)
            setProject(res.data)
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

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>

    if (!project) return (
        <Box sx={{ p: 3 }}>
            <Alert severity="error">Proyecto no encontrado</Alert>
            <Button sx={{ mt: 2 }} onClick={() => navigate('/client')}>Volver</Button>
        </Box>
    )

    return (
        <Box sx={{ minHeight: '100vh', backgroundColor: '#f0f2f5', p: 3 }}>
            <Box sx={{ mx: 'auto' }}>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                    <IconButton onClick={() => navigate('/client')}><ArrowBack /></IconButton>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>{project.name}</Typography>
                        <Typography variant="body2" color="text.secondary">{project.description}</Typography>
                    </Box>
                    <Chip label={statusLabels[project.status] || project.status} color={statusColors[project.status] || 'default'} sx={{ fontWeight: 600 }} />
                </Stack>

                <Grid container spacing={2}>
                    <Grid item xs={12} md={2}>
                        {/* Upload & PDFs */}
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
                                        <Typography color="text.secondary">Suba sus artes finales en PDF</Typography>
                                    </Box>
                                ) : (
                                    project.pdfs?.map((pdf) => (
                                        <Paper key={pdf.filename} elevation={0} sx={{
                                            p: 1.5, mb: 1,
                                            border: selectedPdf?.filename === pdf.filename ? '2px solid #2563eb' : '1px solid #e5e7eb',
                                            borderRadius: 2, cursor: 'pointer', '&:hover': { borderColor: '#2563eb' }
                                        }} onClick={() => setSelectedPdf(pdf)}>
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
                                                <Tooltip title="Analizar PDF">
                                                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); handlePreflight(pdf.filename) }}
                                                        disabled={preflightLoading === pdf.filename}>
                                                        {preflightLoading === pdf.filename ? <CircularProgress size={16} /> : <Search fontSize="small" />}
                                                    </IconButton>
                                                </Tooltip>
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
                                    <Box key={c.comment_id} sx={{ mb: 2, p: 1.5, borderRadius: 2, backgroundColor: c.username === user?.username ? '#eff6ff' : '#f9fafb' }}>
                                        <Stack direction="row" justifyContent="space-between">
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.username}</Typography>
                                            <Typography variant="caption" color="text.secondary">{new Date(c.created_at).toLocaleString('es-ES')}</Typography>
                                        </Stack>
                                        <Typography variant="body2" sx={{ mt: 0.5 }}>{c.message}</Typography>
                                    </Box>
                                ))}
                                <Stack direction="row" spacing={1}>
                                    <TextField size="small" fullWidth placeholder="Escribir comentario..." value={comment}
                                        onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddComment()} />
                                    <IconButton color="primary" onClick={handleAddComment} disabled={!comment.trim()}><Send /></IconButton>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Center: Preflight panel */}
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

            <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>{snackbar.message}</Alert>
            </Snackbar>
        </Box>
    )
}

export default ClientProjectDetail
