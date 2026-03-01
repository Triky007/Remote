import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/apiService'
import {
    Box, Typography, Paper, AppBar, Toolbar, IconButton, Chip, CircularProgress,
    Alert, Tooltip, Button, FormControl, InputLabel, Select, MenuItem, TextField
} from '@mui/material'
import {
    ArrowBack, ChevronLeft, ChevronRight, Today, ZoomIn, ZoomOut, CalendarViewWeek
} from '@mui/icons-material'

// ─── Constants ───────────────────────────────────────────────────────────────
const STATUS_COLORS = {
    pending: '#ff9800',
    in_progress: '#2196f3',
    completed: '#4caf50',
    cancelled: '#9e9e9e',
}
const STATUS_LABELS = {
    pending: 'Pendiente',
    in_progress: 'En Proceso',
    completed: 'Completado',
    cancelled: 'Cancelado',
}
const MACHINE_ROW_HEIGHT = 80
const MACHINES_COLUMN_WIDTH = 200
const HEADER_HEIGHT = 60

// ─── Helpers ─────────────────────────────────────────────────────────────────
const addDays = (date, days) => {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    return d
}

const startOfDay = (date) => {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
}

const endOfDay = (date) => {
    const d = new Date(date)
    d.setHours(23, 59, 59, 999)
    return d
}

const eachDayOfInterval = (start, end) => {
    const days = []
    let current = startOfDay(start)
    const last = startOfDay(end)
    while (current <= last) {
        days.push(new Date(current))
        current = addDays(current, 1)
    }
    return days
}

const formatDay = (date) =>
    date.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' })

const formatHour = (h) => `${String(h).padStart(2, '0')}:00`

const isToday = (date) => {
    const now = new Date()
    return date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
}

