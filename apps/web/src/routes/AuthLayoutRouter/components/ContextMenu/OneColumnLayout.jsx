import { cn, bgImageStyle } from 'util/index'
import { Bell, Settings, Users, Copy, ExternalLink, GripHorizontal, Plus, Pencil, Trash, House, X, Grid3x3 } from 'lucide-react'
import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  closestCorners
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import ContextWidgetPresenter, {
  orderContextWidgetsForContextMenu,
  allViewsWidget,
  isHiddenInContextMenuResolver,
  translateTitle
} from '@hylo/presenters/ContextWidgetPresenter'
import { widgetUrl, groupUrl, currentUserSettingsUrl, addQuerystringToPath } from '@hylo/navigation'
import { DEFAULT_BANNER, DEFAULT_AVATAR } from 'store/models/Group'
import { getContextWidgets } from 'store/selectors/contextWidgetSelectors'
import { RESP_ADMINISTRATION } from 'store/constants'
import hasResponsibilityForGroup from 'store/selectors/hasResponsibilityForGroup'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import WidgetIconResolver from 'components/WidgetIconResolver'
import { Tooltip, TooltipTrigger, TooltipContent } from 'components/ui/tooltip'
import { Dialog, DialogContent, DialogTitle } from 'components/ui/dialog'
import { updateContextWidget, removeWidgetFromMenu, setHomeWidget } from 'store/actions/contextWidgets'
import getMe from 'store/selectors/getMe'
import { mapbox as mapboxConfig } from 'config'
import { useTheme } from 'contexts/ThemeContext'
import { useViewHeader } from 'contexts/ViewHeaderContext'
// Drop zone between cards
function CardDropZone ({ droppableParams, isRemoval, children }) {
  const { setNodeRef, isOver } = useDroppable(droppableParams)

  if (isRemoval) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          'w-full rounded-lg border-2 border-dashed p-3 text-center text-sm transition-all',
          isOver ? 'bg-destructive/30 border-destructive' : 'bg-destructive/10 border-foreground/30'
        )}
      >
        {children}
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'transition-all duration-200 rounded-lg',
        isOver ? 'h-[60px] bg-selected/30 border-2 border-dashed border-selected' : 'h-0'
      )}
    />
  )
}

// Action buttons for editing a card
function CardActionMenu ({ widget, group, dispatch, navigate, t }) {
  const handleRemove = useCallback((e) => {
    e.stopPropagation()
    if (window.confirm(t('Are you sure you want to remove {{name}} from the menu?', { name: translateTitle(widget.title, t) }))) {
      dispatch(removeWidgetFromMenu({ contextWidgetId: widget.id, groupId: group.id }))
    }
  }, [widget.id, group.id])

  const handleSetHome = useCallback((e) => {
    e.stopPropagation()
    if (window.confirm(t('Set this as the default home view for this group?'))) {
      dispatch(setHomeWidget({ contextWidgetId: widget.id, groupId: group.id }))
    }
  }, [widget.id, group.id])

  return (
    <div className='absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10'>
      {widget.isDeletable && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={handleRemove} className='p-1 rounded hover:bg-foreground/10'>
              <Trash className='w-3.5 h-3.5 text-foreground/50' />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('Remove from Menu')}</TooltipContent>
        </Tooltip>
      )}
      {widget.isValidHomeWidget && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={handleSetHome} className='p-1 rounded hover:bg-foreground/10'>
              <House className='w-3.5 h-3.5 text-foreground/50' />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('Set as Home View')}</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

function AddExistingViewModal ({ open, onClose, contextWidgets, group, parentId, dispatch, t }) {
  const availableWidgets = useMemo(() => {
    return contextWidgets
      .filter(w => !w.order && w.id)
      .map(w => ({ ...w, title: w.title?.startsWith('widget-') ? t(w.title) : w.title }))
      .sort((a, b) => (a.title || '').localeCompare(b.title || ''))
  }, [contextWidgets, t])

  const handleAdd = useCallback((widget) => {
    dispatch(updateContextWidget({
      contextWidgetId: widget.id,
      groupId: group.id,
      data: { parentId: parentId || null, addToEnd: true }
    }))
    onClose()
  }, [group?.id, parentId, onClose])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className='max-w-[450px] max-h-[80vh] overflow-y-auto'>
        <DialogTitle>{t('Add Existing View')}</DialogTitle>
        {availableWidgets.length === 0
          ? <p className='text-sm text-foreground/50 py-4 text-center'>{t('All views have been added to the menu')}</p>
          : (
            <div className='flex flex-col gap-1'>
              {availableWidgets.map(widget => (
                <button
                  key={widget.id}
                  onClick={() => handleAdd(widget)}
                  className='flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-foreground/10 transition-colors text-left w-full'
                >
                  <span className='text-foreground/60 [&>svg]:w-5 [&>svg]:h-5 shrink-0'>
                    <WidgetIconResolver widget={widget} />
                  </span>
                  <span className='text-sm text-foreground flex-1 truncate'>{widget.title}</span>
                  <Plus className='w-4 h-4 text-foreground/30 shrink-0' />
                </button>
              ))}
            </div>
            )}
      </DialogContent>
    </Dialog>
  )
}

