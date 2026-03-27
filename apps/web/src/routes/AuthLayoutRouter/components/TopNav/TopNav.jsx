import { cn } from 'util/index'
import { get } from 'lodash/fp'
import { Globe, HelpCircle, PlusCircle, Bell, MessagesSquare, Layers, Pin, X } from 'lucide-react'
import React, { Suspense, useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from 'components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from 'components/ui/tooltip'
import BadgedIcon from 'components/BadgedIcon'
import CreateMenu from 'components/CreateMenu'
import { getMyGroupsWithChildren } from 'store/selectors/getMyGroups'
import useRouteParams from 'hooks/useRouteParams'
import { baseUrl } from '@hylo/navigation'
import { DEFAULT_AVATAR } from 'store/models/Group'
import Badge from 'components/Badge'
import { SettingsMenu } from '../GlobalNav/GlobalNav'
import { pinGroup } from 'store/actions/pinGroup'

const NotificationsDropdown = React.lazy(() => import('../GlobalNav/NotificationsDropdown'))

function TabAvatar ({ img, label, size = 26, className }) {
  const isDefaultAvatar = img === DEFAULT_AVATAR
  if (img && !isDefaultAvatar) {
    return (
      <div
        className={cn('rounded-sm bg-primary bg-cover bg-center', className)}
        style={{ width: size, height: size, backgroundImage: `url(${img})` }}
      />
    )
  }
  if (isDefaultAvatar) {
    return (
      <div
        className={cn('rounded-sm flex items-center justify-center text-[10px] font-bold text-white', className)}
        style={{ width: size, height: size, background: 'linear-gradient(to bottom right, hsl(var(--focus)), hsl(var(--selected)))' }}
      >
        {label?.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase()).join('')}
      </div>
    )
  }
  return null
}

function StackedAvatars ({ parentImg, parentLabel, childGroups }) {
  // Show parent + up to 2 children stacked: top-left -> bottom-right
  const stackItems = [
    { img: parentImg, label: parentLabel },
    ...childGroups.slice(0, 2).map(c => ({ img: c.avatarUrl, label: c.name }))
  ]
  const count = stackItems.length
  const itemSize = 22
  const offset = 3
  const frameSize = itemSize + (count - 1) * offset

  return (
    <div className='relative shrink-0 flex items-center justify-center' style={{ width: frameSize, height: frameSize }}>
      {stackItems.map((item, i) => (
        <div
          key={i}
          className='absolute rounded-sm overflow-hidden border border-foreground/20'
          style={{
            top: i * offset,
            left: i * offset,
            zIndex: count - i
          }}
        >
          <TabAvatar img={item.img} label={item.label} size={itemSize} />
        </div>
      ))}
    </div>
  )
}

