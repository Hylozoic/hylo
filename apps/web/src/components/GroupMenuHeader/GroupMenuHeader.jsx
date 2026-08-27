import { ChevronLeft, Info, Settings, Users } from 'lucide-react'
import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import GroupNotificationsPopover from 'components/GroupNotificationsPopover/GroupNotificationsPopover'
import InviteMembersDialog from 'components/InviteMembersDialog/InviteMembersDialog'
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
 * hideBanner: the parent paints the group banner (so it can wrap around the
 * menu card); skip this header's own image and darkening overlay.
 */
export default function GroupMenuHeader ({
  group,
  compact = false,
  // One-column takeover: chevron + avatar + name cluster centers in the bar
  centered = false,
  onCompactClick,
  hideBanner = false
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
        'GroupMenuHeader group/menuHeader relative flex flex-col p-2 bg-cover transition-[height] duration-300 ease-out',
        // min-h: names too long even for the banner grow the header rather
        // than clipping; justify-end keeps the extra lines eating upward into
        // the banner space first. Compact centers its single row instead.
        // No shadow when the parent owns the banner — a line here would cut
        // across the wrap around the menu card.
        compact ? 'h-12 hover:h-14 justify-center' : 'min-h-[190px] justify-end',
        !compact && !hideBanner && 'shadow-md'
      )}
      data-testid='group-header'
      data-tour='group-header'
    >
      {!hideBanner && (
        <>
          <div className='absolute z-10 inset-0 bg-cover bg-center' style={{ ...bgImageStyle(bannerUrl), opacity: 0.5 }} />
          <div className='absolute top-0 left-0 w-full h-full bg-darkening z-0 opacity-80' />
        </>
      )}
      {/* Compact cover: the stream header's wash flipped so the dark end sits at the
          bottom, and the whole ducked header acts as the Back control. Skip the
          wash when the parent owns the banner — otherwise it is a darker stripe
          above the wrap. */}
      <button
        type='button'
        onClick={compact ? onCompactClick : undefined}
        tabIndex={compact ? 0 : -1}
        aria-label={t('Back')}
        aria-hidden={!compact}
        className={cn(
          'absolute inset-0 z-30 transition-opacity duration-300',
          compact ? 'cursor-pointer' : 'opacity-0 pointer-events-none',
          !hideBanner && 'bg-gradient-to-t from-[hsl(var(--theme-background)/0.6)] dark:from-[hsl(var(--theme-background)/0.85)] to-[hsl(var(--theme-background)/0.15)]',
          compact && !hideBanner && 'opacity-50 group-hover/menuHeader:opacity-0'
        )}
      />
      {/* Back affordance: sits above the compact gradient (z-30) as a sibling, since
          the content row's own stacking context caps below it. Clicks fall through
          to the full-header overlay button, which is the actual Back control. */}
      {compact && !centered && (
        <ChevronLeft
          className='absolute left-2 top-1/2 -translate-y-1/2 z-40 w-5 h-5 text-white drop-shadow-md pointer-events-none'
          aria-hidden='true'
        />
      )}
      <div className={cn('absolute top-2 left-2 z-20', controlFade)} data-tour='group-notifications'>
        <GroupNotificationsPopover group={group} />
      </div>
      {canAdminister && (
        <div className={cn('absolute top-2 right-2 z-20', controlFade)} data-tour='group-settings'>
          <button aria-label={t('Group Settings')} onClick={() => navigateAndClose(groupUrl(group.slug, 'settings', {}))}>
            <Settings className='w-6 h-6 text-white drop-shadow-md hover:scale-110 transition-all' />
          </button>
        </div>
      )}
      <div className={cn(
        'relative flex flex-row text-background',
        compact ? 'items-center' : 'items-start',
        // Centered cluster rides above the wash so it reads crisply; it must not
        // swallow clicks meant for the full-header Back overlay beneath it
        compact && centered ? 'justify-center z-40 pointer-events-none' : 'z-20'
      )}
      >
        {compact && centered && (
          <ChevronLeft className='w-5 h-5 text-white drop-shadow-md mr-1 shrink-0 self-center pointer-events-none' aria-hidden='true' />
        )}
        <div
          style={group.avatarUrl !== DEFAULT_AVATAR ? bgImageStyle(avatarUrl) : {}}
          className={cn(
            'rounded-lg mr-2 shadow-md bg-cover bg-center relative overflow-hidden shrink-0 transition-all duration-300',
            // ml-6 clears the back chevron sitting at the header's left edge
            // (inline when centered, so no clearance needed).
            // Full size matches the name + member-pill column height. Fixed rather
            // than self-stretch/aspect-square: a bg-image-only box has no intrinsic
            // width, so the stretched square collapsed to nothing.
            compact ? cn('h-7 w-7', !centered && 'ml-6') : 'h-[52px] w-[52px]',
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
        <div className={cn(`flex flex-col text-${textColor} drop-shadow-md overflow-hidden`, compact && centered ? 'flex-none max-w-[60%]' : 'flex-1')}>
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
            <span className='inline-flex' data-tour='group-invite'>
              <InviteMembersDialog
                group={group}
                alwaysVisible
                triggerLabel={t('Invite')}
                triggerClassName='rounded-full bg-white/15 border border-white/25 px-2 py-0.5 text-white hover:text-white hover:bg-white/25 hover:scale-100'
              />
            </span>
            <button
              type='button'
              data-tour='group-about'
              onClick={() => navigateAndClose(groupUrl(group.slug, 'about', {}))}
              className='inline-flex items-center gap-1 rounded-full bg-white/15 border border-white/25 px-2 py-0.5 text-white hover:bg-white/25 hover:text-white transition-colors'
            >
              <Info className='w-3.5 h-3.5' />
              {t('About')}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
