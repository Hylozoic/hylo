import cx from 'classnames'
import React from 'react'
import Badge from 'components/Badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from 'components/ui/tooltip'
import { useLocation, useNavigate } from 'react-router-dom'

export default function GlobalNavItem ({
  children,
  badgeCount = 0,
  img,
  tooltip,
  url
}) {
  const navigate = useNavigate()

  const selected = useLocation().pathname.startsWith(url)

  const style = {}
  if (img) {
    style.backgroundImage = `url(${img})`
    style.backgroundSize = 'cover'
    style.backgroundPosition = 'center'
  }

  const handleClick = () => {
    if (url) {
      navigate(url)
    }
  }

  return (
    <Tooltip>
      <div className='mb-4'>
        <TooltipTrigger asChild>
          <div
            className={cx(
              'flex flex-col items-center justify-center w-10 h-10 min-h-10 rounded-lg shadow-lg bg-background relative',
              {
                'border-4 border-primary w-12 h-12 min-h-12': selected,
                'border-2 border-accent': badgeCount > 0
              }
            )}
            style={style}
            role='button'
            onClick={handleClick}
          >
            {children}
            {badgeCount > 0 && <Badge number={badgeCount} className='absolute -top-2 -left-2' expanded />}
          </div>
        </TooltipTrigger>
        {tooltip && <TooltipContent side='right' arrow>{tooltip}</TooltipContent>}
      </div>
    </Tooltip>
  )
}
