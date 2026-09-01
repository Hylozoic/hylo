import { ChevronLeft, Globe, Info } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { displayNameForView } from '@hylo/presenters/GroupViewPresenter'
import { spaceUrl, myHomeLandingUrl } from '@hylo/navigation'
import Icon from 'components/Icon'
import LucideIcon from 'components/LucideIcon/LucideIcon'
import InfoButton from 'components/ui/info'
import { Command, CommandItem, CommandList } from 'components/ui/command'
import useMobileNavBack from 'hooks/useMobileNavBack'
import GroupViewIcon from 'routes/AuthLayoutRouter/components/ContextMenu/GroupViewIcon'
import { hueOf, viewCardColor } from 'routes/AuthLayoutRouter/components/ContextMenu/viewCardTheme'
import { bgImageStyle, cn } from 'util/index'
import { isCompactLayoutDevice, isPhoneDevice } from 'util/mobile'

/**
 * The prototype's icon chrome: the view icon on a tile tinted to its
 * post-type color (slate for custom and non-post views).
 */
function ViewIconTile ({ icon, hue, className }) {
  if (!icon) return null
  return (
    <span
      className={cn(
        'w-8 h-8 rounded-[9px] grid place-items-center shrink-0 border-2',
        'bg-[hsl(var(--vh-hue)_48%_90%)] border-[hsl(var(--vh-hue)_40%_70%)] text-[hsl(var(--vh-hue)_45%_35%)]',
        'dark:bg-[hsl(var(--vh-hue)_40%_26%)] dark:border-[hsl(var(--vh-hue)_40%_42%)] dark:text-[hsl(var(--vh-hue)_60%_82%)]',
        className
      )}
      style={{ '--vh-hue': hue }}
    >
      {typeof icon === 'string'
        ? <LucideIcon name={icon} className='w-[18px] h-[18px]' fallback={<Icon name={icon} className='text-lg leading-none' />} />
        : React.cloneElement(icon, { className: 'w-[18px] h-[18px]' })}
    </span>
  )
}

const ViewHeader = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const {
    performBack,
    headerDetails,
    location,
    group,
    currentUser,
    groupSlug,
    spaceSlug,
    context,
    isOneColumnGroup,
    isOneColumnContext,
    oneColumn,
    isSingleViewSpace,
    presentedSpaceView,
    isSpaceMember
  } = useMobileNavBack()
  const { backButton, mobileBackButton, title, icon, info, search, centered, headerActions } = headerDetails
  const compactLayout = isCompactLayoutDevice()
  const spaceName = presentedSpaceView ? displayNameForView(presentedSpaceView, t) : null

  const hasTitle = typeof title === 'string'
    ? title.length > 0
    : React.isValidElement(title)
      ? true
      : !!(title?.mobile || title?.desktop)

  // On phones, parent breadcrumb levels collapse to just their icon/avatar so
  // the current view's title keeps the room. Phone devices always collapse;
  // desktop browsers collapse only below the sm breakpoint.
  const parentCrumbNameClass = isPhoneDevice() ? 'hidden' : 'hidden sm:block'

  // Members inside a single-view space read as "Space: View"
  const spaceSubSegment = spaceSlug ? (location.pathname.split(`/spaces/${spaceSlug}/`)[1] || '').split('/')[0] : null
  const spaceSubViewTitle = isSingleViewSpace && ['members', 'about'].includes(spaceSubSegment) && typeof title === 'string'
    ? title
    : null

  const spaceAboutUrl = groupSlug && spaceSlug ? spaceUrl(groupSlug, spaceSlug, 'about') : null

  // The view's brand hue, from the path segment naming the view
  const viewHue = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean)
    let rest = parts
    if (parts[0] === 'groups') rest = parts[2] === 'spaces' ? parts.slice(4) : parts.slice(2)
    else if (['all', 'my', 'public'].includes(parts[0])) rest = parts.slice(1)
    return hueOf(viewCardColor({ type: rest[0] || null }))
  }, [location.pathname])

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
  // two taps. Shared with Android hardware back via performMobileNavBack.
  const handleChevronClick = performBack

  // Hide ViewHeader on card-menu levels (homes have their own banner;
  // nested grids have their own sticky back bar). Show it on actual views.
  const isOneColumnMenuLevel = useMemo(() => {
    if (!oneColumn) return false
    const path = location.pathname.replace(/\/$/, '')
    if (isOneColumnContext && path === `/${context}`) return true
    if (!isOneColumnGroup || !groupSlug) return false
    const groupBase = `/groups/${groupSlug}`
    if (path === groupBase || path === `${groupBase}/more-spaces`) return true
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
    <header className={cn('ViewHeader flex flex-row items-center z-40 p-2 sticky top-0 w-full bg-context-menu-background border-b border-foreground/[0.08] shadow-header dark:border-transparent dark:shadow-header-dark', {
      'justify-center': centered,
      hidden: (oneColumn && isBannerVisible) || isOneColumnMenuLevel
    })}
    >
      {centered && (backButton || mobileBackButton) && (
        <button
          className={cn('p-2 -ml-1 cursor-pointer absolute left-0 z-10', !compactLayout && 'sm:hidden', !compactLayout && backButton && 'sm:block')}
          onClick={handleChevronClick}
          data-testid='view-header-nav-toggle'
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
            data-testid='view-header-nav-toggle'
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
            !isSingleViewSpace && hasTitle && cn('max-w-[25%]', parentCrumbNameClass)
          )}
          >
            {spaceName}{isSingleViewSpace && spaceSubViewTitle ? `: ${spaceSubViewTitle}` : ''}
          </span>
          {spaceAboutUrl && (
            <button
              type='button'
              className='ml-1 p-0.5 shrink-0 text-foreground/50 hover:text-foreground'
              onClick={() => navigate(spaceAboutUrl)}
              aria-label={t('About')}
            >
              <Info className='w-4 h-4' />
            </button>
          )}
          {!isSingleViewSpace && hasTitle && <span className='mx-1.5 shrink-0 text-foreground/40'>{'>'}</span>}
        </>
      )}
      {!centered && !oneColumn && !isSingleViewSpace && icon && <ViewIconTile icon={icon} hue={viewHue} className='mr-3' />}
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
                <button
                  type='button'
                  className='p-0.5 shrink-0 text-foreground/50 hover:text-foreground'
                  onClick={() => navigate(`${spaceHref}/about`)}
                  aria-label={t('About')}
                >
                  <Info className='w-4 h-4' />
                </button>
              </>
            )}
            {hasTitle && <span className='text-foreground/30 text-lg shrink-0'>{'>'}</span>}
            {hasTitle && icon && <ViewIconTile icon={icon} hue={viewHue} />}
          </div>
        )
      })()}
      {isOneColumnContext && (() => {
        const hasTitle = typeof title === 'string'
          ? title.length > 0
          : React.isValidElement(title)
            ? true
            : !!(title?.mobile || title?.desktop)
        const contextHref = context === 'public' ? '/public' : myHomeLandingUrl()
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
            {hasTitle && icon && <ViewIconTile icon={icon} hue={viewHue} />}
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
