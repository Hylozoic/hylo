import { string, bool, func } from 'prop-types'
import React from 'react'
import { cn } from 'util/index'
import { bgImageStyle } from '../../util/index'

/**
 * RoundImage component displays a circular or square image with various size options
 */
export default function RoundImage ({
  url,
  tiny,
  small,
  medium,
  large,
  xlarge,
  xxlarge,
  overlaps,
  overlapsVertical,
  className,
  square,
  size,
  onClick,
  withBorder = false
}) {
  // Determine size classes - default is 44px (w-11 h-11)
  const sizeClasses = xxlarge
    ? 'w-full h-full max-w-[20vh] max-h-[20vh]'
    : xlarge
      ? 'w-20 h-20 min-w-20'
      : large
        ? 'w-[40px] h-[40px] min-w-[40px]'
        : medium
          ? 'w-8 h-8 min-w-8'
          : small
            ? 'w-5 h-5 min-w-5'
            : tiny
              ? 'w-3.5 h-3.5'
              : 'w-11 h-11 min-w-11'

  const imageClasses = cn(
    // Base styles
    'p-1 bg-background transition-all max-w-full inline-block align-top bg-cover bg-center',
    // Shape - rounded-full by default, rounded-lg if square
    square ? 'rounded-lg' : 'rounded-full',
    // Size
    sizeClasses,
    // Border
    withBorder ? 'border-2 border-card' : 'border-0',
    // Overlaps
    {
      '-ml-4 first:-ml-0': overlaps,
      '-mt-4 first:-mt-0': overlapsVertical
    }
  )

  let style = bgImageStyle(url)
  if (size) {
    style = { ...style, width: size, height: size }
  }

  return (
    <div
      role='img'
      style={style}
      className={cn(imageClasses, className)}
      onClick={onClick}
    />
  )
}

RoundImage.propTypes = {
  url: string,
  tiny: bool,
  small: bool,
  medium: bool,
  large: bool,
  overlaps: bool,
  onClick: func,
  className: string
}
