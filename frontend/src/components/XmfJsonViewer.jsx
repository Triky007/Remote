import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import api from '../api/apiService'
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Typography, Box, CircularProgress, IconButton, Tooltip, Alert
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DownloadIcon from '@mui/icons-material/Download'
import CodeIcon from '@mui/icons-material/Code'
import SendIcon from '@mui/icons-material/Send'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import useShowComponentNames from '../hooks/useShowComponentNames'

// ── JSON rendering helpers ──

const JsonValue = ({ value }) => {
    if (value === null) return <span style={{ color: '#569cd6' }}>null</span>
    if (typeof value === 'boolean') return <span style={{ color: '#569cd6' }}>{value.toString()}</span>
    if (typeof value === 'number') return <span style={{ color: '#b5cea8' }}>{value}</span>
    if (typeof value === 'string') return <span style={{ color: '#ce9178' }}>&quot;{value}&quot;</span>
    return null
}
JsonValue.propTypes = { value: PropTypes.any }

const countLines = (data, collapsed = false) => {
    if (data === null || typeof data !== 'object') return 1
    if (collapsed) return 1
    const items = Array.isArray(data) ? data : Object.values(data)
    if (items.length === 0) return 1
    let total = 1
    items.forEach(item => { total += countLines(item, false) })
    return total + 1
}

