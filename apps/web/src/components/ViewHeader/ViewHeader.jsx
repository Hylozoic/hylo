import { Info } from 'lucide-react'
import React from 'react'
import Icon from 'components/Icon'
import { Tooltip, TooltipTrigger, TooltipContent } from 'components/ui/tooltip'

const ViewHeader = ({
  children,
  icon,
  info,
  title
}) => {
  return (
    <header className='flex flex-row items-center z-10 px-4 bg-background shadow-[0_4px_15px_0px_rgba(0,0,0,0.1)]'>
      {icon && <Icon name={icon} className='mr-3 text-lg' />}
      <h2 className='text-foreground'>{title}</h2>
      {info && (
        <Tooltip>
          <TooltipTrigger>
            <Info className='w-4 h-4 ml-2' />
          </TooltipTrigger>
          <TooltipContent>
            {info}
          </TooltipContent>
        </Tooltip>
      )}
      {children}
    </header>
  )
}

export default ViewHeader
