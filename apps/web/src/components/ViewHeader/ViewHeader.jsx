import { Globe, ChevronLeft } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import Icon from 'components/Icon'
import InfoButton from 'components/ui/info'
import { Command, CommandItem, CommandList } from 'components/ui/command'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useRouteParams from 'hooks/useRouteParams'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import getMe from 'store/selectors/getMe'
import getPreviousLocation from 'store/selectors/getPreviousLocation'
import { bgImageStyle, cn } from 'util/index'

const ViewHeader = () => {
  const dispatch = useDispatch()
  const { context, groupSlug } = useRouteParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const currentUser = useSelector(getMe)
  const { headerDetails } = useViewHeader()
  const { backButton, backTo, title, icon, info, search, centered } = headerDetails

  const previousLocation = useSelector(getPreviousLocation)

  const [searchValue, setSearchValue] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeOptionIndex, setActiveOptionIndex] = useState(0)

  const searchContainerRef = useRef(null)
  const searchInputRef = useRef(null)

  const searchOptions = useMemo(() => {
    const options = []

    if (groupSlug) {
      options.push({
        id: 'within-group',
        label: t('Search in {{groupName}}', { groupName: group?.name || 'this group' }),
        groupSlug
      })
    }

    options.push({
      id: 'all-groups',
      label: t('Search across all your groups'),
      groupSlug: null
    })

    return options
  }, [group?.name, groupSlug, t])

  useEffect(() => {
    if (searchOptions.length === 0) {
      setActiveOptionIndex(-1)
    } else {
      setActiveOptionIndex(0)
    }
  }, [searchOptions, searchOpen])

  useEffect(() => {
    if (!searchOpen) return

    const handleClickOutside = (event) => {
      if (!searchContainerRef.current?.contains(event.target)) {
        setSearchOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [searchOpen])

  const handleSearch = useCallback((option) => {
    if (!option) return
    const trimmedQuery = searchValue.trim()
    const params = new URLSearchParams()
    if (trimmedQuery) params.set('t', trimmedQuery)
    if (option.groupSlug) params.set('groupSlug', option.groupSlug)
    if (!location.pathname.startsWith('/search')) {
      const fromValue = `${location.pathname}${location.search || ''}`
      if (fromValue) params.set('from', fromValue)
    }
    const destination = `/search${params.toString() ? `?${params.toString()}` : ''}`
    navigate(destination)
    setSearchOpen(false)
    searchInputRef.current?.blur()
  }, [navigate, searchValue, location])

  const handleSearchKeyDown = useCallback((event) => {
    if (!searchOptions.length) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSearchOpen(true)
      setActiveOptionIndex(prev => (prev + 1) % searchOptions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSearchOpen(true)
      setActiveOptionIndex(prev => (prev - 1 + searchOptions.length) % searchOptions.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const option = searchOptions[activeOptionIndex] ?? searchOptions[0]
      handleSearch(option)
    } else if (event.key === 'Escape') {
      setSearchOpen(false)
    }
  }, [activeOptionIndex, handleSearch, searchOptions])

  // On small screens, the chevron always toggles the nav menu
  // On larger screens (sm+), if backButton is true, it navigates back
  const handleChevronClick = () => {
    const isSmallScreen = window.innerWidth < 640 // Tailwind 'sm' breakpoint
    if (isSmallScreen) {
      dispatch(toggleNavMenu())
    } else if (backTo) {
      navigate(backTo)
    } else if (centered) {
      navigate(previousLocation || '/')
    } else {
      navigate(-1)
    }
  }

  return (
    <header className={cn('flex flex-row items-center z-50 p-2 w-full fixed top-0 left-0 right-0 shadow-[0_4px_15px_0px_rgba(0,0,0,0.1)]', {
      'justify-center': centered,
      'bg-midground': true
    })}
    >
      {centered && backButton && (
        <button
          className={cn('sm:hidden p-2 -ml-1 cursor-pointer absolute left-0', { 'sm:block': backButton })}
          onClick={handleChevronClick}
        >
          <ChevronLeft className='w-6 h-6' />
        </button>
      )}
      {/* DEPRECATED: Now always show back button/menu toggle */}
      {/* {!isWebView() && !centered && ( */}
      {!centered && (
        <>
          <button
            className={cn('sm:hidden p-2 -ml-1 mr-1 cursor-pointer', { 'sm:block': backButton })}
            onClick={handleChevronClick}
          >
            <ChevronLeft className='w-6 h-6' />
          </button>
          {context !== 'messages' && (
            <div className='ViewHeaderContextIcon sm:hidden mr-3 w-8 h-8 rounded-lg drop-shadow-md'>
              {context === 'groups'
                ? <div style={bgImageStyle(group?.avatarUrl)} className='w-8 h-8 rounded-lg bg-cover bg-center' />
                : context === 'my'
                  ? <div style={bgImageStyle(currentUser?.avatarUrl)} className='w-8 h-8 rounded-lg bg-cover bg-center' />
                  : context === 'public'
                    ? <Globe className='w-8 h-8' />
                    : null}
            </div>
          )}
        </>
      )}
      {/* )} */}
      {!centered && icon && (typeof icon === 'string' ? <Icon name={icon} className='mr-3 text-lg' /> : React.cloneElement(icon, { className: 'mr-3 text-lg' }))}
      <h2 className={cn('text-foreground m-0 whitespace-nowrap')}>
        {typeof title === 'string' || React.isValidElement(title)
          ? title
          : title?.mobile && title?.desktop
            ? (
              <>
                <span className='inline sm:hidden text-sm truncate'>{title.mobile}</span>
                <span className='hidden sm:inline'>{title.desktop}</span>
              </>
              )
            : ''}
      </h2>
      {!centered && info && <InfoButton content={info} className='ml-2' />}
      {!centered && search && (
        <div className='flex-1 flex justify-end relative'>
          <div ref={searchContainerRef} className='relative flex items-center'>
            <Icon name='Search' className='left-2 absolute opacity-50' />
            <input
              ref={searchInputRef}
              type='text'
              placeholder={t('Search')}
              className='bg-input/60 focus:bg-input/100 rounded-lg text-foreground placeholder-foreground/40 w-[90px] py-1 pl-7 focus:w-[250px] transition-all outline-none focus:outline-focus focus:outline-2'
              value={searchValue}
              onFocus={() => {
                if (searchOptions.length) {
                  setSearchOpen(true)
                }
              }}
              onChange={(event) => {
                setSearchValue(event.target.value)
                if (!searchOpen && searchOptions.length) {
                  setSearchOpen(true)
                }
              }}
              onKeyDown={handleSearchKeyDown}
              onBlur={(event) => {
                const nextFocusedElement = event.relatedTarget
                if (!searchContainerRef.current?.contains(nextFocusedElement)) {
                  setSearchOpen(false)
                }
              }}
            />
            {searchOpen && searchOptions.length > 0 && (
              <Command className='absolute h-fit top-full right-0 mt-2 w-full rounded-lg border border-border bg-popover shadow-lg z-20'>
                <CommandList>
                  {searchOptions.map((option, index) => (
                    <CommandItem
                      key={option.id}
                      value={option.id}
                      className={cn(
                        'px-3 py-2 text-sm cursor-pointer',
                        index === activeOptionIndex && 'bg-accent text-accent-foreground',
                        index !== activeOptionIndex && 'data-[selected="true"]:bg-transparent data-[selected=true]:bg-transparent data-[selected="true"]:text-foreground data-[selected=true]:text-foreground'
                      )}
                      onSelect={() => handleSearch(option)}
                      onMouseEnter={() => setActiveOptionIndex(index)}
                      onMouseDown={(event) => event.preventDefault()}
                    >
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

export default ViewHeader
