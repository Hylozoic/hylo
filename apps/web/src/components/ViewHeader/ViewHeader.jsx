import { Globe, Info, Menu } from 'lucide-react'
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Icon from 'components/Icon'
import { Tooltip, TooltipTrigger, TooltipContent } from 'components/ui/tooltip'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useRouteParams from 'hooks/useRouteParams'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'

const ViewHeader = () => {
  const dispatch = useDispatch()
  const { context, groupSlug } = useRouteParams()
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const currentUser = useSelector(getMe)
  const { title, icon, info } = useViewHeader()

  return (
    <header className='flex flex-row items-center z-10 px-4 bg-background shadow-[0_4px_15px_0px_rgba(0,0,0,0.1)]'>
      <Menu className='sm:hidden w-6 h-6 mr-3 cursor-pointer' onClick={() => dispatch(toggleNavMenu())} />
      <div className='ViewHeaderContextIcon sm:hidden mr-3 w-8 h-8 rounded-lg drop-shadow-md'>
        {context === 'groups'
          ? <img src={group?.avatarUrl} alt={group?.name} className='w-8 h-8 rounded-lg' />
          : context === 'my'
            ? <img src={currentUser?.avatarUrl} alt={currentUser?.name} className='w-8 h-8 rounded-lg' />
            : context === 'public'
              ? <Globe className='w-8 h-8' />
              : null}
      </div>
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
    </header>
  )
}

export default ViewHeader