// ─── Main Component ──────────────────────────────────────────────────────────
const PlanningPage = () => {
    const navigate = useNavigate()
    const scrollRef = useRef(null)

    // Data
    const [processes, setProcesses] = useState([])
    const [machines, setMachines] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // View state
    const [currentDate, setCurrentDate] = useState(new Date())
    const [daysBefore, setDaysBefore] = useState(1)
    const [daysAfter, setDaysAfter] = useState(4)
    const [pixelsPerHour, setPixelsPerHour] = useState(60)
    const [filterStatus, setFilterStatus] = useState('all')
    const [currentTime, setCurrentTime] = useState(new Date())

    // Auto-update current time every minute
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 60000)
        return () => clearInterval(interval)
    }, [])

    // ─── Data loading ──────────────────────────────────────────────────────
    const loadData = useCallback(async () => {
        try {
            const [procRes, machRes] = await Promise.all([
                api.get('/planning/processes'),
                api.get('/machines?active_only=true'),
            ])
            setProcesses(procRes.data.processes || [])
            setMachines(machRes.data || [])
        } catch (err) {
            setError('Error cargando datos de planificación')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    // ─── Layout calculations ───────────────────────────────────────────────
    const dateRange = useMemo(() => ({
        start: startOfDay(addDays(currentDate, -daysBefore)),
        end: endOfDay(addDays(currentDate, daysAfter)),
    }), [currentDate, daysBefore, daysAfter])

    const days = useMemo(() =>
        eachDayOfInterval(dateRange.start, dateRange.end),
        [dateRange]
    )

    const dayWidth = useMemo(() => 24 * pixelsPerHour, [pixelsPerHour])
    const totalWidth = days.length * dayWidth

    const displayHours = useMemo(() => {
        const hours = []
        const step = pixelsPerHour >= 40 ? 1 : pixelsPerHour >= 20 ? 2 : 4
        for (let i = 0; i < 24; i += step) hours.push(i)
        return hours
    }, [pixelsPerHour])

    // Show all active machines (including those without processes yet)
    const activeMachines = useMemo(() => machines, [machines])

    // Filter processes
    const filteredProcesses = useMemo(() =>
        processes.filter(p => {
            if (!p.start_date || !p.end_date) return false
            const pStart = new Date(p.start_date)
            const pEnd = new Date(p.end_date)
            if (pStart > dateRange.end || pEnd < dateRange.start) return false
            if (filterStatus !== 'all' && p.status !== filterStatus) return false
            return true
        }),
        [processes, dateRange, filterStatus]
    )

    // Get processes for a machine
    const getMachineProcesses = useCallback((machineId) =>
        filteredProcesses
            .filter(p => p.machine_id === machineId)
            .sort((a, b) => new Date(a.start_date) - new Date(b.start_date)),
        [filteredProcesses]
    )

    // Process position calculation
    const getProcessPosition = useCallback((proc) => {
        const pStart = new Date(proc.start_date)
        const pEnd = new Date(proc.end_date)
        const rangeStartMs = dateRange.start.getTime()
        const startMs = Math.max(pStart.getTime(), rangeStartMs)
        const endMs = Math.min(pEnd.getTime(), dateRange.end.getTime())

        const left = ((startMs - rangeStartMs) / 3600000) * pixelsPerHour
        const width = Math.max(20, ((endMs - startMs) / 3600000) * pixelsPerHour)

        return { left, width }
    }, [dateRange, pixelsPerHour])

    // Current time position
    const currentTimePos = useMemo(() => {
        const now = currentTime
        if (now < dateRange.start || now > dateRange.end) return null
        return ((now.getTime() - dateRange.start.getTime()) / 3600000) * pixelsPerHour
    }, [currentTime, dateRange, pixelsPerHour])

    // ─── Navigation ────────────────────────────────────────────────────────
    const goToToday = () => {
        setCurrentDate(new Date())
        setTimeout(() => {
            if (scrollRef.current && currentTimePos !== null) {
                const w = scrollRef.current.clientWidth
                scrollRef.current.scrollLeft = Math.max(0, currentTimePos - w / 2)
            }
        }, 100)
    }

    // Center on load
    useEffect(() => {
        if (!loading && scrollRef.current && currentTimePos !== null) {
            const w = scrollRef.current.clientWidth
            scrollRef.current.scrollLeft = Math.max(0, currentTimePos - w / 2)
        }
    }, [loading]) // eslint-disable-line

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <CircularProgress size={60} />
            </Box>
        )
    }

    return (
        <Box sx={{ minHeight: '100vh', backgroundColor: '#f0f2f5', display: 'flex', flexDirection: 'column' }}>
            {/* AppBar */}
            <AppBar position="sticky" sx={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)' }}>
                <Toolbar>
                    <IconButton color="inherit" onClick={() => navigate('/admin')} sx={{ mr: 1 }}>
                        <ArrowBack />
                    </IconButton>
                    <CalendarViewWeek sx={{ mr: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
                        Planificación
                    </Typography>
                    <Chip label={`${filteredProcesses.length} procesos`} color="warning" size="small" />
                </Toolbar>
            </AppBar>

            {error && <Alert severity="error" sx={{ m: 2 }} onClose={() => setError(null)}>{error}</Alert>}

            {/* Toolbar */}
            <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, backgroundColor: '#fff',
                borderBottom: '1px solid #e0e0e0', flexWrap: 'nowrap', overflowX: 'auto'
            }}>
                {/* Status filter */}
                <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel sx={{ fontSize: '0.8rem' }}>Estado</InputLabel>
                    <Select value={filterStatus} label="Estado" sx={{ fontSize: '0.8rem', height: 32 }}
                        onChange={(e) => setFilterStatus(e.target.value)}>
                        <MenuItem value="all">Todos</MenuItem>
                        <MenuItem value="pending">Pendiente</MenuItem>
                        <MenuItem value="in_progress">En Proceso</MenuItem>
                        <MenuItem value="completed">Completado</MenuItem>
                    </Select>
                </FormControl>

                {/* Zoom */}
                <Tooltip title={`Zoom: ${pixelsPerHour} px/h`}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <IconButton size="small" onClick={() => setPixelsPerHour(p => Math.max(15, p - 10))}>
                            <ZoomOut fontSize="small" />
                        </IconButton>
                        <Button variant="outlined" size="small" onClick={() => setPixelsPerHour(60)}
                            sx={{ minWidth: 32, height: 28, px: 0.5, fontSize: '0.75rem' }}>
                            {pixelsPerHour}
                        </Button>
                        <IconButton size="small" onClick={() => setPixelsPerHour(p => Math.min(200, p + 10))}>
                            <ZoomIn fontSize="small" />
                        </IconButton>
                    </Box>
                </Tooltip>

                {/* Days range */}
                <TextField label="Antes" type="number" size="small" value={daysBefore}
                    onChange={(e) => setDaysBefore(Math.max(0, parseInt(e.target.value) || 0))}
                    sx={{ width: 60, '& .MuiInputBase-root': { height: 32 } }}
                    inputProps={{ style: { fontSize: '0.8rem', padding: '4px 6px' } }}
                    InputLabelProps={{ sx: { fontSize: '0.75rem' } }} />
                <TextField label="Después" type="number" size="small" value={daysAfter}
                    onChange={(e) => setDaysAfter(Math.max(1, parseInt(e.target.value) || 1))}
                    sx={{ width: 68, '& .MuiInputBase-root': { height: 32 } }}
                    inputProps={{ style: { fontSize: '0.8rem', padding: '4px 6px' } }}
                    InputLabelProps={{ sx: { fontSize: '0.75rem' } }} />

                <Box sx={{ flexGrow: 1 }} />

                {/* Navigation */}
                <IconButton size="small" onClick={() => setCurrentDate(d => addDays(d, -1))}>
                    <ChevronLeft />
                </IconButton>
                <Button variant="outlined" size="small" onClick={goToToday}
                    startIcon={<Today fontSize="small" />}
                    sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                    Hoy
                </Button>
                <IconButton size="small" onClick={() => setCurrentDate(d => addDays(d, 1))}>
                    <ChevronRight />
                </IconButton>
                <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap', minWidth: 100, textAlign: 'center' }}>
                    {currentDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Typography>
            </Box>

            {/* Main timeline area */}
            <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', m: 2 }}>
                {activeMachines.length === 0 ? (
                    <Paper sx={{ p: 4, textAlign: 'center' }}>
                        <CalendarViewWeek sx={{ fontSize: 64, color: '#ccc', mb: 2 }} />
                        <Typography color="text.secondary">
                            No hay procesos planificados. Aprueba un proyecto con procesos para verlos aquí.
                        </Typography>
                    </Paper>
                ) : (
                    <Paper elevation={2} sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <Box ref={scrollRef}
                            sx={{ flex: 1, overflow: 'auto', position: 'relative' }}>
                            <Box sx={{ display: 'flex', minWidth: 'fit-content' }}>
                                {/* ─── Machines column ─── */}
                                <Box sx={{
                                    width: MACHINES_COLUMN_WIDTH, minWidth: MACHINES_COLUMN_WIDTH,
                                    position: 'sticky', left: 0, zIndex: 20, backgroundColor: '#fff',
                                    borderRight: '2px solid #e0e0e0',
                                }}>
                                    {/* Header spacer */}
                                    <Box sx={{
                                        height: HEADER_HEIGHT, borderBottom: '1px solid #e0e0e0',
                                        display: 'flex', alignItems: 'center', px: 1.5,
                                        backgroundColor: '#f8fafc'
                                    }}>
                                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b' }}>
                                            MÁQUINAS
                                        </Typography>
                                    </Box>
                                    {/* Machine rows */}
                                    {activeMachines.map((machine, i) => (
                                        <Box key={machine.machine_id} sx={{
                                            height: MACHINE_ROW_HEIGHT, display: 'flex', alignItems: 'center',
                                            px: 1.5, borderBottom: '1px solid #f0f0f0',
                                            backgroundColor: i % 2 === 0 ? '#fff' : '#fafbfc',
                                            '&:hover': { backgroundColor: '#f0f7ff' },
                                        }}>
                                            <Box>
                                                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13 }}>
                                                    {machine.name}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {machine.type || ''}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    ))}
                                </Box>

                                {/* ─── Timeline area ─── */}
                                <Box sx={{ flex: 1, position: 'relative', minWidth: totalWidth }}>
                                    {/* Current time line */}
                                    {currentTimePos !== null && (
                                        <Box sx={{
                                            position: 'absolute', left: currentTimePos, top: 0,
                                            bottom: 0, width: 2, backgroundColor: '#ef4444',
                                            zIndex: 15, pointerEvents: 'none',
                                        }}>
                                            <Box sx={{
                                                position: 'absolute', top: 0, left: -20, width: 42,
                                                backgroundColor: '#ef4444', color: '#fff',
                                                fontSize: 10, textAlign: 'center', borderRadius: '0 0 4px 4px',
                                                py: 0.2, fontWeight: 700,
                                            }}>
                                                {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                            </Box>
                                        </Box>
                                    )}

                                    {/* Day headers + hour grid */}
                                    <Box sx={{
                                        height: HEADER_HEIGHT, display: 'flex', borderBottom: '1px solid #e0e0e0',
                                        position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#fff'
                                    }}>
                                        {days.map((day) => (
                                            <Box key={day.toISOString()} sx={{
                                                width: dayWidth, minWidth: dayWidth, borderRight: '1px solid #e0e0e0',
                                            }}>
                                                {/* Day label */}
                                                <Box sx={{
                                                    height: 28, display: 'flex', alignItems: 'center',
                                                    justifyContent: 'center', borderBottom: '1px solid #f0f0f0',
                                                    backgroundColor: isToday(day) ? '#e3f2fd' : '#f8fafc',
                                                }}>
                                                    <Typography variant="caption" sx={{
                                                        fontWeight: isToday(day) ? 700 : 500,
                                                        color: isToday(day) ? '#1565c0' : '#64748b',
                                                        fontSize: 11, textTransform: 'capitalize',
                                                    }}>
                                                        {formatDay(day)}
                                                    </Typography>
                                                </Box>
                                                {/* Hour labels */}
                                                <Box sx={{ height: HEADER_HEIGHT - 28, display: 'flex', position: 'relative' }}>
                                                    {displayHours.map(h => (
                                                        <Box key={h} sx={{
                                                            position: 'absolute', left: h * pixelsPerHour,
                                                            width: 1, height: '100%', borderLeft: '1px solid #f0f0f0',
                                                        }}>
                                                            <Typography variant="caption" sx={{
                                                                position: 'absolute', top: 4, left: 3,
                                                                fontSize: 9, color: '#94a3b8', whiteSpace: 'nowrap',
                                                            }}>
                                                                {formatHour(h)}
                                                            </Typography>
                                                        </Box>
                                                    ))}
                                                </Box>
                                            </Box>
                                        ))}
                                    </Box>

                                    {/* Machine timeline rows */}
                                    {activeMachines.map((machine, machineIndex) => {
                                        const machineProcs = getMachineProcesses(machine.machine_id)
                                        return (
                                            <Box key={machine.machine_id} sx={{
                                                height: MACHINE_ROW_HEIGHT, position: 'relative',
                                                borderBottom: '1px solid #f0f0f0',
                                                backgroundColor: machineIndex % 2 === 0 ? '#fff' : '#fafbfc',
                                            }}>
                                                {/* Vertical hour lines */}
                                                {days.map((day, dayIdx) =>
                                                    displayHours.map(h => (
                                                        <Box key={`${dayIdx}-${h}`} sx={{
                                                            position: 'absolute',
                                                            left: dayIdx * dayWidth + h * pixelsPerHour,
                                                            top: 0, bottom: 0, width: 1,
                                                            borderLeft: h === 0 ? '1px solid #e0e0e0' : '1px solid #f5f5f5',
                                                        }} />
                                                    ))
                                                )}

                                                {/* Process bars */}
                                                {machineProcs.map(proc => {
                                                    const pos = getProcessPosition(proc)
                                                    if (!pos) return null
                                                    const color = STATUS_COLORS[proc.status] || '#9e9e9e'
                                                    return (
                                                        <Tooltip key={proc.process_id} arrow placement="top" title={
                                                            <Box>
                                                                <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{proc.name}</Typography>
                                                                <Typography sx={{ fontSize: 11 }}>Proyecto: {proc.project_name}</Typography>
                                                                <Typography sx={{ fontSize: 11 }}>
                                                                    {new Date(proc.start_date).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                                    {' → '}
                                                                    {new Date(proc.end_date).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                                </Typography>
                                                                <Typography sx={{ fontSize: 11 }}>
                                                                    {proc.estimated_hours}h — {STATUS_LABELS[proc.status] || proc.status}
                                                                </Typography>
                                                            </Box>
                                                        }>
                                                            <Box sx={{
                                                                position: 'absolute',
                                                                left: pos.left, width: pos.width,
                                                                top: 8, height: MACHINE_ROW_HEIGHT - 16,
                                                                backgroundColor: color,
                                                                borderRadius: 1,
                                                                cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center',
                                                                px: 0.8, overflow: 'hidden',
                                                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                                                transition: 'transform 0.1s',
                                                                '&:hover': {
                                                                    transform: 'scaleY(1.1)',
                                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                                                    zIndex: 5,
                                                                },
                                                            }}
                                                                onClick={() => navigate(`/admin/project/${proc.project_id}`)}
                                                            >
                                                                <Typography noWrap sx={{
                                                                    color: '#fff', fontSize: 11, fontWeight: 600,
                                                                    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                                                }}>
                                                                    {pos.width > 60 ? proc.name : ''}
                                                                </Typography>
                                                            </Box>
                                                        </Tooltip>
                                                    )
                                                })}
                                            </Box>
                                        )
                                    })}
                                </Box>
                            </Box>
                        </Box>
                    </Paper>
                )}
            </Box>
        </Box>
    )
}

export default PlanningPage