const JsonNode = ({ data, name, level = 0, isLast = true, expandAll, lineNumber }) => {
    const [collapsed, setCollapsed] = useState(level > 2)

    useEffect(() => {
        if (expandAll !== undefined) setCollapsed(!expandAll)
    }, [expandAll])

    const isArray = Array.isArray(data)
    const isObject = data !== null && typeof data === 'object' && !isArray
    const isPrimitive = !isArray && !isObject
    const indent = level * 20

    if (isPrimitive) {
        return (
            <Box sx={{ display: 'flex', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                <Box sx={{ minWidth: '50px', textAlign: 'right', pr: 2, color: '#858585', userSelect: 'none', borderRight: '1px solid #3e3e3e' }}>{lineNumber}</Box>
                <Box sx={{ pl: `${indent + 16}px`, flex: 1 }}>
                    {name && <><span style={{ color: '#9cdcfe' }}>&quot;{name}&quot;</span><span style={{ color: '#d4d4d4' }}>: </span></>}
                    <JsonValue value={data} />
                    {!isLast && <span style={{ color: '#d4d4d4' }}>,</span>}
                </Box>
            </Box>
        )
    }

    const length = isArray ? data.length : Object.keys(data).length
    const openBracket = isArray ? '[' : '{'
    const closeBracket = isArray ? ']' : '}'
    let childLineNumber = (lineNumber || 1) + 1
    const childrenWithLineNumbers = []

    if (!collapsed && length > 0) {
        const entries = isArray ? data.map((item, idx) => [idx, item]) : Object.entries(data)
        entries.forEach(([key, value], index) => {
            childrenWithLineNumbers.push({ key, name: isArray ? undefined : key, data: value, level: level + 1, isLast: index === entries.length - 1, lineNumber: childLineNumber })
            childLineNumber += countLines(value, false)
        })
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                <Box sx={{ minWidth: '50px', textAlign: 'right', pr: 2, color: collapsed ? '#4a9eff' : '#858585', userSelect: 'none', borderRight: '1px solid #3e3e3e' }}>{lineNumber || 1}</Box>
                <Box sx={{ pl: `${indent + 16}px`, flex: 1, display: 'flex', alignItems: 'center', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }} onClick={() => setCollapsed(!collapsed)}>
                    <IconButton size="small" sx={{ p: 0, mr: 0.5, color: '#d4d4d4', width: 16, height: 16 }}>
                        {collapsed ? <ChevronRightIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
                    </IconButton>
                    {name && <><span style={{ color: '#9cdcfe' }}>&quot;{name}&quot;</span><span style={{ color: '#d4d4d4' }}>: </span></>}
                    <span style={{ color: '#d4d4d4' }}>{openBracket}</span>
                    {collapsed && <><span style={{ color: '#858585', marginLeft: 4 }}>{length} {isArray ? 'items' : 'properties'}</span><span style={{ color: '#d4d4d4', marginLeft: 4 }}>{closeBracket}</span></>}
                    {!collapsed && length === 0 && <span style={{ color: '#d4d4d4' }}>{closeBracket}</span>}
                    {!isLast && collapsed && <span style={{ color: '#d4d4d4' }}>,</span>}
                </Box>
            </Box>
            {!collapsed && length > 0 && (
                <>
                    {childrenWithLineNumbers.map((child) => (
                        <JsonNode key={child.key} name={child.name} data={child.data} level={child.level} isLast={child.isLast} expandAll={expandAll} lineNumber={child.lineNumber} />
                    ))}
                    <Box sx={{ display: 'flex', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        <Box sx={{ minWidth: '50px', textAlign: 'right', pr: 2, color: '#858585', userSelect: 'none', borderRight: '1px solid #3e3e3e' }}>{childLineNumber}</Box>
                        <Box sx={{ pl: `${indent + 16}px`, flex: 1 }}>
                            <span style={{ color: '#d4d4d4' }}>{closeBracket}</span>
                            {!isLast && <span style={{ color: '#d4d4d4' }}>,</span>}
                        </Box>
                    </Box>
                </>
            )}
        </Box>
    )
}
JsonNode.propTypes = { data: PropTypes.any, name: PropTypes.string, level: PropTypes.number, isLast: PropTypes.bool, expandAll: PropTypes.bool, lineNumber: PropTypes.number }

const JsonHighlight = ({ data, expandAll }) => (
    <Box sx={{ fontFamily: 'monospace', fontSize: '0.85rem', minHeight: '100%', py: 1, px: 2, bgcolor: '#1e1e1e', color: '#d4d4d4' }}>
        <JsonNode data={data} expandAll={expandAll} lineNumber={1} />
    </Box>
)
JsonHighlight.propTypes = { data: PropTypes.object.isRequired, expandAll: PropTypes.bool }

// ── Main component ──

const XmfJsonViewer = ({ projectId, onClose }) => {
    const showComponentNames = useShowComponentNames()
    const [jsonData, setJsonData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [copied, setCopied] = useState(false)
    const [expandAll, setExpandAll] = useState(undefined)
    const [sending, setSending] = useState(false)
    const [sendResult, setSendResult] = useState(null)

    useEffect(() => {
        const fetchPreview = async () => {
            try {
                setLoading(true)
                setError(null)
                const res = await api.get(`/xmf/preview/${projectId}`)
                setJsonData(res.data.json_ot)
            } catch (err) {
                setError(err.response?.data?.detail || 'Error al generar JSON XMF')
            } finally {
                setLoading(false)
            }
        }
        fetchPreview()
    }, [projectId])

    const copyToClipboard = () => {
        if (jsonData) {
            navigator.clipboard.writeText(JSON.stringify(jsonData, null, 2))
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    const downloadJson = () => {
        if (jsonData) {
            const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `xmf_${jsonData.job_id || projectId}.json`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        }
    }

    const handleSend = async () => {
        setSending(true)
        setSendResult(null)
        try {
            const res = await api.post(`/xmf/send/${projectId}`)
            setSendResult(res.data)
        } catch (err) {
            setSendResult({ success: false, message: err.response?.data?.detail || 'Error al enviar a XMF' })
        } finally {
            setSending(false)
        }
    }

    return (
        <Dialog open={true} onClose={onClose} maxWidth="lg" fullWidth slotProps={{ paper: { sx: { height: '90vh' } } }}>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {showComponentNames && (
                    <Typography sx={{ fontSize: '0.65rem', color: 'rgba(0,0,0,0.45)', fontFamily: 'monospace', position: 'absolute', top: 8, left: 16 }}>
                        [XmfJsonViewer]
                    </Typography>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CodeIcon sx={{ mr: 1 }} />
                    JSON XMF — {jsonData?.job_id || 'cargando...'}
                </Box>
                {jsonData && (
                    <Box>
                        <Tooltip title="Expandir todo"><IconButton onClick={() => setExpandAll(true)}><UnfoldMoreIcon /></IconButton></Tooltip>
                        <Tooltip title="Colapsar todo"><IconButton onClick={() => setExpandAll(false)}><UnfoldLessIcon /></IconButton></Tooltip>
                        <Tooltip title={copied ? '¡Copiado!' : 'Copiar JSON'}><IconButton onClick={copyToClipboard} color={copied ? 'success' : 'default'}><ContentCopyIcon /></IconButton></Tooltip>
                        <Tooltip title="Descargar JSON"><IconButton onClick={downloadJson}><DownloadIcon /></IconButton></Tooltip>
                    </Box>
                )}
            </DialogTitle>
            <DialogContent dividers sx={{ p: 0, height: 'calc(90vh - 120px)', overflow: 'auto', bgcolor: '#1e1e1e' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box>
                ) : error ? (
                    <Box sx={{ p: 2 }}><Typography color="error">Error: {error}</Typography></Box>
                ) : jsonData ? (
                    <JsonHighlight data={jsonData} expandAll={expandAll} />
                ) : (
                    <Box sx={{ p: 2 }}><Typography>No se encontraron datos</Typography></Box>
                )}
            </DialogContent>
            <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
                <Box>
                    {sendResult && (
                        <Alert severity={sendResult.success ? 'success' : 'error'} sx={{ py: 0 }}>
                            {sendResult.message}
                        </Alert>
                    )}
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button onClick={onClose}>Cerrar</Button>
                    <Button
                        variant="contained"
                        color="success"
                        startIcon={sending ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                        onClick={handleSend}
                        disabled={sending || !jsonData}
                    >
                        {sending ? 'Enviando...' : 'Enviar a XMF'}
                    </Button>
                </Box>
            </DialogActions>
        </Dialog>
    )
}

XmfJsonViewer.propTypes = {
    projectId: PropTypes.string.isRequired,
    onClose: PropTypes.func.isRequired
}

export default XmfJsonViewer
