import PropTypes from 'prop-types'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { push } from 'redux-first-history'
import { DateTimeHelpers } from '@hylo/shared'
import { messagePersonUrl, personUrl } from '@hylo/navigation'
import BadgeEmoji from 'components/BadgeEmoji'
import Dropdown from 'components/Dropdown'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from 'components/ui/dialog'
import useAppearance from 'hooks/useAppearance'
import usePillRowClamp from 'hooks/usePillRowClamp'
import { Check, EllipsisVertical, MapPin, MessageCircle, Trash2 } from 'lucide-react'
import { RESP_REMOVE_MEMBERS } from 'store/constants'
import { cn, bgImageStyle, parseApiDate, isRecentlyActive } from 'util/index'
import { formatLocalizedDate } from 'util/dateFormat'
import getMe from 'store/selectors/getMe'
import { getResponsibilityTitlesForGroup } from 'store/selectors/getResponsibilitiesForGroup'
import getRolesForGroup from 'store/selectors/getRolesForGroup'
import {
  viewCardColor,
  cardNeutralBg,
  cardRestRing,
  cardHoverRing,
  cardHoverShadow,
  cardRestShadow,
  cardChrome,
  CARD_CLASS,
  CARD_TITLE_CLASS
} from 'routes/AuthLayoutRouter/components/ContextMenu/viewCardTheme'

const { bool, object, string, shape } = PropTypes

/** Format join date for display. */
function formatJoinDate (value) {
  const date = parseApiDate(value)
  return formatLocalizedDate(date, { style: 'short' })
}

/** Active metadata note — green dot + "Active", or a short relative time like post headers. */
function MemberActiveNote ({ lastActiveAt, onPhoto = false }) {
  const { t } = useTranslation()
  const date = parseApiDate(lastActiveAt)
  if (!date) return null

  // Same window as the currently-active avatar strips, so a green dot here and
  // a green dot in the sidebar never disagree about who is online.
  const isActive = isRecentlyActive({ lastActiveAt }, Date.now())
  const relativeTime = DateTimeHelpers.humanDate(date, true)

  return (
    <span className={cn(
      'inline-flex items-center gap-1 whitespace-nowrap',
      onPhoto
        ? 'text-[10px] text-white/70 [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]'
        : 'text-foreground/50 text-2xs'
    )}
    >
      {isActive && <span className='w-2 h-2 rounded-full bg-green-500 shrink-0' aria-hidden />}
      {isActive ? t('Active') : `${t('Last Active')}: ${relativeTime}`}
    </span>
  )
}

function MemberMeta ({ enrolledAt, lastActiveAt, onPhoto = false, compact = false }) {
  const { t } = useTranslation()
  const joinDate = formatJoinDate(enrolledAt)
  const activeNote = <MemberActiveNote lastActiveAt={lastActiveAt} onPhoto={onPhoto} />
  if (!joinDate && !activeNote) return null

  return (
    <div className={cn(
      'flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5',
      onPhoto
        ? 'text-[10px] text-white/70 [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]'
        : compact ? 'text-[10px] text-foreground/50' : 'text-xs text-foreground/50'
    )}
    >
      {joinDate && <span>{t('Join Date')}: {joinDate}</span>}
      {joinDate && activeNote && <span aria-hidden>•</span>}
      {activeNote}
    </div>
  )
}

/** True when member has any of the required roles, or when no roles are required. */
function memberHasRequiredRole (memberRoles, requiredRoles) {
  if (!requiredRoles || requiredRoles.length === 0) return true
  const requiredIds = new Set(requiredRoles.map(role => String(role.id)))
  return memberRoles.some(role => requiredIds.has(String(role.id)))
}

/** Stable hue from a name, for the bannerless header gradient (per the design). */
function hueFromName (name) {
  let hash = 0
  for (const char of String(name || '')) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return hash
}

/** "Mar 2023"-style join date for the card footer. */
function formatJoinedShort (value) {
  const date = parseApiDate(value)
  return formatLocalizedDate(date, { style: 'monthYear' })
}

