import { ChevronLeft, Info, Settings, Users } from 'lucide-react'
import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import GroupNotificationsPopover from 'components/GroupNotificationsPopover/GroupNotificationsPopover'
import InviteMembersPopover from 'components/InviteMembersPopover/InviteMembersPopover'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import { RESP_ADMINISTRATION } from 'store/constants'
import { DEFAULT_BANNER, DEFAULT_AVATAR } from 'store/models/Group'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import { bgImageStyle, cn } from 'util/index'
import { groupUrl } from '@hylo/navigation'

/**
 * compact: a space's menu has taken over the context menu — the header ducks to
 * ViewHeader's height, the avatar shrinks, and the controls (members, invite,
 * about, settings, notifications) fade out. Everything transitions.
 */
export default function GroupMenuHeader ({
  group,
  compact = false,
  onCompactClick
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const avatarUrl = group.avatarUrl || DEFAULT_AVATAR
  const bannerUrl = group.bannerUrl || DEFAULT_BANNER
  const [textColor, setTextColor] = useState('background')
  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADMINISTRATION, groupId: group?.id }))
  const groupNameRef = React.useRef(null)

  // Helper to navigate and close the menu
  const navigateAndClose = useCallback((path) => {
    dispatch(toggleNavMenu(false))
    navigate(path)
  }, [dispatch, navigate])

  useEffect(() => {
    // Detect the color of the banner and set the text color accordingly
    const img = new window.Image()
    img.crossOrigin = 'Anonymous'
    img.src = bannerUrl
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0, img.width, img.height)
      const imageData = ctx.getImageData(0, 0, img.width, img.height)
      const data = imageData.data
      let r, g, b, avg
      let colorSum = 0

      for (let x = 0, len = data.length; x < len; x += 4) {
        r = data[x]
        g = data[x + 1]
        b = data[x + 2]
        avg = Math.floor((r + g + b) / 3)
        colorSum += avg
      }

      const brightness = Math.floor(colorSum / (img.width * img.height))
      setTextColor(brightness > 128 ? 'foreground' : 'background')
    }
  }, [bannerUrl])

  // Controls share one fade so compact mode dismisses them in a single motion
  const controlFade = cn('transition-opacity duration-300', compact && 'opacity-0 pointer-events-none')

  return (
    <div
      className={cn(
        'GroupMenuHeader group/menuHeader relative flex flex-col p-2 bg-cover shadow-md transition-[height] duration-300 ease-out',
        // min-h: names too long even for the banner grow the header rather
        // than clipping; justify-end keeps the extra lines eating upward into
        // the banner space first. Compact centers its single row instead.
        compact ? 'h-12 hover:h-14 justify-center' : 'min-h-[190px] justify-end'
      )}
      data-testid='group-header'
    >
      <div className='absolute z-10 inset-0 bg-cover bg-center' style={{ ...bgImageStyle(bannerUrl), opacity: 0.5 }} />
      <div className='absolute top-0 left-0 w-full h-full bg-darkening z-0 opacity-80' />
      {/* Compact cover: the stream header's wash flipped so the dark end sits at the
          bottom, and the whole ducked header acts as the Back control */}
      <button
        type='button'
        onClick={compact ? onCompactClick : undefined}
        tabIndex={compact ? 0 : -1}
        aria-label={t('Back')}
        aria-hidden={!compact}
        className={cn(
          'absolute inset-0 z-30 bg-gradient-to-t from-[hsl(var(--theme-background)/0.6)] dark:from-[hsl(var(--theme-background)/0.85)] to-[hsl(var(--theme-background)/0.15)] transition-opacity duration-300',
          compact ? 'opacity-100 cursor-pointer group-hover/menuHeader:opacity-0' : 'opacity-0 pointer-events-none'
        )}
      />
      <div className={cn('absolute top-2 left-2 z-20', controlFade)}>
        <GroupNotificationsPopover group={group} />
      </div>
      {canAdminister && (
        <div className={cn('absolute top-2 right-2 z-20', controlFade)}>
          <button onClick={() => navigateAndClose(groupUrl(group.slug, 'settings', {}))}>
            <Settings className='w-6 h-6 text-white drop-shadow-md hover:scale-110 transition-all' />
          </button>
        </div>
      )}
      <div className={cn('relative flex flex-row text-background z-20', compact ? 'items-center' : 'items-start')}>
        <div
          style={group.avatarUrl !== DEFAULT_AVATAR ? bgImageStyle(avatarUrl) : {}}
          className={cn(
            'rounded-lg mr-2 shadow-md bg-cover bg-center relative overflow-hidden shrink-0 transition-all duration-300',
            compact ? 'h-7 w-7' : 'h-10 w-10',
            group.avatarUrl === DEFAULT_AVATAR && 'bg-darkening'
          )}
        >
          {group.avatarUrl === DEFAULT_AVATAR && (
            <>
              <div
                className='absolute inset-0 opacity-70'
                style={{
                  background: 'linear-gradient(to bottom right, hsl(var(--focus)), hsl(var(--selected)))'
                }}
              />
              <span className={cn('relative z-10 text-white flex items-center justify-center uppercase h-full drop-shadow-md transition-all duration-300', compact ? 'text-sm' : 'text-xl')}>
                {group.name.split(/\s+/).length > 1
                  ? `${group.name.split(/\s+/)[0].charAt(0)}${group.name.split(/\s+/)[1].charAt(0)}`
                  : group.name.charAt(0)}
              </span>
            </>
          )}
        </div>
        <div className={`flex flex-col flex-1 text-${textColor} drop-shadow-md overflow-hidden`}>
          <div className='flex items-center'>
            <h1
              ref={groupNameRef}
              className={cn(
                'GroupMenuHeaderName font-bold m-0 text-white transition-all duration-300',
                // Full-size shows the whole name; justify-end anchors the block's
                // bottom so extra lines grow upward over the banner instead of
                // pushing the member pills below out of frame
                compact ? 'text-base/5 line-clamp-1' : 'text-xl/5'
              )}
            >
              {group.name}
            </h1>
          </div>
          {/* Kept mounted so compact mode can collapse it smoothly rather than pop it out */}
          <span
            className={cn(
              'group text-xs align-middle text-white flex items-center gap-1 overflow-hidden transition-all duration-300',
              compact ? 'opacity-0 max-h-0 pointer-events-none' : 'opacity-100 max-h-7 mt-1.5'
            )}
          >
            <Link
              className='inline-flex items-center gap-1 rounded-full bg-white/15 border border-white/25 px-2 py-0.5 text-white hover:bg-white/25 hover:text-white no-underline hover:no-underline transition-colors'
              to={groupUrl(group.slug, 'members', {})}
              onClick={() => dispatch(toggleNavMenu(false))}
              aria-label={t('{{count}} Members', { count: group.memberCount })}
            >
              <Users className='w-3.5 h-3.5' />
              {group.memberCount}
            </Link>
            <InviteMembersPopover
              group={group}
              alwaysVisible
              triggerLabel={t('Invite')}
              triggerClassName='rounded-full bg-white/15 border border-white/25 px-2 py-0.5 text-white hover:text-white hover:bg-white/25 hover:scale-100'
            />
          </span>
        </div>
        <Info
          className={cn(
            `text-${textColor} cursor-pointer h-[20px] shrink-0 text-white hover:scale-110 transition-all`,
            // Sits on the avatar's centre line while the row itself is top-aligned,
            // so a name that wraps to three lines doesn't drag it down the banner.
            // Compact collapses its width so the faded-out icon leaves no gap.
            compact ? 'w-0' : 'w-[20px] mt-2.5',
            controlFade
          )}
          onClick={() => navigateAndClose(groupUrl(group.slug, 'about', {}))}
        />
        {/* Sits under the full-header overlay button (same action), so it reads as
            the control while the whole ducked header stays the actual click target */}
        {compact && (
          <span
            className='shrink-0 ml-2 inline-flex items-center gap-0.5 text-xs font-semibold rounded-md border border-white/25 bg-black/25 text-white/90 px-2 py-1 backdrop-blur-sm transition-colors group-hover/menuHeader:bg-black/40 group-hover/menuHeader:text-white'
            aria-hidden='true'
          >
            <ChevronLeft className='w-3.5 h-3.5' />
            {t('Back')}
          </span>
        )}
      </div>
    </div>
  )
}
