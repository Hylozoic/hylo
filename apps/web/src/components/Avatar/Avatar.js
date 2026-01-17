import PropTypes from 'prop-types'
import React from 'react'
import RoundImage from '../RoundImage'
import { Link } from 'react-router-dom'

export default function Avatar ({ url, avatarUrl, tiny, small, medium, large, className, square, withBorder = false }) {
  if (url) {
    return (
      <Link to={url} className={className} tabIndex={-1}>
        <RoundImage url={avatarUrl} tiny={tiny} small={small} medium={medium} large={large} square={square} withBorder={withBorder} />
      </Link>
    )
  } else {
    return (
      <span className={className}><RoundImage url={avatarUrl} tiny={tiny} small={small} medium={medium} large={large} square={square} withBorder={withBorder} /></span>
    )
  }
}

Avatar.propTypes = {
  url: PropTypes.string,
  avatarUrl: PropTypes.string,
  tiny: PropTypes.bool,
  small: PropTypes.bool,
  medium: PropTypes.bool,
  large: PropTypes.bool,
  square: PropTypes.bool,
  className: PropTypes.string,
  withBorder: PropTypes.bool
}
