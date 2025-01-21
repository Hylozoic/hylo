import { Globe, Info, ChevronLeft } from 'lucide-react'
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import Icon from 'components/Icon'
import { Tooltip, TooltipTrigger, TooltipContent } from 'components/ui/tooltip'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useRouteParams from 'hooks/useRouteParams'
import isWebView from 'util/webView'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'
import { bgImageStyle, cn } from 'util/index'

const ViewHeader = () => {
  const dispatch = useDispatch()
  const { context, groupSlug } = useRouteParams()
  const navigate = useNavigate()
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const currentUser = useSelector(getMe)
  const { headerDetails } = useViewHeader()
  const { backButton, title, icon, info } = headerDetails

  return (
    <header className='flex flex-row items-center z-10 px-4 bg-background shadow-[0_4px_15px_0px_rgba(0,0,0,0.1)]'>
      {!isWebView() && (
        <>
          <ChevronLeft
            className={cn('sm:hidden w-6 h-6 mr-3 cursor-pointer', { 'sm:block': backButton })}
            onClick={() => backButton ? navigate(-1) : dispatch(toggleNavMenu())}
          />
          <div className='ViewHeaderContextIcon sm:hidden mr-3 w-8 h-8 rounded-lg drop-shadow-md'>
            {context === 'groups'
              ? <div style={bgImageStyle(group?.avatarUrl)} className='w-8 h-8 rounded-lg bg-cover bg-center' />
              : context === 'my'
                ? <div style={bgImageStyle(currentUser?.avatarUrl)} className='w-8 h-8 rounded-lg bg-cover bg-center' />
                : context === 'public'
                  ? <Globe className='w-8 h-8' />
                  : null}
          </div>
        </>)}
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