function AddViewCard ({ parentId, handlePositionedAdd, onShowAllViews, t, isChatSection }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-foreground/20',
        'p-2 gap-1.5 w-[calc(50%-6px)] aspect-square sm:p-3 sm:gap-3 sm:w-[240px] sm:h-[240px] sm:aspect-auto'
      )}
    >
      <button
        onClick={() => handlePositionedAdd({ addToEnd: true, parentId })}
        className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-xs text-foreground/50 hover:text-foreground/70 transition-all'
      >
        <Plus className='w-3.5 h-3.5' />
        {isChatSection ? t('Add new chat') : t('Add new view')}
      </button>
      <button
        onClick={() => onShowAllViews(parentId)}
        className='flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-xs text-foreground/50 hover:text-foreground/70 transition-all'
      >
        <Grid3x3 className='w-3.5 h-3.5' />
        {t('Add existing view')}
      </button>
    </div>
  )
}

function WidgetCard ({ widget, groupSlug, groupId, navigate, t, isEditing, group, dispatch }) {
  const url = widgetUrl({ widget, groupSlug, context: 'group' })
  const title = widget.title?.startsWith('widget-') ? t(widget.title) : widget.title
  const externalLink = widget.customView?.externalLink || widget.url
  const isExternal = !!(widget.customView?.externalLink || (widget.url && widget.url.startsWith('http')))
  const [copied, setCopied] = useState(false)
  const isWelcome = widget.view === 'welcome'
  const welcomeText = isWelcome && group?.welcomePage
    ? group.welcomePage.replace(/<[^>]*>/g, '').trim()
    : null
  const isMap = widget.view === 'map'
  const currentUser = useSelector(getMe)
  const { effectiveColorScheme } = useTheme()
  const mapStyle = effectiveColorScheme === 'dark' ? 'dark-v11' : 'light-v11'
  const mapCenter = group?.locationObject?.center || currentUser?.locationObject?.center

  const staticMapUrl = isMap && mapboxConfig.token
    ? mapCenter
      ? `https://api.mapbox.com/styles/v1/mapbox/${mapStyle}/static/${mapCenter.lng},${mapCenter.lat},4,0/280x200@2x?access_token=${mapboxConfig.token}`
      : `https://api.mapbox.com/styles/v1/mapbox/${mapStyle}/static/0,20,1,0/280x200@2x?access_token=${mapboxConfig.token}`
    : null

  const canDrag = isEditing && widget.type !== 'home' && widget.type !== 'all-views'
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: widget.id, disabled: !canDrag })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.5 : 1 } : undefined

  const handleClick = () => {
    if (isEditing) return
    if (isExternal && externalLink) {
      window.open(externalLink, '_blank', 'noopener,noreferrer')
    } else if (url) {
      navigate(url)
    }
  }

  const handleCopy = (e) => {
    e.stopPropagation()
    navigator.clipboard.writeText(externalLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className={cn(
        'group relative flex flex-col rounded-xl border-2 border-foreground/10 bg-card/50',
        'transition-all p-2 w-[calc(50%-6px)] aspect-square sm:p-3 sm:w-[240px] sm:h-[240px] sm:aspect-auto',
        isEditing ? 'cursor-grab' : 'cursor-pointer hover:border-foreground/30 hover:shadow-md'
      )}
    >
      {!isEditing && widget.highlightNumber > 0 && (
        <span className='absolute -top-2 -right-2 z-10 bg-accent text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1'>
          {widget.highlightNumber}
        </span>
      )}
      {isEditing && <CardActionMenu widget={widget} group={group} dispatch={dispatch} navigate={navigate} t={t} />}
      {canDrag && (
        <div {...listeners} {...attributes} className='absolute top-1 left-1 opacity-0 group-hover:opacity-60 transition-opacity cursor-grab p-1'>
          <GripHorizontal className='w-4 h-4 text-foreground/50' />
        </div>
      )}

      {/* Icon + title centered in available space */}
      <div className='flex-1 flex flex-col items-center justify-center gap-1.5 text-center'>
        <span className='text-foreground/60 flex items-center justify-center w-[32px] h-[32px] [&>svg]:!w-full [&>svg]:!h-full [&>span]:!text-[32px] [&>span]:!leading-none'>
          <WidgetIconResolver widget={widget} />
        </span>
        <h3 className='text-base font-semibold text-foreground line-clamp-2'>{title}</h3>
      </div>

      {/* Content pinned to bottom */}
      {!isEditing && isExternal && externalLink && (
        <div className='flex flex-col gap-2 mt-auto'>
          <div className='flex items-center gap-1.5 bg-foreground/5 rounded-lg px-2 py-1.5'>
            <span className='truncate text-xs text-foreground/50 flex-1'>{copied ? t('Copied to clipboard') : externalLink}</span>
            <button
              onClick={handleCopy}
              className='shrink-0 p-1 rounded hover:bg-foreground/10 transition-colors'
              title={copied ? t('Copied!') : t('Copy link')}
            >
              <Copy className='w-3.5 h-3.5 text-foreground/40' />
            </button>
          </div>
          <button
            onClick={handleClick}
            className='w-full text-xs py-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-foreground/60 hover:text-foreground/80 transition-colors flex items-center justify-center gap-1'
          >
            <ExternalLink className='w-3 h-3' />
            {t('View {{title}}', { title })}
          </button>
        </div>
      )}

      {!isEditing && isMap && staticMapUrl && (
        <div className='mt-auto -mx-2 -mb-2 rounded-b-lg overflow-hidden'>
          <img
            src={staticMapUrl}
            alt={title}
            className='w-full h-[120px] object-cover'
          />
        </div>
      )}

      {!isEditing && isWelcome && welcomeText && (
        <div className='mt-auto px-1'>
          <p className='text-xs text-foreground/60 line-clamp-5 leading-relaxed'>{welcomeText}</p>
          <button
            onClick={handleClick}
            className='text-xs text-selected hover:text-selected/80 transition-colors mt-1'
          >
            {t('Read more...')}
          </button>
        </div>
      )}

    </div>
  )
}

