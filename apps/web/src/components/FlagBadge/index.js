import React from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Flag } from 'lucide-react'
import { cn } from 'util/index'

/**
 * The reasons a post was flagged, for the badge tooltip: agreement titles,
 * platform agreement text, and reporter notes from active moderation actions
 * (scoped to a group when one is given). Falls back to a generic line.
 */
export function flagReasons (post, groupId, t) {
  const actions = (post?.moderationActions || []).filter(action =>
    action.status === 'active' &&
    (!groupId || !action.groupId || String(action.groupId) === String(groupId)))
  const reasons = []
  actions.forEach(action => {
    const agreements = action.agreements?.items || action.agreements || []
    agreements.forEach(agreement => agreement?.title && reasons.push(agreement.title))
    const platform = action.platformAgreements?.items || action.platformAgreements || []
    platform.forEach(pa => pa?.text && reasons.push(pa.text))
    if (action.text) reasons.push(action.text)
  })
  const unique = [...new Set(reasons)]
  return unique.length ? unique.join(' · ') : t('See why this post was flagged')
}

const FLAG_DISC_CLASS = 'shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-destructive text-white shadow-md'

const MAX_TOOLTIP_AGREEMENTS = 3
const MAX_REPORT_TEXT_CHARS = 120

const escapeHtml = value => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Structured tooltip for the flag badge, as HTML (react-tooltip's
 * data-tooltip-html): the reporter's note, then up to a few of the agreements
 * the report names, with a "… and N more" tail. All interpolated content is
 * user-written and escaped.
 */
export function flagTooltipHtml (post, groupId, t) {
  const actions = (post?.moderationActions || []).filter(action =>
    action.status === 'active' &&
    (!groupId || !action.groupId || String(action.groupId) === String(groupId)))
  if (!actions.length) return escapeHtml(t('See why this post was flagged'))

  const lines = []
  actions.forEach(action => {
    if (!action.text) return
    const name = (!action.anonymous || action.anonymous === 'false') && action.reporter?.name
      ? action.reporter.name
      : t('Anonymous')
    const text = action.text.length > MAX_REPORT_TEXT_CHARS
      ? `${action.text.slice(0, MAX_REPORT_TEXT_CHARS)}…`
      : action.text
    lines.push(`<div>${escapeHtml(t('{{name}} says: "{{text}}"', { name, text }))}</div>`)
  })

  const agreements = []
  actions.forEach(action => {
    const groupAgreements = action.agreements?.items || action.agreements || []
    groupAgreements.forEach(agreement => agreement?.title && agreements.push(agreement.title))
    const platform = action.platformAgreements?.items || action.platformAgreements || []
    platform.forEach(pa => pa?.text && agreements.push(pa.text))
  })
  const unique = [...new Set(agreements)]
  if (unique.length) {
    lines.push(`<div>${escapeHtml(t('This may break the following agreements:'))}</div>`)
    unique.slice(0, MAX_TOOLTIP_AGREEMENTS).forEach(title => lines.push(`<div>${escapeHtml(title)}</div>`))
    if (unique.length > MAX_TOOLTIP_AGREEMENTS) {
      lines.push(`<div>${escapeHtml(t('... and {{count}} more', { count: unique.length - MAX_TOOLTIP_AGREEMENTS }))}</div>`)
    }
  }
  return lines.length ? lines.join('') : escapeHtml(t('See why this post was flagged'))
}

/**
 * White flag on a red disc, linking to the moderation queue. Pair with a
 * <Tooltip id={tooltipId}> somewhere on the page for the reasons hover.
 */
export default function FlagBadge ({ to, post, groupId, tooltipId = 'flag-tt', className }) {
  const { t } = useTranslation()
  return (
    <Link
      to={to}
      aria-label={t('See why this post was flagged')}
      data-tooltip-html={flagTooltipHtml(post, groupId, t)}
      data-tooltip-id={tooltipId}
      onClick={event => event.stopPropagation()}
      // text-white pinned on hover too — the global link hover green otherwise
      // recolors the glyph
      className={cn(FLAG_DISC_CLASS, 'hover:text-white hover:scale-110 transition-transform', className)}
    >
      <Flag className='w-3.5 h-3.5' strokeWidth={2.5} fill='currentColor' />
    </Link>
  )
}

/**
 * Cover over a flagged post's blurred body: names the concern, lists the
 * reported reasons, and offers the reveal. The parent must be
 * position: relative. Until the viewer acknowledges (View post), the content
 * under it stays blurred and inert.
 */
export function FlagCover ({ post, groupId, onView }) {
  const { t } = useTranslation()
  const reasons = flagReasons(post, groupId, t)
  return (
    <div className='absolute inset-0 z-10 flex items-center justify-center p-4'>
      <div className='flex flex-col items-center gap-2 text-center rounded-xl border-2 border-foreground/20 bg-card/95 backdrop-blur-sm shadow-xl px-4 py-3 max-w-[340px]'>
        <span className={FLAG_DISC_CLASS} aria-hidden='true'>
          <Flag className='w-3.5 h-3.5' strokeWidth={2.5} fill='currentColor' />
        </span>
        <div className='text-sm text-foreground/80'>{t('clickthroughExplainer')}</div>
        <div className='text-xs text-foreground/60'>{reasons}</div>
        <button
          type='button'
          onClick={event => { event.stopPropagation(); onView() }}
          className='rounded-lg border-2 border-foreground/20 px-3 py-1.5 text-sm font-semibold text-foreground/80 hover:text-foreground hover:border-foreground/40 cursor-pointer transition-colors'
        >
          {t('View post')}
        </button>
      </div>
    </div>
  )
}
