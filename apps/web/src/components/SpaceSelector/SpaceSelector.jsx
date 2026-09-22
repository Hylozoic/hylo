import { cn } from 'util/index'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import LucideIcon from 'components/LucideIcon/LucideIcon'
import RoundImage from 'components/RoundImage'
import { DEFAULT_AVATAR } from 'store/models/Group'
import { categorizeOffMenuSpaces } from 'store/selectors/getMoreSpacesSections'

/** Searchable, drag-reorderable picker of a group's spaces for a space-collection view. */
export default function SpaceSelector ({
  spaces = [],
  selectedSpaces = [],
  draggable = true,
  onSelectSpace,
  onRemoveSpace,
  onReorderSpace,
  onCreateSpace
}) {
  const { t } = useTranslation()
  const [autocomplete, setAutocomplete] = useState('')
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [dragIndex, setDragIndex] = useState(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const searchBoxRef = useRef()

  const selectedIds = useMemo(
    () => new Set(selectedSpaces.map(space => String(space.id))),
    [selectedSpaces]
  )

  const availableSpaces = useMemo(
    () => (spaces || []).filter(space => !selectedIds.has(String(space.id))),
    [spaces, selectedIds]
  )

  const filteredSpaces = useMemo(() => {
    const term = autocomplete.trim().toLowerCase()
    if (!term) return availableSpaces
    return availableSpaces.filter(space => (space.name || '').toLowerCase().includes(term))
  }, [availableSpaces, autocomplete])

  const suggestionSections = useMemo(() => {
    const sections = categorizeOffMenuSpaces(filteredSpaces, new Set())
    return [
      { key: 'other', items: sections.otherSpaces },
      { key: 'tracks', label: t('Tracks'), items: sections.trackSpaces },
      { key: 'funding-rounds', label: t('Funding Rounds'), items: sections.fundingRoundSpaces },
      { key: 'drafts', label: t('Drafts'), items: sections.draftSpaces },
      { key: 'archived', label: t('Archived'), items: sections.archivedSpaces }
    ].filter(section => section.items.length > 0)
  }, [filteredSpaces, t])

  const hideSuggestions = () => setSuggestionsOpen(false)

  useEffect(() => {
    if (!suggestionsOpen) return
    window.addEventListener('click', hideSuggestions)
    return function cleanup () {
      window.removeEventListener('click', hideSuggestions)
    }
  }, [suggestionsOpen])

  useEffect(() => {
    if (!suggestionsOpen || !searchBoxRef.current) return

    const updatePosition = () => {
      const rect = searchBoxRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      })
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [suggestionsOpen])

  const handleSelectSpace = (space, event) => {
    event.preventDefault()
    event.stopPropagation()
    onSelectSpace?.(space)
    searchBoxRef.current?.focus()
  }

  const handleDelete = (space, index) => () => {
    onRemoveSpace?.(space, index)
  }

  const handleDragStart = (event) => {
    setDragIndex(event.active.data.current.sortable.index)
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const activeIndex = active.data.current.sortable.index
      const overIndex = over.data.current.sortable.index
      onReorderSpace?.(selectedSpaces[activeIndex], overIndex)
    }
    setDragIndex(null)
  }

  const showSuggestions = suggestionsOpen && (
    suggestionSections.length > 0 || Boolean(onCreateSpace) || autocomplete.trim().length > 0
  )

  const suggestionsDropdown = showSuggestions
    ? createPortal(
      <div
        className='fixed bg-card rounded-lg shadow-lg p-2 z-[10000]'
        style={{
          top: dropdownPosition.top,
          left: dropdownPosition.left,
          width: dropdownPosition.width
        }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
      >
        <ul className='flex flex-col gap-1 max-h-[16rem] overflow-y-auto m-0 p-0'>
          {onCreateSpace && (
            <li className='m-0 p-0 text-sm'>
              <button
                type='button'
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  onCreateSpace()
                  setSuggestionsOpen(false)
                }}
                className='w-full text-left text-foreground flex flex-row gap-1 items-center p-1 rounded-md hover:bg-selected hover:text-foreground'
              >
                <Plus className='w-4 h-4 shrink-0' />
                <span>{t('Create a new space')}</span>
              </button>
            </li>
          )}
          {suggestionSections.length === 0 && (
            <li className='m-0 p-1 text-sm text-foreground/50'>{t('No matching spaces')}</li>
          )}
          {suggestionSections.map(section => (
            <li key={section.key} className='m-0 p-0'>
              {section.label && (
                <div className='text-[11px] font-semibold uppercase tracking-wide text-foreground/50 px-1 pt-1'>
                  {section.label}
                </div>
              )}
              <ul className='m-0 p-0'>
                {section.items.map(space => (
                  <Suggestion
                    key={space.id}
                    space={space}
                    onSelect={handleSelectSpace}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>,
      document.body)
    : null

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <SortableContext items={selectedSpaces} strategy={verticalListSortingStrategy}>
        <div>
          <div>
            {selectedSpaces.map((space, i) => (
              <SelectedSpaceDraggable
                draggable={draggable}
                dragging={i === dragIndex}
                handleDelete={handleDelete}
                index={i}
                key={space.id}
                space={space}
              />
            ))}
          </div>
          <div className='relative'>
            <input
              className='bg-input/60 focus:bg-input/100 rounded-lg text-foreground placeholder-foreground/40 w-full py-2 px-2 transition-all outline-none focus:outline-focus focus:outline-2'
              ref={searchBoxRef}
              type='text'
              placeholder={t('Search for spaces')}
              spellCheck={false}
              value={autocomplete}
              onChange={event => setAutocomplete(event.target.value)}
              onFocus={() => setSuggestionsOpen(true)}
              onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  e.target.blur()
                  setSuggestionsOpen(false)
                }
              }}
            />
            {suggestionsDropdown}
          </div>
        </div>
      </SortableContext>

      <DragOverlay>
        {dragIndex !== null
          ? (
            <SelectedSpace
              draggable
              handleDelete={() => {}}
              index={dragIndex}
              space={selectedSpaces[dragIndex]}
            />)
          : null}
      </DragOverlay>
    </DndContext>
  )
}

function SelectedSpaceDraggable ({ draggable, dragging, index, handleDelete, space }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition
  } = useSortable({
    id: space.id,
    disabled: !draggable,
    transition: {
      duration: 150,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)'
    }
  })

  const style = {
    transform: CSS.Transform.toString(transform && { ...transform, scaleY: 1 }),
    transition,
    opacity: dragging ? 0 : 1
  }

  return (
    <SelectedSpace
      ref={setNodeRef}
      {...{ space, attributes, index, handleDelete, draggable, listeners, style }}
    />
  )
}