function WidgetSection ({ widget, groupSlug, groupId, navigate, t, isEditing, group, dispatch, handlePositionedAdd, onShowAllViews }) {
  const title = widget.title?.startsWith('widget-') ? t(widget.title) : widget.title
  const childItems = widget.childWidgets || []

  return (
    <div className='w-full'>
      <h2 className='text-base font-semibold text-foreground/70 mb-3 px-1'>{title}</h2>
      <div className='flex flex-wrap gap-3'>
        {childItems.map(child => (
          <React.Fragment key={child.id}>
            {isEditing && (
              <CardDropZone droppableParams={{ id: `before-${child.id}`, data: { widget: child, parentWidget: widget, parentId: widget.id } }} />
            )}
            <WidgetCard
              widget={child}
              groupSlug={groupSlug}
              groupId={groupId}
              navigate={navigate}
              t={t}
              isEditing={isEditing}
              group={group}
              dispatch={dispatch}
            />
          </React.Fragment>
        ))}
        {isEditing && (
          <>
            <CardDropZone droppableParams={{ id: `end-of-${widget.id}`, data: { addToEnd: true, parentId: widget.id } }} />
            <AddViewCard
              parentId={widget.id}
              handlePositionedAdd={handlePositionedAdd}
              onShowAllViews={onShowAllViews}
              t={t}
              isChatSection={widget.type === 'chats'}
            />
          </>
        )}
      </div>
    </div>
  )
}

