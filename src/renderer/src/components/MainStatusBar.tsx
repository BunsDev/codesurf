import { useEffect, useMemo, useState } from 'react'
import { useAppFonts } from '../FontContext'
import { useTheme } from '../ThemeContext'

type MemoryStats = {
  rss: number
  heapTotal: number
  heapUsed: number
  heapLimit: number
  external: number
  arrayBuffers: number
  bus: { channels: number; events: number; subscriptions: number; readCursors: number }
}

type DaemonStatus = {
  running: boolean
  info: {
    pid: number
    port: number
    startedAt: string
    protocolVersion: number
    appVersion: string | null
  } | null
}

const REFRESH_MS = 1500
const DAEMON_REFRESH_MS = 5000

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const precision = value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(precision)} ${units[unitIndex]}`
}

export function MainStatusBar(): JSX.Element {
  const theme = useTheme()
  const fonts = useAppFonts()
  const [stats, setStats] = useState<MemoryStats | null>(null)
  const [daemon, setDaemon] = useState<DaemonStatus | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = () => {
      window.electron.system.memStats().then(next => {
        if (!cancelled) setStats(next)
      }).catch(() => {})
    }

    load()
    const interval = window.setInterval(load, REFRESH_MS)
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const load = () => {
      window.electron.system.daemonStatus().then(next => {
        if (!cancelled) setDaemon(next)
      }).catch(() => {
        if (!cancelled) setDaemon({ running: false, info: null })
      })
    }

    load()
    const interval = window.setInterval(load, DAEMON_REFRESH_MS)
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  const usage = useMemo(() => {
    const heapLimit = stats?.heapLimit && stats.heapLimit > 0 ? stats.heapLimit : stats?.heapTotal ?? 0
    const heapUsed = stats?.heapUsed ?? 0
    const heapTotal = stats?.heapTotal ?? 0
    const ratio = heapLimit > 0 ? Math.min(1, heapUsed / heapLimit) : 0
    const committedRatio = heapLimit > 0 ? Math.min(1, heapTotal / heapLimit) : 0
    return { heapLimit, heapUsed, heapTotal, ratio, committedRatio }
  }, [stats])

  const fillColor = usage.ratio >= 0.85
    ? theme.status.danger
    : usage.ratio >= 0.7
      ? theme.status.warning
      : theme.accent.base

  const barBackground = theme.mode === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
  const title = stats
    ? `Main heap ${formatBytes(usage.heapUsed)} / ${formatBytes(usage.heapLimit || usage.heapTotal)} - RSS ${formatBytes(stats.rss)} - external ${formatBytes(stats.external)}`
    : 'Loading memory stats'
  const daemonTitle = daemon?.running
    ? `CodeSurf daemon active - PID ${daemon.info?.pid ?? 'unknown'} - port ${daemon.info?.port ?? 'unknown'}`
    : 'CodeSurf daemon offline'
  const daemonColor = daemon == null
    ? theme.text.disabled
    : daemon.running
      ? theme.text.secondary
      : theme.status.danger
  const daemonDot = daemon == null
    ? theme.text.disabled
    : daemon.running
      ? theme.status.success
      : theme.status.danger

  return (
    <div
      title={title}
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0 16px',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          minWidth: 0,
          width: 'min(760px, 100%)',
          justifyContent: 'flex-end',
          color: theme.text.secondary,
          fontFamily: fonts.secondary,
          fontSize: Math.max(10, fonts.secondarySize - 2),
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: 0.2,
        }}
      >
        <div
          title={daemonTitle}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: daemonDot,
              boxShadow: daemon?.running ? `0 0 8px ${daemonDot}66` : 'none',
              flexShrink: 0,
            }}
          />
          <span style={{ color: daemonColor }}>
            {daemon?.running ? 'Daemon active' : daemon == null ? 'Daemon' : 'Daemon offline'}
          </span>
        </div>

        <span style={{ color: theme.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, fontSize: Math.max(9, fonts.secondarySize - 3) }}>
          Memory
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, maxWidth: 320 }}>
          <div
            style={{
              position: 'relative',
              flex: 1,
              height: 8,
              borderRadius: 999,
              overflow: 'hidden',
              background: barBackground,
              minWidth: 90,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${usage.committedRatio * 100}%`,
                background: theme.border.strong,
                opacity: 0.35,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${usage.ratio * 100}%`,
                background: fillColor,
                boxShadow: `0 0 10px ${fillColor}55`,
              }}
            />
          </div>
          <span style={{ whiteSpace: 'nowrap', color: usage.ratio >= 0.85 ? theme.status.danger : theme.text.secondary }}>
            {formatBytes(usage.heapUsed)} / {formatBytes(usage.heapLimit || usage.heapTotal)}
          </span>
        </div>

        <span style={{ whiteSpace: 'nowrap', color: theme.text.secondary }}>
          RSS {formatBytes(stats?.rss ?? 0)}
        </span>

        <span style={{ whiteSpace: 'nowrap', color: theme.text.secondary }}>
          {Math.round(usage.ratio * 100)}%
        </span>
      </div>
    </div>
  )
}

export default MainStatusBar
