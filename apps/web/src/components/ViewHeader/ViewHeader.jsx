import { Info, Menu } from 'lucide-react'
import React from 'react'
import { useDispatch } from 'react-redux'
import Icon from 'components/Icon'
import { Tooltip, TooltipTrigger, TooltipContent } from 'components/ui/tooltip'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'

const ViewHeader = ({
  children,
  icon,
  info,
  title
}) => {
  const dispatch = useDispatch()
  return (
    <header className='flex flex-row items-center z-10 px-4 bg-background shadow-[0_4px_15px_0px_rgba(0,0,0,0.1)]'>
      <Menu className='sm:hidden w-6 h-6 mr-3 cursor-pointer' onClick={() => dispatch(toggleNavMenu())} />
      {/* TODO: show context icon */}
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