export default function OneColumnLayout ({ group }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const groupSlug = group?.slug

  const canAdminister = useSelector(state => hasResponsibilityForGroup(state, { responsibility: RESP_ADMINISTRATION, groupId: group?.id }))
  const isEditing = getQuerystringParam('cme', location) === 'yes' && canAdminister

  // Reset the breadcrumb title — otherwise the previous view's title sticks here on
  // the group home (e.g. clicking the group name from /stream still showed "Stream").
  const { setHeaderDetails } = useViewHeader()
  useEffect(() => {
    setHeaderDetails({})
  }, [setHeaderDetails, groupSlug])

  const rawContextWidgets = useSelector(state => getContextWidgets(state, group))

  const contextWidgets = useMemo(() => {
    return rawContextWidgets.map(widget => ContextWidgetPresenter(widget))
  }, [rawContextWidgets])

  const orderedWidgets = useMemo(() => {
    const widgets = orderContextWidgetsForContextMenu(contextWidgets)
    return isEditing ? widgets : widgets.filter(w => !isHiddenInContextMenuResolver(w))
  }, [contextWidgets, isEditing])

  const bannerUrl = group?.bannerUrl || DEFAULT_BANNER
  const avatarUrl = group?.avatarUrl || DEFAULT_AVATAR
  const isDefaultAvatar = avatarUrl === DEFAULT_AVATAR

  // DnD state
  const [activeWidget, setActiveWidget] = useState(null)
  const [allViewsModalParentId, setAllViewsModalParentId] = useState(null)
  const showAllViewsModal = allViewsModalParentId !== null

  const handleDragStart = useCallback(({ active }) => {
    const found = orderedWidgets.find(w => w.id === active.id) ||
      orderedWidgets.flatMap(w => w.childWidgets || []).find(w => w.id === active.id) ||
      contextWidgets.find(w => w.id === active.id)
    setActiveWidget(found)
  }, [orderedWidgets, contextWidgets])

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event
    if (over && over.id !== active.id && over.id !== 'remove') {
      const orderInFrontOfWidget = over.data?.current?.addToEnd ? null : over.data?.current?.widget
      dispatch(updateContextWidget({
        contextWidgetId: active.id,
        groupId: group.id,
        data: {
          orderInFrontOfWidgetId: orderInFrontOfWidget?.id,
          parentId: over.data.current?.widget?.parentId || over.data?.current?.parentId,
          addToEnd: over.data?.current?.addToEnd
        }
      }))
    }
    if (over && over.id === 'remove') {
      dispatch(removeWidgetFromMenu({ contextWidgetId: active.id, groupId: group.id }))
    }
    setActiveWidget(null)
  }, [group?.id])

  const handleDragCancel = useCallback(() => {
    setActiveWidget(null)
  }, [])

  const handlePositionedAdd = useCallback(({ widget, addToEnd, parentId }) => {
    navigate(addQuerystringToPath(location.pathname, {
      addview: 'yes',
      cme: 'yes',
      parentId: parentId || widget?.parentId,
      orderInFrontOfWidgetId: widget?.id || null
    }))
  }, [location.pathname])

  const toggleEditing = useCallback(() => {
    if (isEditing) {
      // Remove cme param
      const params = new URLSearchParams(location.search)
      params.delete('cme')
      params.delete('addview')
      params.delete('parentId')
      params.delete('orderInFrontOfWidgetId')
      const newSearch = params.toString()
      navigate(`${location.pathname}${newSearch ? `?${newSearch}` : ''}`)
    } else {
      navigate(addQuerystringToPath(location.pathname, { cme: 'yes' }))
    }
  }, [isEditing, location])

  const cardGrid = (
    <div className='flex flex-col gap-6'>
      {/* Removal drop zone */}
      {isEditing && activeWidget && (
        <CardDropZone droppableParams={{ id: 'remove' }} isRemoval>
          {t('Drag here to remove from menu')}
        </CardDropZone>
      )}

      {/* Standalone cards (no children) */}
      {orderedWidgets.some(w => !w.childWidgets?.length) && (
        <div className='flex flex-wrap gap-3'>
          {orderedWidgets
            .filter(w => !w.childWidgets?.length)
            .map(widget => (
              <React.Fragment key={widget.id}>
                {isEditing && (
                  <CardDropZone droppableParams={{ id: `before-${widget.id}`, data: { widget } }} />
                )}
                <WidgetCard
                  widget={widget}
                  groupSlug={groupSlug}
                  groupId={group?.id}
                  navigate={navigate}
                  t={t}
                  isEditing={isEditing}
                  group={group}
                  dispatch={dispatch}
                />
              </React.Fragment>
            ))}
          {isEditing && (
            <>
              <CardDropZone droppableParams={{ id: 'end-of-standalone', data: { addToEnd: true } }} />
              <AddViewCard
                handlePositionedAdd={handlePositionedAdd}
                onShowAllViews={(parentId) => setAllViewsModalParentId(parentId || '')}
                t={t}
              />
            </>
          )}
        </div>
      )}

      {/* Sections (widgets with children) */}
      {orderedWidgets
        .filter(w => w.childWidgets?.length > 0)
        .map(widget => (
          <WidgetSection
            key={widget.id}
            widget={widget}
            groupSlug={groupSlug}
            groupId={group?.id}
            navigate={navigate}
            t={t}
            isEditing={isEditing}
            group={group}
            dispatch={dispatch}
            handlePositionedAdd={handlePositionedAdd}
            onShowAllViews={(parentId) => setAllViewsModalParentId(parentId || '')}
          />
        ))}

      {/* All Views card (non-editing) */}
      {!isEditing && (
        <div className='flex flex-wrap gap-3'>
          <WidgetCard
            widget={allViewsWidget}
            groupSlug={groupSlug}
            groupId={group?.id}
            navigate={navigate}
            t={t}
            isEditing={false}
            group={group}
            dispatch={dispatch}
          />
        </div>
      )}
    </div>
  )

  return (
    <div className='OneColumnLayout w-full h-full overflow-y-auto' id='one-column-layout'>
      {/* Group Banner - full width */}
      <div className='relative w-full'>
        <div id='one-column-banner' className='relative h-[220px] overflow-hidden'>
          <div className='absolute inset-0 bg-cover bg-center' style={{ ...bgImageStyle(bannerUrl), opacity: 0.7 }} />
          <div className='absolute inset-0 bg-darkening/50' />

          <div className='absolute top-3 left-3 z-30'>
            <button onClick={() => navigate(currentUserSettingsUrl('notifications?group=' + group.id))}>
              <Bell className='w-6 h-6 text-white drop-shadow-md hover:scale-110 transition-all' />
            </button>
          </div>

          {canAdminister && (
            <button
              onClick={() => navigate(groupUrl(groupSlug, 'settings', {}))}
              className='absolute top-3 right-3 z-30'
            >
              <Settings className='w-6 h-6 text-white drop-shadow-md hover:scale-110 transition-all' />
            </button>
          )}

          <div className='absolute inset-0 z-20 flex flex-col items-center justify-center gap-1'>
            <div
              className={cn('w-16 h-16 rounded-xl shadow-lg bg-cover bg-center border-2 border-white/30 overflow-hidden relative', { 'bg-darkening': isDefaultAvatar })}
              style={!isDefaultAvatar ? bgImageStyle(avatarUrl) : {}}
            >
              {isDefaultAvatar && (
                <>
                  <div className='absolute inset-0 opacity-70' style={{ background: 'linear-gradient(to bottom right, hsl(var(--focus)), hsl(var(--selected)))' }} />
                  <span className='relative z-10 text-white text-2xl flex items-center justify-center uppercase h-full drop-shadow-md'>
                    {group.name?.split(/\s+/).length > 1
                      ? `${group.name.split(/\s+/)[0].charAt(0)}${group.name.split(/\s+/)[1].charAt(0)}`
                      : group.name?.charAt(0)}
                  </span>
                </>
              )}
            </div>
            <h1 className='text-2xl font-bold text-white drop-shadow-md m-0 leading-tight'>{group.name}</h1>
            <span className='text-sm flex items-center gap-1 text-white/80 drop-shadow-md'>
              <Users className='w-4 h-4' />
              {t('{{count}} Members', { count: group.memberCount || 0 })}
            </span>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className='w-full max-w-[1000px] mx-auto px-4 py-6'>
        {isEditing
          ? (
            <DndContext
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
              collisionDetection={closestCorners}
            >
              {cardGrid}
              <DragOverlay dropAnimation={null}>
                {activeWidget && (
                  <div className='w-[calc(50%-6px)] sm:w-[240px] opacity-80 rotate-2'>
                    <WidgetCard
                      widget={activeWidget}
                      groupSlug={groupSlug}
                      groupId={group?.id}
                      navigate={() => {}}
                      t={t}
                      isEditing
                      group={group}
                      dispatch={() => {}}
                    />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
            )
          : cardGrid}

        {/* Edit / Done button */}
        {canAdminister && (
          <div className='flex justify-center mt-6'>
            <button
              onClick={toggleEditing}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 text-sm transition-all',
                isEditing
                  ? 'border-selected bg-selected/10 text-selected hover:bg-selected/20'
                  : 'border-foreground/20 hover:border-foreground/40 text-foreground/60 hover:text-foreground/80'
              )}
            >
              {isEditing
                ? <><X className='w-4 h-4' /> {t('Done Editing')}</>
                : <><Settings className='w-4 h-4' /> {t('Edit Menu')}</>}
            </button>
          </div>
        )}
      </div>

      {/* Add Existing View Modal */}
      <AddExistingViewModal
        open={showAllViewsModal}
        onClose={() => setAllViewsModalParentId(null)}
        contextWidgets={contextWidgets}
        group={group}
        parentId={allViewsModalParentId || undefined}
        dispatch={dispatch}
        t={t}
      />
    </div>
  )
}
