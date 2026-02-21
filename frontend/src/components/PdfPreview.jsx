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
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
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

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 0.3;

/**
 * PdfPreview – Visor de PDF con dos modos + zoom interactivo:
 *  • Página simple (single)
 *  • Modo libro (book) con páginas enfrentadas, lomo y animación de paso de página 3D
 *  • Click para zoom in en la zona clickada
 *  • Scroll wheel para zoom in/out
 *  • Drag para pan cuando hay zoom
 *  • Doble-click para resetear zoom
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

    // ─── Zoom state ────────────
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [selectionRect, setSelectionRect] = useState(null); // { x, y, w, h } en px relativos al container
    const dragStartRef = useRef({ x: 0, y: 0 });
    const panStartRef = useRef({ x: 0, y: 0 });
    const contentRef = useRef(null);
    const didDragRef = useRef(false);

    const resetZoom = useCallback(() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setSelectionRect(null);
    }, []);

    // Reset zoom al cambiar de página o modo
    useEffect(() => { resetZoom(); }, [currentPage, viewMode]);

    // ─── Zoom handlers ────────────
    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const container = contentRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const cursorX = (e.clientX - rect.left) / rect.width;
        const cursorY = (e.clientY - rect.top) / rect.height;

        setZoom(prevZoom => {
            const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
            const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prevZoom + delta));

            if (newZoom === MIN_ZOOM) {
                setPan({ x: 0, y: 0 });
            } else if (newZoom !== prevZoom) {
                const zoomRatio = newZoom / prevZoom;
                setPan(prevPan => ({
                    x: cursorX * rect.width * (1 - zoomRatio) + prevPan.x * zoomRatio,
                    y: cursorY * rect.height * (1 - zoomRatio) + prevPan.y * zoomRatio,
                }));
            }
            return newZoom;
        });
    }, []);

    const handleDoubleClick = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        resetZoom();
    }, [resetZoom]);

    // ─── Mouse handlers: Ctrl+drag = pan, normal drag = area-select ────────────
    const dragModeRef = useRef(null); // 'pan' | 'select'

    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        const container = contentRef.current;
        if (!container) return;

        didDragRef.current = false;
        dragStartRef.current = { x: e.clientX, y: e.clientY };

        if (e.ctrlKey || e.metaKey) {
            // Ctrl+drag = pan mode (at any zoom level)
            dragModeRef.current = 'pan';
            setIsDragging(true);
            panStartRef.current = { ...pan };
        } else {
            // Normal drag = area-select mode
            dragModeRef.current = 'select';
            setIsDragging(true);
            const rect = container.getBoundingClientRect();
            setSelectionRect({
                startX: e.clientX - rect.left,
                startY: e.clientY - rect.top,
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                w: 0, h: 0,
            });
        }
    }, [pan]);

    const handleMouseMove = useCallback((e) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) didDragRef.current = true;

        if (dragModeRef.current === 'pan') {
            setPan({
                x: panStartRef.current.x + dx,
                y: panStartRef.current.y + dy,
            });
        } else {
            // Update selection rect
            const container = contentRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const curX = e.clientX - rect.left;
            const curY = e.clientY - rect.top;
            setSelectionRect(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    x: Math.min(prev.startX, curX),
                    y: Math.min(prev.startY, curY),
                    w: Math.abs(curX - prev.startX),
                    h: Math.abs(curY - prev.startY),
                };
            });
        }
    }, [isDragging]);

    const handleMouseUp = useCallback(() => {
        if (dragModeRef.current === 'select' && selectionRect && didDragRef.current && selectionRect.w > 20 && selectionRect.h > 20) {
            // Zoom to selected area
            const container = contentRef.current;
            if (container) {
                const rect = container.getBoundingClientRect();

                // Calculate how much we need to zoom relative to current zoom
                const scaleX = rect.width / selectionRect.w;
                const scaleY = rect.height / selectionRect.h;
                const zoomRatio = Math.min(scaleX, scaleY);

                const newZoom = Math.min(MAX_ZOOM, zoom * zoomRatio);
                const actualRatio = newZoom / zoom;

                // Center of the selection in screen coordinates
                const selCenterX = selectionRect.x + selectionRect.w / 2;
                const selCenterY = selectionRect.y + selectionRect.h / 2;

                // We want to map current screen point (selCenterX, selCenterY) 
                // to the center of the viewport (rect.width/2, rect.height/2).
                // New pan = screenCenter - actualRatio * (screenPoint - oldPan)
                setPan({
                    x: (rect.width / 2) - actualRatio * (selCenterX - pan.x),
                    y: (rect.height / 2) - actualRatio * (selCenterY - pan.y),
                });
                setZoom(newZoom);
            }
        }
        setSelectionRect(null);
        dragModeRef.current = null;
        setTimeout(() => setIsDragging(false), 50);
    }, [selectionRect, zoom, pan]);

    // Registrar wheel con passive: false
    useEffect(() => {
        const el = contentRef.current;
        if (!el) return;
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [handleWheel]);

    // Mouse move/up global
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    // ─── Helpers ────────────
    const getThumbUrl = useCallback((page) =>
        `/projects/${projectId}/thumbnail/${encodeURIComponent(filename)}/page/${page}?width=1200`,
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
    const [currentSpread, setCurrentSpread] = useState(0);
    const totalSpreads = Math.ceil((totalPages + 1) / 2);

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
        resetZoom();

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
                fetchThumb(currentPage + 1);
                fetchThumb(currentPage - 1);
            } else {
                const { left, right } = getSpreadPages(currentSpread);
                const promises = [];
                if (left) promises.push(fetchThumb(left));
                if (right) promises.push(fetchThumb(right));
                await Promise.all(promises);
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

    const handleModeChange = (_, newMode) => {
        if (!newMode) return;
        if (newMode === 'book') {
            if (currentPage === 1) setCurrentSpread(0);
            else setCurrentSpread(Math.floor(currentPage / 2));
        } else {
            const { left, right } = getSpreadPages(currentSpread);
            setCurrentPage(left || right || 1);
        }
        setViewMode(newMode);
    };

    const spreadPageLabel = () => {
        const { left, right } = getSpreadPages(currentSpread);
        if (left && right) return `Págs. ${left}-${right}`;
        if (left) return `Pág. ${left}`;
        if (right) return `Pág. ${right}`;
        return '';
    };

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

    // ─── Zoom transform style ────────────
    const zoomStyle = zoom > 1 ? {
        transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
        transformOrigin: '0 0',
        cursor: isDragging ? 'grabbing' : 'grab',
    } : {
        cursor: 'crosshair',
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

                {/* Zoom controls */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <Tooltip title="Zoom out">
                        <IconButton size="small" onClick={() => {
                            setZoom(z => {
                                const nz = Math.max(MIN_ZOOM, z - ZOOM_STEP * 2);
                                if (nz === MIN_ZOOM) setPan({ x: 0, y: 0 });
                                return nz;
                            });
                        }} disabled={zoom <= MIN_ZOOM} sx={{ p: 0.5 }}>
                            <ZoomOutIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </Tooltip>
                    <Typography variant="caption" sx={{
                        minWidth: 36, textAlign: 'center',
                        fontWeight: 600, fontSize: 11, color: zoom > 1 ? 'primary.main' : 'text.secondary',
                        userSelect: 'none'
                    }}>
                        {Math.round(zoom * 100)}%
                    </Typography>
                    <Tooltip title="Zoom in">
                        <IconButton size="small" onClick={() => {
                            setZoom(z => Math.min(MAX_ZOOM, z + ZOOM_STEP * 2));
                        }} disabled={zoom >= MAX_ZOOM} sx={{ p: 0.5 }}>
                            <ZoomInIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </Tooltip>
                    {zoom > 1 && (
                        <Tooltip title="Resetear zoom">
                            <IconButton size="small" onClick={resetZoom} sx={{ p: 0.5 }}>
                                <CenterFocusStrongIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>

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
            <Box
                ref={contentRef}
                onMouseDown={handleMouseDown}
                onDoubleClick={handleDoubleClick}
                sx={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', p: 1, minHeight: 300, position: 'relative',
                    backgroundColor: viewMode === 'book' ? '#2c2c2c' : '#f8f9fa',
                    transition: 'background-color 0.3s',
                    userSelect: 'none',
                }}
            >
                {/* Selection rectangle overlay */}
                {selectionRect && selectionRect.w > 5 && selectionRect.h > 5 && (
                    <Box sx={{
                        position: 'absolute',
                        left: selectionRect.x,
                        top: selectionRect.y,
                        width: selectionRect.w,
                        height: selectionRect.h,
                        border: '2px dashed',
                        borderColor: 'primary.main',
                        backgroundColor: 'rgba(25, 118, 210, 0.1)',
                        borderRadius: '4px',
                        zIndex: 100,
                        pointerEvents: 'none',
                    }} />
                )}
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
                        width: '100%', height: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        ...zoomStyle,
                        transition: isDragging ? 'none' : 'transform 0.15s ease',
                    }}>
                        {pageCache[currentPage] ? (
                            <Box
                                component="img"
                                src={pageCache[currentPage]}
                                alt={`Página ${currentPage}`}
                                draggable={false}
                                sx={{
                                    width: '100%', height: '100%',
                                    objectFit: 'contain', borderRadius: 1,
                                    boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                                    pointerEvents: 'none',
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
                        perspective: zoom > 1 ? 'none' : '1500px',
                        width: '100%', height: '100%',
                        ...zoomStyle,
                        transition: isDragging ? 'none' : 'transform 0.15s ease',
                    }}>
                        {/* Book container */}
                        <Box sx={{
                            display: 'flex',
                            width: '95%',
                            height: '95%',
                            maxHeight: '100%',
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
                                    <Box sx={{
                                        position: 'absolute', bottom: 8, right: 12,
                                        bgcolor: 'rgba(0,0,0,0.55)', color: 'white',
                                        borderRadius: '12px', px: 1.5, py: 0.25,
                                        fontSize: 11, fontWeight: 600
                                    }}>1</Box>
                                </Box>
                            ) : (
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

                                    {/* Flip overlay */}
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
