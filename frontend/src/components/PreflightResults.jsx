import React from 'react'
import { Box, Typography, Chip, Stack, Accordion, AccordionSummary, AccordionDetails, Divider } from '@mui/material'
import {
    CheckCircle, Warning, Error as ErrorIcon, Info, ExpandMore,
    Description, ColorLens, TextFields, Image, Straighten, Layers, Security
} from '@mui/icons-material'

const statusConfig = {
    PASS: { color: 'success', icon: <CheckCircle />, label: 'APROBADO', bgColor: '#ecfdf5' },
    WARN: { color: 'warning', icon: <Warning />, label: 'ADVERTENCIAS', bgColor: '#fffbeb' },
    FAIL: { color: 'error', icon: <ErrorIcon />, label: 'ERRORES', bgColor: '#fef2f2' },
    pending: { color: 'default', icon: <Info />, label: 'PENDIENTE', bgColor: '#f3f4f6' },
}

const severityConfig = {
    error: { icon: <ErrorIcon fontSize="small" />, color: '#ef4444', bgColor: '#fef2f2' },
    warning: { icon: <Warning fontSize="small" />, color: '#f59e0b', bgColor: '#fffbeb' },
    info: { icon: <Info fontSize="small" />, color: '#3b82f6', bgColor: '#eff6ff' },
}

const getCheckIcon = (code) => {
    if (!code) return <Description fontSize="small" />
    const c = code.toUpperCase()
    if (c.includes('FONT')) return <TextFields fontSize="small" />
    if (c.includes('COLOR') || c.includes('CMYK') || c.includes('RGB') || c.includes('SPOT')) return <ColorLens fontSize="small" />
    if (c.includes('IMAGE') || c.includes('RES')) return <Image fontSize="small" />
    if (c.includes('PAGE') || c.includes('TRIM') || c.includes('BLEED') || c.includes('MEDIA')) return <Straighten fontSize="small" />
    if (c.includes('TRANSPARENCY')) return <Layers fontSize="small" />
    if (c.includes('ENCRYPT')) return <Security fontSize="small" />
    return <Description fontSize="small" />
}

const CheckItem = ({ check }) => {
    const sev = severityConfig[check.severity] || severityConfig.info

    return (
        <Box sx={{
            display: 'flex', alignItems: 'flex-start', gap: 1.5, p: 1.5, borderRadius: 2,
            backgroundColor: sev.bgColor, mb: 1, border: `1px solid ${sev.color}20`
        }}>
            <Box sx={{ color: sev.color, mt: 0.3, display: 'flex' }}>
                {getCheckIcon(check.code)}
            </Box>
            <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500, color: '#1f2937' }}>
                    {check.message}
                </Typography>
                {check.code && (
                    <Typography variant="caption" sx={{ color: '#9ca3af', mt: 0.3, display: 'block' }}>
                        {check.code}{check.page ? ` — Pág. ${check.page}` : ''}
                    </Typography>
                )}
            </Box>
        </Box>
    )
}

const CheckSection = ({ title, checks, icon, defaultExpanded = false }) => {
    if (!checks || checks.length === 0) return null

    return (
        <Accordion defaultExpanded={defaultExpanded} sx={{ boxShadow: 'none', '&:before': { display: 'none' }, mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2, minHeight: 48, '& .MuiAccordionSummary-content': { my: 1 } }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    {icon}
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{title}</Typography>
                    <Chip label={checks.length} size="small" sx={{ height: 20, fontSize: 11 }} />
                </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pt: 0 }}>
                {checks.map((check, idx) => (
                    <CheckItem key={idx} check={check} />
                ))}
            </AccordionDetails>
        </Accordion>
    )
}

const SummaryItem = ({ label, value }) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{value}</Typography>
    </Box>
)

const PreflightResults = ({ result }) => {
    if (!result) return null

    const config = statusConfig[result.status] || statusConfig.pending
    const summary = result.summary || {}

    return (
        <Box>
            {/* Status badge */}
            <Box sx={{
                p: 2.5, borderRadius: 3, backgroundColor: config.bgColor, mb: 2,
                display: 'flex', alignItems: 'center', gap: 2
            }}>
                <Box sx={{ color: config.color === 'success' ? '#10b981' : config.color === 'warning' ? '#f59e0b' : '#ef4444', fontSize: 32, display: 'flex' }}>
                    {config.icon && React.cloneElement(config.icon, { sx: { fontSize: 40 } })}
                </Box>
                <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {config.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {result.errors?.length || 0} errores · {result.warnings?.length || 0} advertencias · {result.info?.length || 0} info
                    </Typography>
                </Box>
            </Box>

            {/* Summary */}
            {summary && Object.keys(summary).length > 0 && (
                <Box sx={{ mb: 2, p: 2, borderRadius: 2, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Resumen</Typography>
                    {summary.pages && <SummaryItem label="Páginas" value={summary.pages} />}
                    {summary.pdf_version && <SummaryItem label="Versión PDF" value={summary.pdf_version} />}
                    {summary.page_sizes && <SummaryItem label="Tamaño" value={Array.isArray(summary.page_sizes) ? summary.page_sizes.join(', ') : summary.page_sizes} />}
                    {summary.file_size_mb && <SummaryItem label="Tamaño archivo" value={`${summary.file_size_mb} MB`} />}
                    {summary.color_spaces && summary.color_spaces.length > 0 && (
                        <SummaryItem label="Espacios de color" value={summary.color_spaces.join(', ')} />
                    )}
                    {summary.pdfx_version && <SummaryItem label="PDF/X" value={summary.pdfx_version} />}
                    {summary.has_transparency !== undefined && <SummaryItem label="Transparencias" value={summary.has_transparency ? 'Sí' : 'No'} />}
                </Box>
            )}

            {/* Errors */}
            <CheckSection
                title="Errores"
                checks={result.errors}
                icon={<ErrorIcon sx={{ color: '#ef4444' }} fontSize="small" />}
                defaultExpanded={true}
            />

            {/* Warnings */}
            <CheckSection
                title="Advertencias"
                checks={result.warnings}
                icon={<Warning sx={{ color: '#f59e0b' }} fontSize="small" />}
                defaultExpanded={true}
            />

            {/* Info */}
            <CheckSection
                title="Información"
                checks={result.info}
                icon={<Info sx={{ color: '#3b82f6' }} fontSize="small" />}
                defaultExpanded={false}
            />

            {result.analyzed_at && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'right' }}>
                    Analizado: {new Date(result.analyzed_at).toLocaleString('es-ES')}
                </Typography>
            )}
        </Box>
    )
}

export default PreflightResults
