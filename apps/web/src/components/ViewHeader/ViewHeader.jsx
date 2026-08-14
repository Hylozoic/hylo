import { Globe, ChevronLeft } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import GroupViewPresenter, { displayNameForView } from '@hylo/presenters/GroupViewPresenter'
import { localSpaceSlug } from '@hylo/navigation'
import Icon from 'components/Icon'
import InfoButton from 'components/ui/info'
import { Command, CommandItem, CommandList } from 'components/ui/command'
import { useViewHeader } from 'contexts/ViewHeaderContext'
import useRouteParams from 'hooks/useRouteParams'
import GroupViewIcon from 'routes/AuthLayoutRouter/components/ContextMenu/GroupViewIcon'
import { toggleNavMenu } from 'routes/AuthLayoutRouter/AuthLayoutRouter.store'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import { getGroupViews } from 'store/selectors/getGroupViews'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import { viewAcceptedByPostTypes } from 'store/models/GroupView'
import getMe from 'store/selectors/getMe'
import getMyMemberships from 'store/selectors/getMyMemberships'
import getPreviousLocation from 'store/selectors/getPreviousLocation'
import { bgImageStyle, cn } from 'util/index'
import { isCompactLayoutDevice, isDrawerNavLayout, isPhoneDevice } from 'util/mobile'
import { isCardMenuPreference, isOneColumnLayout } from 'util/navigationLayout'

/** Resolves the parent menu's space view (or a synthetic one for off-menu spaces). */
function resolveSpaceMenuView (parentGroup, groupViews, parentSlug, spaceSlug) {
  if (!spaceSlug || !parentSlug) return null

  const menuSpace = (groupViews || []).find(v =>
    v.type === 'space' &&
    localSpaceSlug(parentSlug, v.linkedGroup?.slug) === spaceSlug
  )
  if (menuSpace) return menuSpace

  const offMenuSpace = (parentGroup?.spaces?.items || []).find(space =>
    localSpaceSlug(parentSlug, space.slug) === spaceSlug
  )
  if (!offMenuSpace) return null

  return {
    type: 'space',
    name: offMenuSpace.name,
    icon: offMenuSpace.icon,
    linkedGroup: offMenuSpace
  }
}