function Member ({
  canSeeJoinAnswers,
  className,
  group,
  member,
  removeMember,
  showAnswers,
  showFundingRoundRoles = false,
  submitterRoles = [],
  voterRoles = [],
  showTrackCompletion,
  trackCompletedAt,
  square,
  layout = 'card'
}) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const currentUser = useSelector(getMe)
  const { effectiveColorScheme } = useAppearance()
  const [hover, setHover] = useState(false)
  const isDark = effectiveColorScheme === 'dark'
  // Spaces inherit roles from the parent group
  const roleGroupId = group?.parentId || group?.id
  const currentUserResponsibilities = useSelector(state =>
    getResponsibilityTitlesForGroup(state, { person: currentUser, groupId: roleGroupId }))
  const roles = useSelector(state =>
    getRolesForGroup(state, { person: member.id, groupId: roleGroupId }))

  const goToPerson = useCallback((id, slug) => () => {
    dispatch(push(personUrl(id, slug)))
  }, [dispatch])

  const { id, name, location, tagline, avatarUrl, bannerUrl, enrolledAt, lastActiveAt } = member
  const canSubmit = showFundingRoundRoles && memberHasRequiredRole(roles, submitterRoles)
  const canVote = showFundingRoundRoles && memberHasRequiredRole(roles, voterRoles)
  const isViewer = showFundingRoundRoles && !canSubmit && !canVote

  const skills = (member.skills || []).map(s => s?.name).filter(Boolean)
  const [skillsExpanded, setSkillsExpanded] = useState(false)
  const skillsClamp = usePillRowClamp(skills.length, 3, skillsExpanded)

  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const canRemove = Boolean(removeMember) && currentUserResponsibilities.includes(RESP_REMOVE_MEMBERS)

  const confirmRemove = useCallback(() => {
    setConfirmingRemove(false)
    removeMember(member.id)
  }, [removeMember, member.id])

  const removeDropdown = (onPhoto) => canRemove && (
    <Dropdown
      id='member-dropdown'
      alignRight
      toggleChildren={
        <span className={cn(
          'w-8 h-8 grid place-items-center rounded-lg border transition-all',
          onPhoto
            ? 'bg-black/40 border-white/25 text-white/80 hover:bg-black/60 hover:border-white/50 hover:text-white'
            : 'bg-foreground/5 border-foreground/20 text-foreground/60 hover:bg-foreground/10 hover:border-foreground/40 hover:text-foreground'
        )}
        >
          <EllipsisVertical className='w-4 h-4' />
        </span>
      }
      items={[{ icon: <Trash2 className='w-4 h-4 text-destructive' />, label: t('Remove member from group'), onClick: () => setConfirmingRemove(true), red: true }]}
    />
  )

  // Rendered through a portal, so it lives outside the card's click target
  const removeConfirmDialog = canRemove && (
    <Dialog open={confirmingRemove} onOpenChange={setConfirmingRemove}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('Remove member')}</DialogTitle>
        </DialogHeader>
        <DialogDescription asChild>
          <div className='flex flex-wrap items-center gap-1.5 text-sm text-foreground/80'>
            <span>{t('You are about to permanently remove')}</span>
            <span className='inline-flex items-center gap-1.5 font-semibold text-foreground'>
              <span className='w-6 h-6 rounded-full bg-cover bg-center inline-block shrink-0' style={bgImageStyle(avatarUrl)} />
              {name}
            </span>
            <span>{t('from the group. Are you sure?')}</span>
          </div>
        </DialogDescription>
        <DialogFooter>
          <button
            type='button'
            onClick={confirmRemove}
            className='rounded-md bg-destructive text-white px-3 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity'
          >
            {t('Remove')}
          </button>
          <button
            type='button'
            onClick={() => setConfirmingRemove(false)}
            className='rounded-md border-2 border-foreground/20 px-3 py-1.5 text-sm font-medium text-foreground hover:border-foreground/50 transition-all'
          >
            {t('Cancel')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  const showJoinAnswersBlock = canSeeJoinAnswers && showAnswers && member.groupJoinQuestionAnswers?.items?.length > 0

  const joinAnswersBlock = showJoinAnswersBlock && (
    <div
      className={cn(
        'flex flex-col gap-2 z-10 relative',
        square && 'flex-1 min-h-0 overflow-y-auto w-full text-left px-0.5 mt-2'
      )}
    >
      <div className={cn('text-sm font-semibold text-foreground/80 border-t border-foreground/20 pt-2', square && 'text-xs')}>
        {t('Join Question Responses')}
      </div>
      {member.groupJoinQuestionAnswers.items.map((item) => (
        <div key={item.id} className='flex flex-col gap-1'>
          <div className={cn('text-xs font-medium text-foreground/70', square && 'text-[10px]')}>
            {item.question.text}
          </div>
          <div className={cn('text-sm text-foreground/90 pl-2 border-l-2 border-foreground/20', square && 'text-xs pl-1.5')}>
            {item.answer}
          </div>
        </div>
      ))}
    </div>
  )

  // One-column groups use the same card grid as the context menu views.
  if (square) {
    const bgImageUrl = bannerUrl || avatarUrl
    const onPhoto = Boolean(bgImageUrl)
    const col = viewCardColor(null)

    return (
      <div className={cn('flex flex-col min-w-0', className, showJoinAnswersBlock && 'w-full sm:w-[calc(50%-0.375rem)] sm:max-w-[168px]')}>
        <div
          className={cn(CARD_CLASS, cardChrome(isDark), 'shrink-0')}
          style={{
            background: onPhoto ? cardNeutralBg(effectiveColorScheme) : undefined,
            ...(!isDark && onPhoto ? { borderColor: `hsl(0 0% 100% / ${hover ? 0.55 : 0.25})` } : {}),
            boxShadow: hover
              ? `${cardHoverShadow(isDark)}, ${onPhoto ? cardRestRing(col) : cardHoverRing(col)}`
              : `${cardRestShadow(isDark)}, ${cardRestRing(col)}`
          }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onClick={goToPerson(id, group?.slug)}
          data-testid='member-card'
        >
          {onPhoto && (
            <>
              <div className='absolute inset-0 bg-cover bg-center' style={bgImageStyle(bgImageUrl)} />
              <div className='absolute inset-0' style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.6) 100%)' }} />
            </>
          )}
          {canRemove && (
            <div className='absolute top-2 right-2 z-20' onClick={e => e.stopPropagation()}>
              {removeDropdown(true)}
            </div>
          )}
          <div className='relative h-full'>
            <div className='absolute inset-0 grid place-items-center'>
              <div
                className='w-14 h-14 rounded-[15px] overflow-hidden grid place-items-center shrink-0 shadow-[0_4px_12px_rgba(0,0,0,0.35)]'
                style={{ border: '1px solid hsl(0 0% 100% / 0.28)' }}
              >
                <div className='w-full h-full bg-cover bg-center' style={bgImageStyle(avatarUrl)} />
              </div>
            </div>
            <div className='absolute left-0 right-0 top-[calc(50%+28px)] bottom-0 flex flex-col items-center justify-center text-center px-2 gap-0.5'>
              <h3 className={cn(
                CARD_TITLE_CLASS,
                onPhoto ? 'text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]' : 'text-foreground'
              )}
              >
                {name}
              </h3>
              {roles.length > 0 && (
                <div className='inline-flex gap-0.5 justify-center'>
                  {roles.map(role => (
                    <BadgeEmoji key={role.id + role.common} expanded showName {...role} responsibilities={role.responsibilities} id={id} />
                  ))}
                </div>
              )}
              {location && (
                <div className={cn(
                  'line-clamp-1 flex items-center gap-0.5 max-w-full',
                  onPhoto ? 'text-[10px] text-white/70 [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]' : 'text-[10px] text-foreground/60'
                )}
                >
                  <MapPin className='w-2.5 h-2.5 shrink-0' />
                  <span className='truncate'>{location}</span>
                </div>
              )}
              <MemberMeta enrolledAt={enrolledAt} lastActiveAt={lastActiveAt} onPhoto={onPhoto} />
            </div>
          </div>
        </div>
        {joinAnswersBlock}
        {removeConfirmDialog}
      </div>
    )
  }

  // ─── Design directory card + row (bd-members) ─────────────────────────────

  const isSelf = currentUser && String(currentUser.id) === String(id)
  const joinedShort = formatJoinedShort(enrolledAt)
  const hue = hueFromName(name)

  const messageButton = (onPhoto) => !isSelf && currentUser && (
    <button
      type='button'
      onClick={(e) => { e.stopPropagation(); dispatch(push(messagePersonUrl(member))) }}
      className={cn(
        'shrink-0 w-8 h-8 grid place-items-center rounded-lg border transition-all',
        onPhoto
          ? 'bg-black/40 border-white/25 text-white/80 hover:bg-selected/80 hover:border-selected hover:text-white'
          : 'bg-foreground/5 border-foreground/20 text-foreground/60 hover:bg-selected/20 hover:border-selected hover:text-foreground'
      )}
      aria-label={t('Message Member')}
      title={t('Message Member')}
    >
      <MessageCircle className='w-4 h-4' />
    </button>
  )

  const trackBlock = showTrackCompletion && (
    trackCompletedAt
      ? <div className='text-xs text-selected flex items-center gap-1'><Check className='w-3 h-3' /> {t('Completed {{date}}', { date: formatLocalizedDate(trackCompletedAt, { style: 'short' }) })}</div>
      : <div className='text-xs text-foreground/50'>{t('Not yet completed')}</div>
  )

  const fundingRoundBlock = showFundingRoundRoles && (
    <div className='flex flex-row flex-wrap gap-1.5'>
      {canSubmit && (
        <span className='px-2 py-0.5 text-xs bg-selected/20 text-foreground rounded-md'>{t('Can Submit')}</span>
      )}
      {canVote && (
        <span className='px-2 py-0.5 text-xs bg-selected/20 text-foreground rounded-md'>{t('Can Vote')}</span>
      )}
      {isViewer && (
        <span className='px-2 py-0.5 text-xs bg-foreground/10 text-foreground/70 rounded-md'>{t('Viewer')}</span>
      )}
    </div>
  )

  // With nothing to show between them, the banner sits directly on the footer's
  // dividing line instead of an empty padded block
  const hasCardBody = roles.length > 0 || Boolean(tagline) || skills.length > 0 ||
    Boolean(trackBlock) || Boolean(fundingRoundBlock) || Boolean(joinAnswersBlock)

  if (layout === 'row') {
    return (
      <div className={cn('flex flex-col border-b border-foreground/10 last:border-b-0', className)} data-testid='member-card'>
        <div onClick={goToPerson(id, group?.slug)} className='flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-foreground/5 transition-colors min-w-0'>
          <div className='w-8 h-8 rounded-full bg-cover bg-center shrink-0' style={bgImageStyle(avatarUrl)} />
          <div className='min-w-0 flex-1'>
            <div className='flex items-center gap-1.5 min-w-0'>
              <span className='text-sm font-bold text-foreground truncate'>{name}</span>
              {isSelf && <span className='text-xs text-selected font-semibold shrink-0'>· {t('You')}</span>}
              {roles.length > 0 && (
                <span className='inline-flex gap-0.5 shrink-0'>
                  {roles.map(role => (
                    <BadgeEmoji key={role.id + role.common} expanded showName {...role} responsibilities={role.responsibilities} id={id} />
                  ))}
                </span>
              )}
            </div>
            {location && (
              <div className='flex items-center gap-1 text-xs text-foreground/50 min-w-0'>
                <MapPin className='w-3 h-3 shrink-0' /><span className='truncate'>{location}</span>
              </div>
            )}
          </div>
          {joinedShort && <span className='hidden sm:block text-xs text-foreground/50 whitespace-nowrap shrink-0'>{joinedShort}</span>}
          <MemberActiveNote lastActiveAt={lastActiveAt} />
          {messageButton(false)}
          {canRemove && <div onClick={e => e.stopPropagation()}>{removeDropdown(false)}</div>}
        </div>
        {(trackBlock || fundingRoundBlock || joinAnswersBlock) && (
          <div className='flex flex-col gap-2 px-3 pb-3'>
            {trackBlock}
            {fundingRoundBlock}
            {joinAnswersBlock}
          </div>
        )}
        {removeConfirmDialog}
      </div>
    )
  }

  return (
    <div
      className={cn('relative flex flex-col overflow-hidden rounded-xl bg-card border border-foreground/20 hover:border-foreground/60 hover:-translate-y-px transition-all cursor-pointer', className)}
      onClick={goToPerson(id, group?.slug)}
      data-testid='member-card'
    >
      {/* Header: the member's own banner behind avatar, name and message — or a
          gradient tinted by their name when they have none */}
      <div
        className='relative p-3 bg-cover bg-center'
        style={bannerUrl
          ? bgImageStyle(bannerUrl)
          : { background: `linear-gradient(135deg, hsl(${hue} 42% 30%), hsl(${(hue + 45) % 360} 38% 22%))` }}
      >
        <div className='absolute inset-0' style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.42), rgba(0,0,0,0.66))' }} />
        <div className='relative flex items-center gap-3'>
          <div className={cn('w-12 h-12 rounded-full bg-cover bg-center shrink-0 shadow-md', isSelf && 'ring-2 ring-selected')} style={bgImageStyle(avatarUrl)} />
          <div className='flex-1 min-w-0'>
            <div className='text-white font-bold text-base leading-tight truncate'>
              {name}
              {isSelf && <span className='text-white/70 font-semibold text-xs'> · {t('You')}</span>}
            </div>
            {location && (
              <div className='flex items-center gap-1 mt-0.5 text-xs text-white/70 min-w-0'>
                <MapPin className='w-3 h-3 shrink-0' /><span className='truncate'>{location}</span>
              </div>
            )}
          </div>
          <div className='flex items-center gap-1.5 shrink-0' onClick={e => e.stopPropagation()}>
            {messageButton(true)}
            {removeDropdown(true)}
          </div>
        </div>
      </div>

      {hasCardBody && (
        <div className='p-4 pt-3 flex flex-col'>
          {roles.length > 0 && (
            <div className='flex flex-wrap gap-1 mb-2'>
              {roles.map(role => (
                <BadgeEmoji key={role.id + role.common} expanded showName {...role} responsibilities={role.responsibilities} id={id} />
              ))}
            </div>
          )}
          {tagline && <div className='text-sm text-foreground/70 leading-relaxed'>{tagline}</div>}
          {skills.length > 0 && (
            <div ref={skillsClamp.containerRef} className='flex flex-wrap gap-1.5 mt-3'>
              {skills.map(skill => (
                <span key={skill} className='px-2.5 py-0.5 rounded-full text-xs bg-foreground/5 border border-foreground/15 text-foreground/70'>{skill}</span>
              ))}
              {!skillsExpanded && (
                <button
                  type='button'
                  onClick={e => { e.stopPropagation(); setSkillsExpanded(true) }}
                  className='px-2.5 py-0.5 rounded-full text-xs bg-foreground/10 border border-foreground/15 text-foreground/70 hover:bg-foreground/15 hover:text-foreground transition-colors'
                >
                  {t('({{count}} more...)', { count: skills.length - skillsClamp.visibleCount })}
                </button>
              )}
            </div>
          )}
          {(trackBlock || fundingRoundBlock) && (
            <div className='flex flex-col gap-1.5 mt-3'>
              {trackBlock}
              {fundingRoundBlock}
            </div>
          )}
          {joinAnswersBlock && <div className='mt-3'>{joinAnswersBlock}</div>}
        </div>
      )}
      <div className='px-4 pb-3'>
        <div className='border-t border-foreground/10 pt-2.5 flex items-center gap-2 text-xs text-foreground/50'>
          <MemberActiveNote lastActiveAt={lastActiveAt} />
          {joinedShort && <span className='ml-auto'>{t('Joined {{date}}', { date: joinedShort })}</span>}
        </div>
      </div>
      {removeConfirmDialog}
    </div>
  )
}

Member.propTypes = {
  className: string,
  group: object,
  member: shape({
    id: string,
    name: string,
    location: string,
    tagline: string,
    avatarUrl: string,
    bannerUrl: string
  }).isRequired,
  removeMember: PropTypes.func,
  showAnswers: bool,
  showFundingRoundRoles: bool,
  submitterRoles: PropTypes.array,
  voterRoles: PropTypes.array,
  showTrackCompletion: bool,
  trackCompletedAt: string,
  square: bool,
  layout: string
}

export default Member
