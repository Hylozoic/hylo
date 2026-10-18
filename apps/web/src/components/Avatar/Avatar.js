import PropTypes from 'prop-types'
import React from 'react'
import RoundImage from '../RoundImage'
import { Link } from 'react-router-dom'
import { useProfileHoverCard } from 'components/ProfileHoverCard'
import { cn } from 'util/index'

/**
 * Pass `personId` for a person's avatar to get the profile hover card (hover on
 * desktop, long press on touch). Leave it out for avatars that shouldn't have
 * one: group avatars, pickers, rows that already open the profile.
 */
export default function Avatar ({ personId, ...props }) {
  return personId ? <AvatarWithHoverCard personId={personId} {...props} /> : <AvatarImage {...props} />
}

function AvatarWithHoverCard ({ personId, className, ...props }) {
  const { ref, triggerProps, card } = useProfileHoverCard(personId)
  const hasCard = Boolean(triggerProps.onPointerEnter)
  return (
    <>
      <AvatarImage
        {...props}
        ref={ref}
        triggerProps={triggerProps}
        className={hasCard ? cn(className, 'select-none [-webkit-touch-callout:none]') : className}
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