const SelectedSpace = forwardRef((props, ref) => {
  const { t } = useTranslation()
  const { attributes, draggable, index, handleDelete, listeners, space, style } = props

  const handleTrashClick = (event) => {
    event.preventDefault()
    event.stopPropagation()
    handleDelete(space, index)()
  }

  return (
    <div
      className={cn(
        'rounded-xl p-1 flex flex-row gap-2 items-center justify-between transition-all bg-midground/50 hover:bg-midground/100 border-2 border-card/30 shadow-xl hover:shadow-lg mb-2 relative hover:z-[2] duration-400',
        { 'bg-selected': draggable }
      )}
      ref={ref}
      style={style}
      {...attributes}
    >
      <div className='flex flex-row gap-2 items-center min-w-0'>
        <SpaceAvatar space={space} />
        <span className='truncate text-sm'>{space.name}</span>
        {space.isDraft && (
          <span className='text-[10px] font-semibold text-foreground/50 shrink-0'>{t('Draft')}</span>
        )}
        {space.status === 'archived' && (
          <span className='text-[10px] font-semibold text-foreground/50 shrink-0'>{t('Archived')}</span>
        )}
      </div>
      <div className='flex flex-row gap-2 items-center shrink-0'>
        <button
          type='button'
          onClick={handleTrashClick}
          className='text-foreground/50 hover:text-destructive'
          aria-label={t('Remove space')}
        >
          <Trash2 className='w-4 h-4' />
        </button>
        {draggable && (
          <span className='cursor-grab touch-none' {...listeners}>
            <GripVertical className='w-5 h-5 text-foreground/70 hover:text-foreground' />
          </span>
        )}
      </div>
    </div>
  )
})

function Suggestion ({ space, onSelect }) {
  const { t } = useTranslation()
  return (
    <li className='m-0 p-0 text-sm'>
      <a
        onClick={event => onSelect(space, event)}
        className='text-foreground flex flex-row gap-1 items-center p-1 rounded-md hover:bg-selected hover:text-foreground'
      >
        <SpaceAvatar space={space} />
        <span className='truncate'>{space.name}</span>
        {space.isDraft && (
          <span className='text-[10px] font-semibold text-foreground/50 shrink-0'>{t('Draft')}</span>
        )}
      </a>
    </li>
  )
}

function SpaceAvatar ({ space }) {
  if (space?.avatarUrl) {
    return <RoundImage url={space.avatarUrl} small />
  }
  if (space?.icon) {
    return (
      <span className='w-6 h-6 rounded-full bg-foreground/10 grid place-items-center shrink-0'>
        <LucideIcon name={space.icon} className='w-3.5 h-3.5' />
      </span>
    )
  }
  return <RoundImage url={DEFAULT_AVATAR} small />
}
