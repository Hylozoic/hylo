import React from 'react'
import Badge from 'components/Badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from 'components/ui/tooltip'
import { useLocation, useNavigate } from 'react-router-dom'
import { cn } from 'util/index'

export default function GlobalNavItem ({
  children,
  className,
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
            className={cn(
              'bg-primary relative transition-all ease-in-out duration-250 flex flex-col items-center justify-center w-14 h-14 min-h-10 rounded-lg drop-shadow-md opacity-60 hover:opacity-100 scale-90 hover:scale-100 hover:drop-shadow-lg',
              {
                'border-3 border-secondary opacity-100 scale-100 hover:scale-110': selected,
                'border-3 border-accent opacity-100 scale-100': badgeCount > 0

                // Todo: figure out how to make /my/, notifications, messages and commons all be bigger and fully opaque
              },
              className
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
