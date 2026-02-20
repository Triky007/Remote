import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box,
    IconButton,
    Typography,
    CircularProgress,
    Paper,
    Chip,
    Skeleton,
    ToggleButtonGroup,
    ToggleButton,
    Tooltip
} from '@mui/material';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import FirstPageIcon from '@mui/icons-material/FirstPage';
import LastPageIcon from '@mui/icons-material/LastPage';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import DescriptionIcon from '@mui/icons-material/Description';
import api from '../api/apiService';

/* ─── CSS keyframes inyectadas una sola vez ─── */
const STYLE_ID = 'pdf-book-animations';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        @keyframes flipRight {
            0%   { transform: rotateY(0deg); }
            100% { transform: rotateY(-180deg); }
        }
        @keyframes flipLeft {
            0%   { transform: rotateY(-180deg); }
            100% { transform: rotateY(0deg); }
        }
        @keyframes fadeSlideRight {
            0%   { opacity: 0; transform: translateX(30px); }
            100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeSlideLeft {
            0%   { opacity: 0; transform: translateX(-30px); }
            100% { opacity: 1; transform: translateX(0); }
        }
    `;
    document.head.appendChild(style);
}

/**
 * PdfPreview – Visor de PDF con dos modos:
 *  • Página simple (single)
 *  • Modo libro (book) con páginas enfrentadas, lomo y animación de paso de página 3D
 */
const PdfPreview = ({ projectId, filename }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pageCache, setPageCache] = useState({});
    const [viewMode, setViewMode] = useState('book'); // 'single' | 'book'
    const [flipping, setFlipping] = useState(null); // 'next' | 'prev' | null
    const flipTimeoutRef = useRef(null);

    // ─── Helpers ────────────
    const getThumbUrl = useCallback((page) =>
        `/projects/${projectId}/thumbnail/${encodeURIComponent(filename)}/page/${page}?width=500`,
        [projectId, filename]
    );

    const fetchThumb = useCallback(async (page) => {
        if (!projectId || !filename || page < 1 || page > totalPages) return null;
        if (pageCache[page]) return pageCache[page];
        try {
            const res = await api.get(getThumbUrl(page));
            const data = res.data.thumbnail;
            setPageCache(prev => ({ ...prev, [page]: data }));
            return data;
        } catch { return null; }
    }, [projectId, filename, totalPages, getThumbUrl]);

    // ─── En book mode: spread actual ────────────
    // Spread 0 = portada (solo pág 1 derecha)
    // Spread 1 = págs 2-3,  Spread 2 = págs 4-5, etc.
    const [currentSpread, setCurrentSpread] = useState(0);
    const totalSpreads = Math.ceil((totalPages + 1) / 2); // +1 por portada sola

    const getSpreadPages = (spread) => {
        if (spread === 0) return { left: null, right: 1 };
        const leftPage = spread * 2;
        const rightPage = spread * 2 + 1;
        return {
            left: leftPage <= totalPages ? leftPage : null,
            right: rightPage <= totalPages ? rightPage : null,
        };
    };

    // ─── Reset al cambiar PDF ────────────
    useEffect(() => {
        if (!projectId || !filename) return;
        setCurrentPage(1);
        setCurrentSpread(0);
        setTotalPages(0);
        setPageCache({});
        setError(null);
        setFlipping(null);

        (async () => {
            try {
                const res = await api.get(`/projects/${projectId}/pdf-info/${encodeURIComponent(filename)}`);
                setTotalPages(res.data.page_count || 0);
            } catch (err) {
                console.error('Error loading PDF info:', err);
                setError('No se pudo cargar info del PDF');
            }
        })();
    }, [projectId, filename]);

    // ─── Cargar thumbnails necesarios ────────────
    useEffect(() => {
        if (!projectId || !filename || totalPages === 0) return;
        setLoading(true);

        const loadPages = async () => {
            if (viewMode === 'single') {
                await fetchThumb(currentPage);
                // preload adj
                fetchThumb(currentPage + 1);
                fetchThumb(currentPage - 1);
            } else {
                const { left, right } = getSpreadPages(currentSpread);
                const promises = [];
                if (left) promises.push(fetchThumb(left));
                if (right) promises.push(fetchThumb(right));
                await Promise.all(promises);
                // preload next spread
                const next = getSpreadPages(currentSpread + 1);
                const prev = getSpreadPages(currentSpread - 1);
                if (next.left) fetchThumb(next.left);
                if (next.right) fetchThumb(next.right);
                if (prev.left) fetchThumb(prev.left);
                if (prev.right) fetchThumb(prev.right);
            }
            setLoading(false);
        };
        loadPages();
    }, [projectId, filename, totalPages, currentPage, currentSpread, viewMode]);

    // ─── Navegación ────────────
    const goNextSingle = () => setCurrentPage(p => Math.min(totalPages, p + 1));
    const goPrevSingle = () => setCurrentPage(p => Math.max(1, p - 1));

    const goNextSpread = () => {
        if (currentSpread >= totalSpreads - 1 || flipping) return;
        setFlipping('next');
        if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
        flipTimeoutRef.current = setTimeout(() => {
            setCurrentSpread(s => Math.min(totalSpreads - 1, s + 1));
            setFlipping(null);
        }, 500);
    };

    const goPrevSpread = () => {
        if (currentSpread <= 0 || flipping) return;
        setFlipping('prev');
        if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
        flipTimeoutRef.current = setTimeout(() => {
            setCurrentSpread(s => Math.max(0, s - 1));
            setFlipping(null);
        }, 500);
    };

    // Sincronizar single ↔ book
    const handleModeChange = (_, newMode) => {
        if (!newMode) return;
        if (newMode === 'book') {
            // Calcular spread correspondiente a la página actual
            if (currentPage === 1) setCurrentSpread(0);
            else setCurrentSpread(Math.floor(currentPage / 2));
        } else {
            // Ir a la primera página del spread actual
            const { left, right } = getSpreadPages(currentSpread);
            setCurrentPage(left || right || 1);
        }
        setViewMode(newMode);
    };

    // ─── Current page label en book mode ────────────
    const spreadPageLabel = () => {
        const { left, right } = getSpreadPages(currentSpread);
        if (left && right) return `Págs. ${left}-${right}`;
        if (left) return `Pág. ${left}`;
        if (right) return `Pág. ${right}`;
        return '';
    };

    // Cleanup
    useEffect(() => () => {
        if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
    }, []);

    // ─── Empty state ────────────
    if (!filename) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary', p: 3 }}>
                <Typography variant="body2">Selecciona un PDF para ver la previsualización</Typography>
            </Box>
        );
    }

    // ─── Render de una página (imagen) ────────────
    const renderPageImage = (pageNum, side) => {
        if (!pageNum) {
            return (
                <Box sx={{
                    width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: '#eee', borderRadius: side === 'left' ? '4px 0 0 4px' : '0 4px 4px 0'
                }}>
                    <Typography variant="caption" color="text.disabled">—</Typography>
                </Box>
            );
        }
        const thumb = pageCache[pageNum];
        if (!thumb) {
            return (
                <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' }}>
                    <CircularProgress size={20} />
                </Box>
            );
        }
        return (
            <Box
                component="img"
                src={thumb}
                alt={`Página ${pageNum}`}
                sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block'
                }}
            />
        );
    };

    return (
        <Paper
            elevation={0}
            sx={{
                display: 'flex', flexDirection: 'column', height: '100%',
                bgcolor: '#f8f9fa', borderRadius: 2, overflow: 'hidden'
            }}
        >
            {/* ─── Header ─── */}
            <Box sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                p: 1, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'white', gap: 1
            }}>
                <Typography variant="subtitle2" noWrap sx={{ flex: 1 }}>Vista previa</Typography>

                <ToggleButtonGroup
                    value={viewMode}
                    exclusive
                    onChange={handleModeChange}
                    size="small"
                    sx={{ height: 28 }}
                >
                    <ToggleButton value="single" sx={{ px: 1, py: 0 }}>
                        <Tooltip title="Página simple">
                            <DescriptionIcon sx={{ fontSize: 18 }} />
                        </Tooltip>
                    </ToggleButton>
                    <ToggleButton value="book" sx={{ px: 1, py: 0 }}>
                        <Tooltip title="Modo libro">
                            <MenuBookIcon sx={{ fontSize: 18 }} />
                        </Tooltip>
                    </ToggleButton>
                </ToggleButtonGroup>

                {totalPages > 0 && (
                    <Chip
                        label={viewMode === 'single'
                            ? `${currentPage} / ${totalPages}`
                            : `${spreadPageLabel()} · ${totalPages} págs`
                        }
                        size="small" color="primary" variant="outlined"
                    />
                )}
            </Box>

            {/* ─── Content area ─── */}
            <Box sx={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', p: 2, minHeight: 300,
                backgroundColor: viewMode === 'book' ? '#2c2c2c' : '#f8f9fa',
                transition: 'background-color 0.3s'
            }}>
                {loading && !Object.keys(pageCache).length ? (
                    <Box sx={{ textAlign: 'center' }}>
                        <Skeleton variant="rectangular" width={viewMode === 'book' ? 500 : 350} height={400} sx={{ borderRadius: 1 }} />
                        <CircularProgress size={24} sx={{ mt: 1 }} />
                    </Box>
                ) : error ? (
                    <Typography color="error" variant="body2">{error}</Typography>

                    /* ─── SINGLE MODE ─── */
                ) : viewMode === 'single' ? (
                    <Box sx={{
                        maxWidth: '100%', maxHeight: '100%',
                        animation: 'fadeSlideRight 0.25s ease',
                    }}>
                        {pageCache[currentPage] ? (
                            <Box
                                component="img"
                                src={pageCache[currentPage]}
                                alt={`Página ${currentPage}`}
                                sx={{
                                    maxWidth: '100%', maxHeight: 'calc(100vh - 260px)',
                                    objectFit: 'contain', borderRadius: 1,
                                    boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                                }}
                            />
                        ) : (
                            <Typography color="text.secondary">No hay previsualización disponible</Typography>
                        )}
                    </Box>

                    /* ─── BOOK MODE ─── */
                ) : (
                    <Box sx={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        perspective: '1500px', width: '100%', height: '100%',
                    }}>
                        {/* Book container */}
                        <Box sx={{
                            display: 'flex',
                            maxWidth: 700,
                            width: '90%',
                            maxHeight: 'calc(100vh - 260px)',
                            aspectRatio: currentSpread === 0 ? '1 / 1.414' : '2 / 1.414',
                            position: 'relative',
                        }}>
                            {/* ─── Portada (spread 0): solo página derecha ─── */}
                            {currentSpread === 0 ? (
                                <Box sx={{
                                    width: '50%',
                                    height: '100%',
                                    mx: 'auto',
                                    position: 'relative',
                                    animation: flipping === 'prev' ? 'fadeSlideLeft 0.5s ease' : undefined,
                                    borderRadius: 1,
                                    overflow: 'hidden',
                                    boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
                                }}>
                                    {renderPageImage(1, 'right')}
                                    {/* Page number overlay */}
                                    <Box sx={{
                                        position: 'absolute', bottom: 8, right: 12,
                                        bgcolor: 'rgba(0,0,0,0.55)', color: 'white',
                                        borderRadius: '12px', px: 1.5, py: 0.25,
                                        fontSize: 11, fontWeight: 600
                                    }}>1</Box>
                                </Box>
                            ) : (
                                /* ─── Spread normal: dos páginas ─── */
                                <Box sx={{
                                    display: 'flex', width: '100%', height: '100%',
                                    position: 'relative',
                                    transformStyle: 'preserve-3d',
                                }}>
                                    {/* Left page */}
                                    <Box sx={{
                                        width: '50%', height: '100%', position: 'relative',
                                        borderRadius: '4px 0 0 4px', overflow: 'hidden',
                                        boxShadow: '-4px 4px 16px rgba(0,0,0,0.3)',
                                        animation: flipping === 'prev' ? 'fadeSlideLeft 0.5s ease' : undefined,
                                        bgcolor: '#fff',
                                    }}>
                                        {renderPageImage(getSpreadPages(currentSpread).left, 'left')}
                                        {/* Page number */}
                                        {getSpreadPages(currentSpread).left && (
                                            <Box sx={{
                                                position: 'absolute', bottom: 8, left: 12,
                                                bgcolor: 'rgba(0,0,0,0.55)', color: 'white',
                                                borderRadius: '12px', px: 1.5, py: 0.25,
                                                fontSize: 11, fontWeight: 600
                                            }}>{getSpreadPages(currentSpread).left}</Box>
                                        )}
                                    </Box>

                                    {/* Spine / Lomo */}
                                    <Box sx={{
                                        width: 6, minWidth: 6,
                                        background: 'linear-gradient(90deg, #3a3a3a 0%, #5a5a5a 30%, #4a4a4a 50%, #5a5a5a 70%, #3a3a3a 100%)',
                                        boxShadow: 'inset 0 0 8px rgba(0,0,0,0.6), 0 0 4px rgba(0,0,0,0.3)',
                                        zIndex: 2,
                                        position: 'relative',
                                        '&::before': {
                                            content: '""',
                                            position: 'absolute',
                                            top: 0, bottom: 0, left: -3, width: 3,
                                            background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.15))'
                                        },
                                        '&::after': {
                                            content: '""',
                                            position: 'absolute',
                                            top: 0, bottom: 0, right: -3, width: 3,
                                            background: 'linear-gradient(270deg, transparent, rgba(0,0,0,0.15))'
                                        }
                                    }} />

                                    {/* Right page */}
                                    <Box sx={{
                                        width: '50%', height: '100%', position: 'relative',
                                        borderRadius: '0 4px 4px 0', overflow: 'hidden',
                                        boxShadow: '4px 4px 16px rgba(0,0,0,0.3)',
                                        animation: flipping === 'next' ? 'fadeSlideRight 0.5s ease' : undefined,
                                        bgcolor: '#fff',
                                    }}>
                                        {renderPageImage(getSpreadPages(currentSpread).right, 'right')}
                                        {getSpreadPages(currentSpread).right && (
                                            <Box sx={{
                                                position: 'absolute', bottom: 8, right: 12,
                                                bgcolor: 'rgba(0,0,0,0.55)', color: 'white',
                                                borderRadius: '12px', px: 1.5, py: 0.25,
                                                fontSize: 11, fontWeight: 600
                                            }}>{getSpreadPages(currentSpread).right}</Box>
                                        )}
                                    </Box>

                                    {/* Flip overlay – animación de hoja girando */}
                                    {flipping && (
                                        <Box sx={{
                                            position: 'absolute',
                                            top: 0,
                                            [flipping === 'next' ? 'right' : 'left']: 0,
                                            width: '50%', height: '100%',
                                            transformOrigin: flipping === 'next' ? 'left center' : 'right center',
                                            animation: `${flipping === 'next' ? 'flipRight' : 'flipLeft'} 0.5s ease-in-out`,
                                            backfaceVisibility: 'hidden',
                                            zIndex: 5,
                                            bgcolor: 'white',
                                            boxShadow: '0 0 30px rgba(0,0,0,0.3)',
                                            borderRadius: flipping === 'next' ? '0 4px 4px 0' : '4px 0 0 4px',
                                            overflow: 'hidden',
                                        }}>
                                            {/* Muestra la página que se está pasando */}
                                            {flipping === 'next' && renderPageImage(getSpreadPages(currentSpread).right, 'right')}
                                            {flipping === 'prev' && renderPageImage(getSpreadPages(currentSpread).left, 'left')}
                                        </Box>
                                    )}
                                </Box>
                            )}
                        </Box>
                    </Box>
                )}
            </Box>

            {/* ─── Navigation controls ─── */}
            {totalPages > 1 && (
                <Box sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 0.5, p: 1, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'white'
                }}>
                    {viewMode === 'single' ? (
                        <>
                            <IconButton size="small" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                                <FirstPageIcon />
                            </IconButton>
                            <IconButton size="small" onClick={goPrevSingle} disabled={currentPage === 1}>
                                <NavigateBeforeIcon />
                            </IconButton>
                            <Typography variant="body2" sx={{ mx: 1, minWidth: 90, textAlign: 'center' }}>
                                Pág. {currentPage} de {totalPages}
                            </Typography>
                            <IconButton size="small" onClick={goNextSingle} disabled={currentPage === totalPages}>
                                <NavigateNextIcon />
                            </IconButton>
                            <IconButton size="small" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
                                <LastPageIcon />
                            </IconButton>
                        </>
                    ) : (
                        <>
                            <IconButton size="small" onClick={() => { setCurrentSpread(0); setFlipping(null); }} disabled={currentSpread === 0}>
                                <FirstPageIcon />
                            </IconButton>
                            <IconButton size="small" onClick={goPrevSpread} disabled={currentSpread === 0 || !!flipping}>
                                <NavigateBeforeIcon />
                            </IconButton>
                            <Typography variant="body2" sx={{ mx: 1, minWidth: 120, textAlign: 'center' }}>
                                {spreadPageLabel()} · {totalPages} págs
                            </Typography>
                            <IconButton size="small" onClick={goNextSpread} disabled={currentSpread >= totalSpreads - 1 || !!flipping}>
                                <NavigateNextIcon />
                            </IconButton>
                            <IconButton size="small" onClick={() => { setCurrentSpread(totalSpreads - 1); setFlipping(null); }}
                                disabled={currentSpread >= totalSpreads - 1}>
                                <LastPageIcon />
                            </IconButton>
                        </>
                    )}
                </Box>
            )}
        </Paper>
    );
};

export default PdfPreview;
