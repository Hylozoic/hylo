import { Globe, ChevronLeft } from 'lucide-react'
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import Icon from 'components/Icon'
import InfoButton from 'components/ui/info'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useRouteParams from 'hooks/useRouteParams'
import isWebView from 'util/webView'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'
import { bgImageStyle, cn } from 'util/index'
import { onEnter } from 'util/textInput'

const ViewHeader = () => {
  const dispatch = useDispatch()
  const { context, groupSlug } = useRouteParams()
  const navigate = useNavigate()
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const currentUser = useSelector(getMe)
  const { headerDetails } = useViewHeader()
  const { backButton, title, icon, info, search } = headerDetails

  return (
    <header className='flex flex-row items-center z-10 p-2 bg-midground/50 shadow-[0_4px_15px_0px_rgba(0,0,0,0.1)]'>
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
      {info && <InfoButton content={info} className='ml-2' />}
      {search && (
        <div className='flex-1 flex justify-center relative'>
          <div className='relative flex items-center'>
            <Icon name='Search' className='left-2 absolute opacity-50' />
            <input
              type='text'
            placeholder='Search'
            className='bg-black/20 rounded-lg text-foreground placeholder-foreground/40 w-[90px] py-1 pl-7 focus:w-[200px] transition-all outline-none focus:outline-focus focus:outline-2'
              onKeyDown={onEnter((e) => navigate(`/search?t=${e.target.value}`))}
            />
          </div>
        </div>
      )}
    </header>
  )
}

export default ViewHeader
