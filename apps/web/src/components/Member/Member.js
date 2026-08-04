import PropTypes from 'prop-types'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { push } from 'redux-first-history'
import { DateTimeHelpers } from '@hylo/shared'
import { personUrl } from '@hylo/navigation'
import BadgeEmoji from 'components/BadgeEmoji'
import Dropdown from 'components/Dropdown'
import Icon from 'components/Icon'
import useAppearance from 'hooks/useAppearance'
import { Check, MapPin, Trash2 } from 'lucide-react'
import { RESP_REMOVE_MEMBERS } from 'store/constants'
import { cn, bgImageStyle } from 'util/index'
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

import classes from './Member.module.scss'

const { bool, object, string, shape } = PropTypes

const ACTIVE_WITHIN_MS = 4 * 60 * 1000

/** Parse a member date value (ISO string or epoch ms). */
function parseMemberDate (value) {
  if (!value) return null
  const date = /^\d+$/.test(String(value))
    ? new Date(parseInt(value, 10))
    : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date
}

/** Format join date for display. */
function formatJoinDate (value) {
  const date = parseMemberDate(value)
  return date ? date.toLocaleDateString() : null
}

/** Active metadata note — green dot + "Active", or a short relative time like post headers. */
function MemberActiveNote ({ lastActiveAt, onPhoto = false }) {
  const { t } = useTranslation()
  const date = parseMemberDate(lastActiveAt)
  if (!date) return null

  const isActive = Date.now() - date.getTime() < ACTIVE_WITHIN_MS
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
  square
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

  const handleRemoveClick = useCallback((e, id, name) => {
    e.preventDefault()

    if (window.confirm(t('are you sure you want to remove {{name}}?', { name }))) {
      removeMember(id)
    }
  }, [removeMember, t])

  const { id, name, location, tagline, avatarUrl, bannerUrl, enrolledAt, lastActiveAt } = member
  const canSubmit = showFundingRoundRoles && memberHasRequiredRole(roles, submitterRoles)
  const canVote = showFundingRoundRoles && memberHasRequiredRole(roles, voterRoles)
  const isViewer = showFundingRoundRoles && !canSubmit && !canVote

  const removeDropdown = currentUserResponsibilities.includes(RESP_REMOVE_MEMBERS) && (
    <Dropdown
      id='member-dropdown'
      alignRight
      className={classes.dropdown}
      toggleChildren={<Icon name='More' />}
      items={[{ icon: <Trash2 className='w-4 h-4 text-destructive' />, label: t('Remove'), onClick: (e) => handleRemoveClick(e, id, name), red: true }]}
    />
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
          onClick={goToPerson(id, group.slug)}
          data-testid='member-card'
        >
          {onPhoto && (
            <>
              <div className='absolute inset-0 bg-cover bg-center' style={bgImageStyle(bgImageUrl)} />
              <div className='absolute inset-0' style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.6) 100%)' }} />
            </>
          )}
          {removeDropdown && (
            <div className='absolute top-2 right-2 z-20' onClick={e => e.stopPropagation()}>
              {removeDropdown}
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
                    <BadgeEmoji key={role.id + role.common} expanded {...role} responsibilities={role.responsibilities} id={id} />
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
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-2 bg-card/100 rounded-lg p-2 shadow-lg hover:bg-card/100 transition-all hover:scale-102 relative overflow-hidden', className)} data-testid='member-card'>
      {removeDropdown}
      <div onClick={goToPerson(id, group.slug)} className='flex flex-row gap-2 z-10 relative cursor-pointer'>
        <div className='min-w-16 min-h-16 max-h-16 rounded-full bg-cover' style={bgImageStyle(avatarUrl)} />
        <div className='flex flex-col gap-0 justify-center flex-1 min-w-0'>
          <div className='text-base whitespace-nowrap flex flex-row gap-1 items-center flex-wrap'>
            <span className='font-bold'>{name}</span>
            <div className='text-sm inline-flex gap-1'>
              {roles.map(role => (
                <BadgeEmoji key={role.id + role.common} expanded {...role} responsibilities={role.responsibilities} id={id} />
              ))}
            </div>
            <MemberActiveNote lastActiveAt={lastActiveAt} />
          </div>
          {location && <div className='text-xs text-foreground/70 flex items-center gap-1'><MapPin className='w-3 h-3' /> {location}</div>}
          {tagline && <div className='text-base text-foreground/100'>{tagline}</div>}
          {formatJoinDate(enrolledAt) && (
            <div className='text-xs text-foreground/50'>{t('Join Date')}: {formatJoinDate(enrolledAt)}</div>
          )}
          {showTrackCompletion && (
            trackCompletedAt
              ? <div className='text-xs text-selected flex items-center gap-1'><Check className='w-3 h-3' /> {t('Completed {{date}}', { date: new Date(trackCompletedAt).toLocaleDateString() })}</div>
              : <div className='text-xs text-foreground/50'>{t('Not yet completed')}</div>
          )}
          {showFundingRoundRoles && (
            <div className='flex flex-row flex-wrap gap-1.5 mt-1'>
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
          )}
        </div>
      </div>
      {joinAnswersBlock}
      <div className='absolute inset-0 w-full h-full bg-cover bg-center z-0 opacity-30' style={bgImageStyle(bannerUrl)} />
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
  square: bool
}

export default Member
