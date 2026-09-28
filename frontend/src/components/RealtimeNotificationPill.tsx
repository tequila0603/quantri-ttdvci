import { useEffect, useRef, useState } from 'react'
import {
  CircleAlert,
  Flame,
  Wrench,
  Building2,
  Trash2,
  Pencil,
  Plus,
  ArrowRight,
  X,
  Radio,
} from 'lucide'
import type { NotificationItem } from '../realtime/types.js'

function LucideIcon({
  icon,
  className = 'w-4 h-4',
  ariaHidden = true,
}: {
  icon: any
  className?: string
  ariaHidden?: boolean
}) {
  if (!Array.isArray(icon)) return null
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      {icon.map(([tag, attrs], idx) => {
        const TagName = tag as any
        return <TagName key={idx} {...attrs} />
      })}
    </svg>
  )
}

export type RealtimeNotificationPillProps = {
  item: NotificationItem | null
  onDismiss: () => void
  onNavigate: (item: NotificationItem) => void
}

export function RealtimeNotificationPill({
  item,
  onDismiss,
  onNavigate,
}: RealtimeNotificationPillProps) {
  const [phase, setPhase] = useState<'entering' | 'expanded' | 'exiting'>('entering')
  const [isPaused, setIsPaused] = useState(false)
  const timerRef = useRef<any>(null)
  const remainingTimeRef = useRef(4800)
  const lastStartRef = useRef(Date.now())

  // Prefers reduced motion detection
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener('change', listener)
    return () => mediaQuery.removeEventListener('change', listener)
  }, [])

  // Manage lifecycle: entering -> expanded -> exiting -> dismiss
  useEffect(() => {
    if (!item) return

    setPhase('entering')
    remainingTimeRef.current = 4800
    lastStartRef.current = Date.now()

    // Short delay before expanding Dynamic Island (skip if prefersReducedMotion)
    const expandDelay = prefersReducedMotion ? 20 : 120
    const expandTimer = setTimeout(() => {
      setPhase('expanded')
    }, expandDelay)

    return () => {
      clearTimeout(expandTimer)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [item?.id, prefersReducedMotion])

  // Countdown for auto-dismiss
  useEffect(() => {
    if (!item || phase !== 'expanded') return

    if (!isPaused) {
      lastStartRef.current = Date.now()
      timerRef.current = setTimeout(() => {
        setPhase('exiting')
        setTimeout(() => {
          onDismiss()
        }, prefersReducedMotion ? 50 : 250)
      }, remainingTimeRef.current)
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        const elapsed = Date.now() - lastStartRef.current
        remainingTimeRef.current = Math.max(1000, remainingTimeRef.current - elapsed)
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [item?.id, phase, isPaused, prefersReducedMotion, onDismiss])

  if (!item) return null

  const handleMouseEnter = () => setIsPaused(true)
  const handleMouseLeave = () => setIsPaused(false)
  const handleFocus = () => setIsPaused(true)
  const handleBlur = () => setIsPaused(false)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onDismiss()
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onNavigate(item)
    }
  }

  // Choose icon based on event
  const renderIcon = () => {
    if (item.action === 'DELETE') {
      return <LucideIcon icon={Trash2} className="w-4 h-4 text-red-400 shrink-0" />
    }
    if (item.isCritical) {
      return <LucideIcon icon={Flame} className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
    }
    if (item.isHigh) {
      return <LucideIcon icon={CircleAlert} className="w-4 h-4 text-amber-300 shrink-0" />
    }
    if (item.entityType === 'work_order') {
      return <LucideIcon icon={Wrench} className="w-4 h-4 text-sky-400 shrink-0" />
    }
    if (item.entityType.startsWith('infrastructure')) {
      return <LucideIcon icon={Building2} className="w-4 h-4 text-emerald-400 shrink-0" />
    }
    if (item.action === 'UPDATE') {
      return <LucideIcon icon={Pencil} className="w-4 h-4 text-blue-400 shrink-0" />
    }
    if (item.action === 'CREATE') {
      return <LucideIcon icon={Plus} className="w-4 h-4 text-emerald-400 shrink-0" />
    }
    return <LucideIcon icon={Radio} className="w-4 h-4 text-indigo-400 shrink-0" />
  }

  // Animation and styles
  const isCompact = phase === 'entering' && !prefersReducedMotion
  const isExiting = phase === 'exiting'

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
    left: '50%',
    transform: isExiting
      ? 'translate(-50%, -18px) scale(0.92)'
      : isCompact
        ? 'translate(-50%, -6px) scale(0.95)'
        : 'translate(-50%, 0) scale(1)',
    opacity: isExiting ? 0 : 1,
    zIndex: 9999,
    maxWidth: isCompact ? '180px' : 'min(92vw, 440px)',
    width: 'auto',
    transition: prefersReducedMotion
      ? 'opacity 150ms ease'
      : 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1), opacity 220ms ease, max-width 300ms cubic-bezier(0.16, 1, 0.3, 1)',
    pointerEvents: 'none',
  }

  const pillStyle: React.CSSProperties = {
    pointerEvents: 'auto',
    borderRadius: '9999px',
    background: 'linear-gradient(135deg, rgba(22, 27, 34, 0.92), rgba(13, 17, 23, 0.96))',
    border: item.isCritical
      ? '1px solid rgba(248, 113, 113, 0.5)'
      : item.isHigh
        ? '1px solid rgba(251, 191, 36, 0.4)'
        : '1px solid rgba(255, 255, 255, 0.14)',
    boxShadow: item.isCritical
      ? '0 12px 32px -4px rgba(239, 68, 68, 0.25), 0 4px 12px rgba(0, 0, 0, 0.5)'
      : '0 12px 32px -4px rgba(0, 0, 0, 0.6), 0 4px 12px rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
  }

  return (
    <div
      style={containerStyle}
      aria-live="polite"
      role={item.isCritical ? 'alert' : 'status'}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      <div
        style={pillStyle}
        className="px-3.5 py-2.5 flex items-center gap-3 text-white shadow-2xl select-none"
      >
        {/* Left icon / Indicator */}
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 shrink-0">
          {renderIcon()}
        </div>

        {/* Compact vs Expanded content */}
        {isCompact ? (
          <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs font-medium text-slate-200">
            <span className="truncate">{item.badge}</span>
          </div>
        ) : (
          <button
            type="button"
            className="flex-1 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-lg p-0.5 cursor-pointer group"
            onClick={() => onNavigate(item)}
            title="Nhấn để xem chi tiết"
          >
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                  item.isCritical
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                    : item.isHigh
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}
              >
                {item.badge}
              </span>
              <p className="text-xs font-semibold text-slate-100 truncate group-hover:text-white transition-colors">
                {item.title}
              </p>
            </div>
            {item.subtitle && (
              <p className="text-[11px] text-slate-400 truncate mt-0.5 group-hover:text-slate-300 transition-colors">
                {item.subtitle}
              </p>
            )}
          </button>
        )}

        {/* Action arrow + Dismiss button */}
        {!isCompact && (
          <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-white/10">
            <button
              type="button"
              className="p-1 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
              onClick={() => onNavigate(item)}
              aria-label="Xem chi tiết bản ghi"
              title="Xem chi tiết"
            >
              <LucideIcon icon={ArrowRight} className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              className="p-1 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                onDismiss()
              }}
              aria-label="Đóng thông báo"
              title="Đóng"
            >
              <LucideIcon icon={X} className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
