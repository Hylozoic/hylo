import PropTypes from 'prop-types'
import React, { useCallback, useMemo } from 'react'
import RoundImage from '../RoundImage'
import { Link, useNavigate } from 'react-router-dom'
import { useProfileHoverCard } from 'components/ProfileHoverCard'

/**
 * Pass `personId` for a person's avatar to get the profile hover card (hover on
 * desktop, long press on touch). Leave it out for avatars that shouldn't have
 * one: group avatars, pickers, rows that already open the profile.
 */
export default function Avatar ({ personId, ...props }) {
  return personId ? <AvatarWithHoverCard personId={personId} {...props} /> : <AvatarImage {...props} />
}

// Suppresses the long-press callout (iOS link preview / image menu), text selection and dragging
const NO_TOUCH_CALLOUT_STYLE = { WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', WebkitUserDrag: 'none' }

function isTouchOnlyDevice () {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(hover: none)').matches)
}

function AvatarWithHoverCard ({ personId, url, ...props }) {
  const { ref, triggerProps, card } = useProfileHoverCard(personId)
  const navigate = useNavigate()
  const hasCard = Boolean(triggerProps.onPointerEnter)
  // On touch-only devices a long press on a real link opens the OS link preview (iOS) or link
  // menu (Android) instead of the card, so the avatar becomes a link-like span there and taps
  // navigate from the click handler. Desktop keeps the real link (open in new tab etc).
  const touchOnly = useMemo(isTouchOnlyDevice, [])
  const asSpanLink = hasCard && url && touchOnly
  const handleClick = useCallback(e => {
    triggerProps.onClick?.(e)
    if (!e.defaultPrevented) navigate(url)
  }, [triggerProps, navigate, url])

  return (
    <>
      <AvatarImage
        {...props}
        url={asSpanLink ? undefined : url}
        ref={ref}
        triggerProps={hasCard
          ? {
              ...triggerProps,
              ...(asSpanLink ? { onClick: handleClick, role: 'link' } : {}),
              draggable: false,
              style: NO_TOUCH_CALLOUT_STYLE
            }
          : triggerProps}
      />
      {card}
    </>
  )
}

const AvatarImage = React.forwardRef(function AvatarImage ({ url, avatarUrl, tiny, small, medium, large, className, square, withBorder = false, triggerProps }, ref) {
  const image = <RoundImage url={avatarUrl} tiny={tiny} small={small} medium={medium} large={large} square={square} withBorder={withBorder} />
  if (url) {
    return <Link to={url} className={className} tabIndex={-1} ref={ref} {...triggerProps}>{image}</Link>
  }
  return <span className={className} ref={ref} {...triggerProps}>{image}</span>
})

Avatar.propTypes = {
  url: PropTypes.string,
  avatarUrl: PropTypes.string,
  personId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  tiny: PropTypes.bool,
  small: PropTypes.bool,
  medium: PropTypes.bool,
  large: PropTypes.bool,
  square: PropTypes.bool,
  className: PropTypes.string,
  withBorder: PropTypes.bool
}