function TopNavTab ({ label, img, url, badgeCount = 0, children, isActive, onNavigate, iconOnly = false, childGroups, onNavigateChild }) {
  const { t } = useTranslation()
  const hasChildren = childGroups && childGroups.length > 0

  const tabContent = (
    <div
      onClick={hasChildren ? undefined : () => onNavigate(url)}
      className={cn(
        'TopNavTab group relative flex items-center h-full cursor-pointer select-none',
        'border-r border-foreground/10 transition-colors duration-150',
        'hover:bg-foreground/10',
        iconOnly ? 'px-1.5 justify-center' : 'px-3 gap-1.5',
        {
          'bg-foreground/5': isActive,
          'border-b-2 border-b-selected': isActive
        }
      )}
      style={{ flex: '1 1 0', minWidth: hasChildren && iconOnly ? 44 : 34, maxWidth: iconOnly ? (hasChildren ? 70 : 50) : 200 }}
    >
      <div className='relative shrink-0'>
        {hasChildren
          ? <StackedAvatars parentImg={img} parentLabel={label} childGroups={childGroups} />
          : img
            ? <TabAvatar img={img} label={label} />
            : children
              ? <span className='w-[26px] h-[26px] flex items-center justify-center [&>svg]:w-5 [&>svg]:h-5'>{children}</span>
              : null}
        {(badgeCount > 0 || badgeCount === '-') && (
          <span className='absolute -top-1.5 -right-1.5 z-10 w-2.5 h-2.5 rounded-full bg-accent border border-card' />
        )}
      </div>
      {!iconOnly && <span className='truncate text-xs font-medium text-foreground/80'>{label}</span>}
    </div>
  )

  if (hasChildren) {
    return (
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              {tabContent}
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side='bottom' className='text-xs'>
            {label}
          </TooltipContent>
        </Tooltip>
        <PopoverContent side='bottom' align='start' className='w-56 p-1'>
          <div
            onClick={() => onNavigate(url)}
            className='flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-foreground/10 transition-colors font-medium'
          >
            <TabAvatar img={img} label={label} size={20} />
            <span className='truncate text-sm'>{label}</span>
          </div>
          {childGroups.map(child => (
            <div
              key={child.id}
              onClick={() => onNavigate(`/groups/${child.slug}`)}
              className='flex items-center gap-2 pl-6 pr-2 py-1.5 rounded-md cursor-pointer hover:bg-foreground/10 transition-colors'
            >
              <TabAvatar img={child.avatarUrl} label={child.name} size={18} />
              <span className='truncate text-sm text-foreground/70'>{child.name}</span>
            </div>
          ))}
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {tabContent}
      </TooltipTrigger>
      <TooltipContent side='bottom' className='text-xs'>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export default function TopNav ({ currentUser }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const routeParams = useRouteParams()
  const sortedGroups = useSelector(getMyGroupsWithChildren)
  const tabContainerRef = useRef(null)
  const [visibleGroupCount, setVisibleGroupCount] = useState(sortedGroups.length)
  const [iconOnly, setIconOnly] = useState(false)

  const currentBase = baseUrl({ context: routeParams.context, groupSlug: routeParams.groupSlug })

  const handleNavigate = useCallback((url) => {
    if (url) navigate(url)
  }, [navigate])

  // Fixed tabs (always shown)
  const fixedTabs = useMemo(() => [
    { key: 'home', label: t('My Home'), url: '/my', img: get('avatarUrl', currentUser) },
    { key: 'messages', label: t('Messages'), url: '/messages', badgeCount: currentUser?.unseenThreadCount || 0 },
    { key: 'commons', label: t('The Commons'), url: '/public' }
  ], [currentUser, t])

  // Build a set of group IDs that are children of other groups (to exclude from top level)
  const childGroupIds = useMemo(() => {
    const ids = new Set()
    sortedGroups.forEach(group => {
      (group.childGroups || []).forEach(c => ids.add(c.id))
    })
    return ids
  }, [sortedGroups])

  // Group tabs - only show top-level groups (not children of other groups in the list)
  const groupTabs = useMemo(() =>
    sortedGroups
      .filter(group => !childGroupIds.has(group.id))
      .map(group => ({
        key: `group-${group.id}`,
        groupId: group.id,
        label: group.name,
        url: `/groups/${group.slug}`,
        img: group.avatarUrl,
        badgeCount: group.newPostCount ? '-' : 0,
        childGroups: group.childGroups || []
      })),
  [sortedGroups, childGroupIds])

  // Measure how many group tabs fit and whether to use icon-only mode
  useEffect(() => {
    const container = tabContainerRef.current
    if (!container) return

    const ICON_ONLY_TAB_WIDTH = 38 // avatar (26px) + padding (2 * 6px)
    const OVERFLOW_BUTTON_WIDTH = 52
    const FIXED_TAB_ICON_ONLY_WIDTH = ICON_ONLY_TAB_WIDTH // fixed tabs in icon-only are same size

    const measure = () => {
      const containerWidth = container.clientWidth

      if (groupTabs.length === 0) {
        setVisibleGroupCount(0)
        setIconOnly(false)
        return
      }

      // Calculate with icon-only fixed tabs (since if we have many groups, everything goes icon-only)
      const fixedTabsIconOnlyWidth = fixedTabs.length * FIXED_TAB_ICON_ONLY_WIDTH
      const availableForGroups = containerWidth - fixedTabsIconOnlyWidth

      // Can all groups fit as icon-only (no overflow)?
      const iconOnlyTotal = ICON_ONLY_TAB_WIDTH * groupTabs.length
      if (iconOnlyTotal <= availableForGroups) {
        setVisibleGroupCount(groupTabs.length)
        setIconOnly(true)
        return
      }

      // Not all fit - show as many as possible with overflow button
      const availableWithOverflow = availableForGroups - OVERFLOW_BUTTON_WIDTH
      const fitCount = Math.max(0, Math.floor(availableWithOverflow / ICON_ONLY_TAB_WIDTH))
      setVisibleGroupCount(fitCount)
      setIconOnly(true)
    }

    const raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
    }
  }, [fixedTabs.length, groupTabs.length])

  const visibleGroups = groupTabs.slice(0, visibleGroupCount)
  const overflowGroups = groupTabs.slice(visibleGroupCount)
  const hasOverflow = overflowGroups.length > 0
  const overflowHasBadge = overflowGroups.some(tab => tab.badgeCount > 0 || tab.badgeCount === '-')

  const handlePinGroup = useCallback((groupId, e) => {
    e.stopPropagation()
    dispatch(pinGroup(groupId))
  }, [dispatch])

  return (
    <div
      className='TopNav flex items-stretch bg-card w-full h-11 shrink-0 border-b border-foreground/15 z-50 relative'
      style={{
        boxShadow: '0 1px 3px hsl(var(--darkening) / 0.15)'
      }}
    >
      <div className='absolute inset-0 bg-theme-highlight/30 dark:bg-theme-highlight/50 z-0' />

      {/* Notifications button */}
      <Suspense fallback={
        <div className='relative z-10 flex items-center px-3 border-r border-foreground/10'>
          <Bell className='w-7 h-7' />
        </div>
      }
      >
        <NotificationsDropdown renderToggleChildren={showBadge =>
          <div className='relative z-10 flex items-center px-3 border-r border-foreground/10 cursor-pointer hover:bg-foreground/10 transition-colors'>
            <BadgedIcon name='Notifications' className='!text-foreground cursor-pointer text-2xl' />
          </div>}
        />
      </Suspense>

      {/* Tab container */}
      <div
        ref={tabContainerRef}
        className='relative z-10 flex items-stretch flex-1 overflow-hidden'
      >
        {fixedTabs.map(tab => (
          <TopNavTab
            key={tab.key}
            label={tab.label}
            img={tab.img}
            url={tab.url}
            badgeCount={tab.badgeCount}
            isActive={currentBase === tab.url}
            onNavigate={handleNavigate}
            iconOnly={iconOnly}
          >
            {tab.key === 'messages' && <MessagesSquare className='w-4 h-4' />}
            {tab.key === 'commons' && <Globe className='w-4 h-4' />}
          </TopNavTab>
        ))}

        {visibleGroups.map(tab => (
          <TopNavTab
            key={tab.key}
            label={tab.label}
            img={tab.img}
            url={tab.url}
            badgeCount={tab.badgeCount}
            isActive={currentBase === tab.url}
            onNavigate={handleNavigate}
            iconOnly={iconOnly}
            childGroups={tab.childGroups}
          />
        ))}

      </div>

      {/* Overflow button - outside tab container so it's always visible */}
      {hasOverflow && (
        <Popover>
          <PopoverTrigger asChild>
            <div
              className={cn(
                'relative z-10 flex items-center gap-1 h-full px-2 cursor-pointer select-none shrink-0',
                'border-r border-foreground/10 transition-colors duration-150',
                'hover:bg-foreground/10'
              )}
            >
              <div className='relative'>
                <Layers className='w-5 h-5 text-foreground/60' />
                {overflowHasBadge && (
                  <span className='absolute -top-1.5 -right-1.5 z-10 w-2.5 h-2.5 rounded-full bg-accent border border-card' />
                )}
              </div>
              <span className='text-xs font-bold text-foreground/60'>{overflowGroups.length}</span>
            </div>
          </PopoverTrigger>
          <PopoverContent side='bottom' align='start' className='w-64 max-h-80 overflow-y-auto p-1'>
            {overflowGroups.map(tab => {
              const isDefaultAvatar = tab.img === DEFAULT_AVATAR
              return (
                <div
                  key={tab.key}
                  onClick={() => handleNavigate(tab.url)}
                  className={cn(
                    'group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer',
                    'hover:bg-foreground/10 transition-colors',
                    { 'bg-selected/10': currentBase === tab.url }
                  )}
                >
                  {tab.img && !isDefaultAvatar
                    ? (
                      <div
                        className='w-5 h-5 rounded-sm bg-primary shrink-0 bg-cover bg-center'
                        style={{ backgroundImage: `url(${tab.img})` }}
                      />
                      )
                    : (
                      <div
                        className='w-5 h-5 rounded-sm shrink-0 flex items-center justify-center text-[9px] font-bold text-white'
                        style={{ background: 'linear-gradient(to bottom right, hsl(var(--focus)), hsl(var(--selected)))' }}
                      >
                        {tab.label?.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase()).join('')}
                      </div>
                      )}
                  <span className='truncate text-sm flex-1'>{tab.label}</span>
                  {(tab.badgeCount > 0 || tab.badgeCount === '-') && (
                    <span className='w-2 h-2 rounded-full bg-accent shrink-0' />
                  )}
                  <button
                    onClick={(e) => handlePinGroup(tab.groupId, e)}
                    className='shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1 rounded hover:bg-foreground/20'
                    title={t('Pin to top')}
                  >
                    <Pin className='w-3 h-3' />
                  </button>
                </div>
              )
            })}
          </PopoverContent>
        </Popover>
      )}

      {/* Action buttons */}
      <div className='relative z-10 flex items-center gap-1 px-1.5 border-l border-foreground/10'>
        <Popover>
          <PopoverTrigger>
            <div className='flex items-center justify-center w-8 h-8 rounded hover:bg-foreground/10 transition-colors cursor-pointer'>
              <PlusCircle className='w-5 h-5' />
            </div>
          </PopoverTrigger>
          <PopoverContent side='bottom' align='end'>
            <CreateMenu />
          </PopoverContent>
        </Popover>

        <SettingsMenu
          currentUser={currentUser}
          triggerClassName='flex items-center justify-center w-8 h-8 rounded hover:bg-foreground/10 transition-colors cursor-pointer'
          contentSide='bottom'
          contentAlign='end'
        />

        <Popover>
          <PopoverTrigger>
            <div className='flex items-center justify-center w-8 h-8 rounded hover:bg-foreground/10 transition-colors cursor-pointer'>
              <HelpCircle className='w-5 h-5' />
            </div>
          </PopoverTrigger>
          <PopoverContent side='bottom' align='end'>
            <ul className='flex flex-col gap-2 m-0 p-0'>
              <li className='w-full'><a className='text-foreground cursor-pointer hover:text-foreground/100 px-2 py-1 border-foreground/20 border-2 w-full rounded-lg block hover:scale-105 transition-all hover:border-foreground/50 flex items-center gap-2 text-sm' href='https://hylozoic.gitbook.io/hylo/guides/hylo-user-guide' target='_blank' rel='noreferrer'>{t('User Guide')}</a></li>
              <li className='w-full'><a className='text-foreground cursor-pointer hover:text-foreground/100 px-2 py-1 border-foreground/20 border-2 w-full rounded-lg block hover:scale-105 transition-all hover:border-foreground/50 flex items-center gap-2 text-sm' href='http://hylo.com/terms/' target='_blank' rel='noreferrer'>{t('Terms & Privacy')}</a></li>
              <li className='w-full'><a className='text-foreground cursor-pointer hover:text-foreground/100 px-2 py-1 border-foreground/20 border-2 w-full rounded-lg block hover:scale-105 transition-all hover:border-foreground/50 flex items-center gap-2 text-sm' href='https://opencollective.com/hylo' target='_blank' rel='noreferrer'>{t('Contribute to Hylo')}</a></li>
            </ul>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
