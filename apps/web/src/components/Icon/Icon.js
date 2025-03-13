import React, { forwardRef } from 'react'
import { cn } from 'util/index'
import classes from './Icon.module.scss'

function Icon ({
  name,
  className,
  green,
  blue,
  children,
  onClick,
  tooltipContent,
  tooltipId,
  dataTestId,
  ariaLabel
}) {
  const iconClassName = `icon-${name}`

  return (
    <span
      className={cn(classes.icon, { [classes.green]: green, [classes.blue]: blue }, iconClassName, className)}
      onClick={onClick}
      data-tooltip-content={tooltipContent}
      data-tooltip-id={tooltipId}
      data-testid={dataTestId}
      aria-label={ariaLabel}
    >
      {children}
    </span>
  )
}

/* Keeping this separate to make testing with <Icon> easier */
export const IconWithRef = forwardRef(({
  name,
  className,
  green,
  blue,
  children,
  onClick,
  tooltipContent,
  tooltipId,
  ...rest
}, ref) => {
  const iconClassName = `icon-${name}`

  return (
    <span
      className={cn('text-foreground fill-foreground text-base', { [classes.green]: green, [classes.blue]: blue }, iconClassName, className)}
      onClick={onClick}
      data-tooltip-content={tooltipContent}
      data-tooltip-id={tooltipId}
      ref={ref}
      {...rest}
    >
      {children}
    </span>
  )
})

export default Icon
