import { useState, useEffect } from 'react';
import {
    Box,
    IconButton,
    Typography,
    CircularProgress,
    Paper,
    Chip,
    Skeleton
} from '@mui/material';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import api from '../api/apiService';

/**
 * Componente de previsualización de PDF con navegación por páginas.
 * Muestra un thumbnail por página con controles prev/next.
 */
const PdfPreview = ({ projectId, filename, onClose }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [thumbnail, setThumbnail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pageCache, setPageCache] = useState({});

    // Cargar info del PDF (número de páginas)
    useEffect(() => {
        if (!projectId || !filename) return;
        setCurrentPage(1);
        setTotalPages(0);
        setPageCache({});
        setThumbnail(null);

        const fetchInfo = async () => {
            try {
                const res = await api.get(`/api/projects/${projectId}/pdf-info/${encodeURIComponent(filename)}`);
                setTotalPages(res.data.page_count || 0);
            } catch (err) {
                console.error('Error loading PDF info:', err);
                setError('No se pudo cargar info del PDF');
            }
        };
        fetchInfo();
    }, [projectId, filename]);

    // Cargar thumbnail de la página actual
    useEffect(() => {
        if (!projectId || !filename || totalPages === 0) return;

        // Si ya está en cache, usar directamente
        if (pageCache[currentPage]) {
            setThumbnail(pageCache[currentPage]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        const fetchThumbnail = async () => {
            try {
                const res = await api.get(
                    `/api/projects/${projectId}/thumbnail/${encodeURIComponent(filename)}/page/${currentPage}?width=500`
                );
                const thumbData = res.data.thumbnail;
                setThumbnail(thumbData);
                setPageCache(prev => ({ ...prev, [currentPage]: thumbData }));
            } catch (err) {
                console.error(`Error loading page ${currentPage}:`, err);
                setError('Error al cargar la página');
            } finally {
                setLoading(false);
            }
        };
        fetchThumbnail();
    }, [projectId, filename, currentPage, totalPages]);

    // Precargar página siguiente y anterior
    useEffect(() => {
        if (!projectId || !filename || totalPages === 0) return;

        const preload = async (page) => {
            if (page < 1 || page > totalPages || pageCache[page]) return;
            try {
                const res = await api.get(
                    `/api/projects/${projectId}/thumbnail/${encodeURIComponent(filename)}/page/${page}?width=500`
                );
                setPageCache(prev => ({ ...prev, [page]: res.data.thumbnail }));
            } catch {
                // Silently fail preload
            }
        };

        preload(currentPage + 1);
        if (currentPage > 1) preload(currentPage - 1);
    }, [currentPage, totalPages, projectId, filename]);

    if (!filename) {
        return (
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'text.secondary',
                p: 3
            }}>
                <Typography variant="body2">
                    Selecciona un PDF para ver la previsualización
                </Typography>
            </Box>
        );
    }

    return (
        <Paper
            elevation={0}
            sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                bgcolor: '#f8f9fa',
                borderRadius: 2,
                overflow: 'hidden'
            }}
        >
            {/* Header */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 1.5,
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: 'white'
            }}>
                <Typography variant="subtitle2" noWrap sx={{ flex: 1 }}>
                    Vista previa
                </Typography>
                {totalPages > 0 && (
                    <Chip
                        label={`${currentPage} / ${totalPages}`}
                        size="small"
                        color="primary"
                        variant="outlined"
                    />
                )}
            </Box>

            {/* Image area */}
            <Box sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                p: 1,
                minHeight: 300
            }}>
                {loading ? (
                    <Box sx={{ textAlign: 'center' }}>
                        <Skeleton variant="rectangular" width={350} height={495} sx={{ borderRadius: 1 }} />
                        <CircularProgress size={24} sx={{ mt: 1 }} />
                    </Box>
                ) : error ? (
                    <Typography color="error" variant="body2">{error}</Typography>
                ) : thumbnail ? (
                    <Box
                        component="img"
                        src={thumbnail}
                        alt={`Página ${currentPage}`}
                        sx={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                            borderRadius: 1,
                            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                        }}
                    />
                ) : (
                    <Typography color="text.secondary">No hay previsualización disponible</Typography>
                )}
            </Box>

            {/* Navigation controls */}
            {totalPages > 1 && (
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.5,
                    p: 1,
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'white'
                }}>
                    <IconButton
                        size="small"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                    >
                        <FirstPageIcon />
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                    >
                        <NavigateBeforeIcon />
                    </IconButton>

                    <Typography variant="body2" sx={{ mx: 1, minWidth: 80, textAlign: 'center' }}>
                        Pág. {currentPage} de {totalPages}
                    </Typography>

                    <IconButton
                        size="small"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                    >
                        <NavigateNextIcon />
                    </IconButton>
                    <IconButton
                        size="small"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                    >
                        <LastPageIcon />
                    </IconButton>
                </Box>
            )}
        </Paper>
    );
};

export default PdfPreview;