const ViewHeader = () => {
  const dispatch = useDispatch()
  const { context, groupSlug, spaceSlug: routeSpaceSlug } = useRouteParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  // More Views edit/drill-in uses ?space= on /more-views rather than the space route.
  const isMoreViewsPath = location.pathname.replace(/\/$/, '').endsWith('/more-views')
  const spaceSlug = routeSpaceSlug || (isMoreViewsPath ? getQuerystringParam('space', location) : null)
  const group = useSelector(state => getGroupForSlug(state, groupSlug))
  const groupViews = useSelector(state => spaceSlug ? getGroupViews(state, group) : null)
  const currentUser = useSelector(getMe)
  const myMemberships = useSelector(getMyMemberships)
  const { headerDetails } = useViewHeader()
  const { backButton, backTo, mobileBackButton, title, icon, info, search, centered, headerActions, spaceBreadcrumb } = headerDetails

  const previousLocation = useSelector(getPreviousLocation)
  const compactLayout = isCompactLayoutDevice()
  const userGroupNavStyle = currentUser?.settings?.groupNavStyle
  const isOneColumnGroup = context === 'groups' && isOneColumnLayout(userGroupNavStyle, group?.settings?.layout)
  const isOneColumnContext = isCardMenuPreference(userGroupNavStyle) && ['my', 'all', 'public'].includes(context)
  const oneColumn = isOneColumnGroup || isOneColumnContext

  const spaceMenuView = useMemo(
    () => resolveSpaceMenuView(group, groupViews, groupSlug, spaceSlug),
    [group, groupViews, groupSlug, spaceSlug]
  )
  const presentedSpaceView = useMemo(() => {
    if (spaceBreadcrumb === false) return null
    return spaceMenuView ? GroupViewPresenter(spaceMenuView) : null
  }, [spaceMenuView, spaceBreadcrumb])
  const spaceName = presentedSpaceView ? displayNameForView(presentedSpaceView, t) : null
  const isSpaceMember = useMemo(() => {
    const spaceId = spaceMenuView?.linkedGroup?.id
    if (!spaceId) return false
    return myMemberships.some(m => String(m.group?.id) === String(spaceId))
  }, [spaceMenuView, myMemberships])

  const hasTitle = typeof title === 'string'
    ? title.length > 0
    : React.isValidElement(title)
      ? true
      : !!(title?.mobile || title?.desktop)

  // On phones, parent breadcrumb levels collapse to just their icon/avatar so
  // the current view's title keeps the room. Phone devices always collapse;
  // desktop browsers collapse only below the sm breakpoint.
  const parentCrumbNameClass = isPhoneDevice() ? 'hidden' : 'hidden sm:block'

  // A single-view space (e.g. chat-only) opens straight into its one view, so the
  // breadcrumb shows just the space — repeating the lone view's title is noise.
  // More Views is a separate page (space > More Views…), so never collapse it.
  const isSingleViewSpace = useMemo(() => {
    if (isMoreViewsPath) return false
    const spaceGroup = presentedSpaceView?.linkedGroup
    if (!spaceGroup) return false
    const visibleViews = (spaceGroup.groupViews?.items || [])
      .filter(v => v.order != null)
      .filter(v => viewAcceptedByPostTypes(v.type, spaceGroup.acceptedPostTypes))
    return visibleViews.length === 1
  }, [presentedSpaceView, isMoreViewsPath])

  const [searchValue, setSearchValue] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeOptionIndex, setActiveOptionIndex] = useState(0)
  // For card-menu homes: the dashboard banner already shows avatar/name prominently,
  // so the redundant breadcrumb header is hidden until the user scrolls past it.
  const [isBannerVisible, setIsBannerVisible] = useState(true)

  useEffect(() => {
    if (!oneColumn) {
      setIsBannerVisible(false) // not on card-menu home → don't hide
      return
    }
    let observer
    // Wait one frame so the ContextMenuGrid banner has mounted after navigation.
    const rafId = requestAnimationFrame(() => {
      const bannerEl = document.getElementById('context-menu-grid-banner')
      if (!bannerEl) {
        setIsBannerVisible(false) // simple group view (no banner rendered)
        return
      }
      observer = new window.IntersectionObserver(([entry]) => {
        setIsBannerVisible(entry.isIntersecting)
      }, { threshold: 0 })
      observer.observe(bannerEl)
    })
    return () => {
      cancelAnimationFrame(rafId)
      if (observer) observer.disconnect()
    }
  }, [oneColumn, location.pathname])

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

  // On small screens, the chevron toggles the nav menu only when there is no
  // explicit back behavior (backButton/mobileBackButton). If a screen declares
  // a back button, we always treat the chevron as \"back\" so it never takes
  // two taps.
  const handleChevronClick = () => {
    // Phone settings use master-detail navigation:
    // /settings/<tab>  → back to /settings (the menu)
    // /settings (root) → exit settings, return to the group home. For normal groups
    //                    also open the drawer so the user lands on the context menu
    //                    (widget list) instead of the underlying active view.
    if (isDrawerNavLayout(window.innerWidth) && groupSlug && location.pathname.startsWith(`/groups/${groupSlug}/settings`)) {
      const isSettingsRoot = location.pathname === `/groups/${groupSlug}/settings` ||
        location.pathname === `/groups/${groupSlug}/settings/`
      if (isSettingsRoot) {
        navigate(`/groups/${groupSlug}`)
        if (!isOneColumnGroup) {
          dispatch(toggleNavMenu(true))
        }
      } else {
        navigate(`/groups/${groupSlug}/settings`)
      }
      return
    }

    // One-column groups: back from a space view → space menu; from a group view → group menu.
    if (isOneColumnGroup && groupSlug) {
      const path = location.pathname.replace(/\/$/, '')
      const groupHome = `/groups/${groupSlug}`
      if (spaceSlug) {
        const spaceMenu = `/groups/${groupSlug}/spaces/${spaceSlug}`
        if (path !== spaceMenu) {
          navigate(spaceMenu)
          return
        }
        if (location.state?.fromMoreViews || location.state?.fromMoreSpaces) {
          navigate(`${groupHome}/more-views`)
          return
        }
        navigate(groupHome)
        return
      }
      if (path !== groupHome && path !== `${groupHome}/more-views`) {
        navigate(groupHome)
        return
      }
      if (path === `${groupHome}/more-views`) {
        navigate(groupHome)
        return
      }
    }

    // Card-menu My/All/Public: back from a view returns to that context's menu home.
    if (isOneColumnContext) {
      const path = location.pathname.replace(/\/$/, '')
      const contextHome = `/${context}`
      if (path !== contextHome) {
        navigate(contextHome)
        return
      }
    }

    // Card-menu layouts render the sidebar inline on phone too — there's no
    // drawer to toggle, so the chevron should navigate back instead.
    if (isDrawerNavLayout(window.innerWidth) && !mobileBackButton && !backButton && !oneColumn) {
      dispatch(toggleNavMenu())
    } else if (backTo) {
      navigate(backTo)
    } else if (centered) {
      navigate(previousLocation || '/')
    } else {
      navigate(-1)
    }
  }

  // Hide ViewHeader on card-menu levels (homes have their own banner;
  // nested grids have their own sticky back bar). Show it on actual views.
  const isOneColumnMenuLevel = useMemo(() => {
    if (!oneColumn) return false
    const path = location.pathname.replace(/\/$/, '')
    if (isOneColumnContext && path === `/${context}`) return true
    if (!isOneColumnGroup || !groupSlug) return false
    const groupBase = `/groups/${groupSlug}`
    if (path === groupBase || path === `${groupBase}/more-views`) return true
    const isSpaceIndex = Boolean(path.match(new RegExp(`^/groups/${groupSlug}/spaces/[^/]+$`)))
    // Members see ContextMenuGrid (own back bar) at the space index. The join
    // interstitial does not, so keep ViewHeader for non-members.
    return isSpaceIndex && isSpaceMember
  }, [oneColumn, isOneColumnContext, isOneColumnGroup, context, groupSlug, location.pathname, isSpaceMember])

  // Messages carries its own headers (thread-list title row + per-conversation
  // header), so the shared ViewHeader stays out of the way entirely.
  if (location.pathname.startsWith('/messages')) {
    return null
  }

  // Light mode surfaces sit close in lightness, so the sticky header needs a
  // hairline edge plus a stronger shadow to read as a layer above the stream.
  return (
    <header className={cn('flex flex-row items-center z-30 p-2 sticky top-0 w-full bg-background border-b border-foreground/[0.08] shadow-[0_4px_14px_0px_rgba(0,0,0,0.16)] dark:border-transparent dark:shadow-[0_4px_15px_0px_rgba(0,0,0,0.1)]', {
      'justify-center': centered,
      hidden: (oneColumn && isBannerVisible) || isOneColumnMenuLevel
    })}
    >
      {centered && (backButton || mobileBackButton) && (
        <button
          className={cn('p-2 -ml-1 cursor-pointer absolute left-0 z-10 bg-background', !compactLayout && 'sm:hidden', !compactLayout && backButton && 'sm:block')}
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
            className={cn('p-2 -ml-1 mr-1 cursor-pointer', !compactLayout && 'sm:hidden', !compactLayout && backButton && 'sm:block')}
            onClick={handleChevronClick}
          >
            <ChevronLeft className='w-6 h-6' />
          </button>
          {context !== 'messages' && !oneColumn && (
            <div className={cn('ViewHeaderContextIcon mr-3 w-8 h-8 rounded-lg drop-shadow-md', !compactLayout && 'sm:hidden')}>
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
      {!centered && !oneColumn && presentedSpaceView && (
        <>
          <GroupViewIcon view={presentedSpaceView} className='mr-1 shrink-0 w-5 h-5' />
          <span className={cn(
            'truncate shrink min-w-0 text-foreground font-bold',
            // Parent level: icon-only on phones, name returns at sm+
            !(isSingleViewSpace || !hasTitle) && cn('max-w-[25%]', parentCrumbNameClass)
          )}
          >{spaceName}
          </span>
          {!isSingleViewSpace && hasTitle && <span className='mx-1.5 shrink-0 text-foreground/40'>{'>'}</span>}
        </>
      )}
      {!centered && !oneColumn && !isSingleViewSpace && icon && (typeof icon === 'string' ? <Icon name={icon} className='mr-3 text-lg' /> : React.cloneElement(icon, { className: 'mr-3 text-lg' }))}
      {isOneColumnGroup && (() => {
        const inSpace = Boolean(presentedSpaceView && spaceSlug)
        const groupHref = `/groups/${groupSlug}`
        const spaceHref = `/groups/${groupSlug}/spaces/${spaceSlug}`

        return (
          <div className='flex items-center gap-1.5 mr-2 min-w-0'>
            {group?.avatarUrl && (
              <div
                className='w-6 h-6 rounded-sm bg-cover bg-center shrink-0 cursor-pointer hover:scale-110 transition-transform'
                style={bgImageStyle(group.avatarUrl)}
                onClick={() => navigate(groupHref)}
              />
            )}
            <span
              className={cn(
                'font-semibold text-foreground/70 cursor-pointer hover:text-foreground transition-colors whitespace-nowrap truncate',
                // The group is always a parent here — avatar only on phones
                parentCrumbNameClass
              )}
              onClick={() => navigate(groupHref)}
            >
              {group?.name}
            </span>
            {inSpace && (
              <>
                <span className='text-foreground/30 text-lg shrink-0'>{'>'}</span>
                <button
                  type='button'
                  className='shrink-0 cursor-pointer hover:scale-110 transition-transform'
                  onClick={() => navigate(spaceHref)}
                  aria-label={spaceName}
                >
                  <GroupViewIcon view={presentedSpaceView} className='!w-5 !h-5 !mr-0' />
                </button>
                <span
                  className={cn(
                    'cursor-pointer hover:text-foreground transition-colors whitespace-nowrap truncate',
                    hasTitle
                      // Parent level: icon-only on phones
                      ? cn('font-bold text-foreground/70', parentCrumbNameClass)
                      : 'font-bold text-foreground'
                  )}
                  onClick={() => navigate(spaceHref)}
                >
                  {spaceName}
                </span>
              </>
            )}
            {hasTitle && <span className='text-foreground/30 text-lg shrink-0'>{'>'}</span>}
            {hasTitle && icon && (
              typeof icon === 'string'
                ? <Icon name={icon} className='text-lg shrink-0' />
                : React.cloneElement(icon, { className: 'w-5 h-5 shrink-0' })
            )}
          </div>
        )
      })()}
      {isOneColumnContext && (() => {
        const hasTitle = typeof title === 'string'
          ? title.length > 0
          : React.isValidElement(title)
            ? true
            : !!(title?.mobile || title?.desktop)
        const contextHref = `/${context}`
        const contextLabel = context === 'public' ? t('The Commons') : t('My Home')

        return (
          <div className='flex items-center gap-1.5 mr-2 min-w-0'>
            {context === 'public'
              ? (
                <Globe
                  className='w-6 h-6 shrink-0 cursor-pointer hover:scale-110 transition-transform'
                  onClick={() => navigate(contextHref)}
                />
                )
              : currentUser?.avatarUrl && (
                <div
                  className='w-6 h-6 rounded-sm bg-cover bg-center shrink-0 cursor-pointer hover:scale-110 transition-transform'
                  style={bgImageStyle(currentUser.avatarUrl)}
                  onClick={() => navigate(contextHref)}
                />
              )}
            <span
              className={cn(
                'font-semibold text-foreground/70 cursor-pointer hover:text-foreground transition-colors whitespace-nowrap truncate',
                // Parent level whenever a view title follows — icon-only on phones
                hasTitle && parentCrumbNameClass
              )}
              onClick={() => navigate(contextHref)}
            >
              {contextLabel}
            </span>
            {hasTitle && <span className='text-foreground/30 text-lg shrink-0'>{'>'}</span>}
            {hasTitle && icon && (
              typeof icon === 'string'
                ? <Icon name={icon} className='text-lg shrink-0' />
                : React.cloneElement(icon, { className: 'w-5 h-5 shrink-0' })
            )}
          </div>
        )
      })()}
      <div
        className={cn('flex items-center min-w-0 gap-1', {
          'flex-1': !centered && typeof title === 'string',
          // overflow-y-hidden: overflow-x auto drags the y-axis out of `visible`,
          // so an element title a pixel taller than the line box (e.g. a badge
          // pill) would sprout a tiny vertical scrollbar instead of just showing
          'min-w-0 overflow-x-auto overflow-y-hidden flex-1': !centered && React.isValidElement(title)
        })}
      >
        <h2
          className={cn('text-foreground font-bold m-0', {
            'truncate min-w-0': typeof title === 'string',
            'whitespace-nowrap': title?.mobile && title?.desktop,
            'min-w-0 overflow-x-auto overflow-y-hidden': React.isValidElement(title),
            'pl-12': centered && (backButton || mobileBackButton) && compactLayout,
            'pl-12 sm:pl-0': centered && (backButton || mobileBackButton) && !compactLayout
          })}
        >
          {isSingleViewSpace
            ? ''
            : typeof title === 'string' || React.isValidElement(title)
              ? title
              : title?.mobile && title?.desktop
                ? (
                  <>
                    <span className={cn('inline text-sm truncate', !compactLayout && 'sm:hidden')}>{title.mobile}</span>
                    <span className={cn('hidden', !compactLayout && 'sm:inline')}>{title.desktop}</span>
                  </>
                  )
                : ''}
        </h2>
        {!centered && info && <InfoButton content={info} className='shrink-0' />}
      </div>
      {!centered && headerActions && <div className='flex items-center ml-2 shrink-0'>{headerActions}</div>}
      {!centered && search && (
        <div className='flex justify-end relative ml-2'>
          <div ref={searchContainerRef} className='relative flex items-center'>
            <button
              type='button'
              className={cn(
                'flex items-center justify-center w-9 h-9 rounded-lg bg-input/60 cursor-pointer border-none',
                !compactLayout && 'sm:hidden',
                searchOpen && 'hidden'
              )}
              onClick={() => searchInputRef.current?.focus()}
            >
              <Icon name='Search' className='opacity-60 text-xl' />
            </button>
            <Icon
              name='Search'
              className={cn('left-2 absolute opacity-50 z-10', searchOpen ? 'block' : 'hidden', !compactLayout && 'sm:block')}
            />
            <input
              ref={searchInputRef}
              type='text'
              placeholder={t('Search')}
              className={cn(
                'bg-input/60 focus:bg-input/100 rounded-lg text-foreground placeholder-foreground/40 py-1 transition-all outline-none focus:outline-focus focus:outline-2',
                compactLayout
                  ? 'w-0 pl-0 focus:w-[200px] focus:pl-7'
                  : 'w-0 sm:w-[90px] pl-0 sm:pl-7 focus:w-[200px] sm:focus:w-[250px] focus:pl-7'
              )}
              value={searchValue}
              onFocus={() => {
                setSearchOpen(true)
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
              <Command className='absolute h-fit top-full right-0 mt-2 w-full rounded-lg border border-border bg-popover shadow-lg z-50'>
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
