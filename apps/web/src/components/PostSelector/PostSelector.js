import { cn } from 'util/index'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import update from 'immutability-helper'
import { isEmpty } from 'lodash'
import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useInView } from 'react-cool-inview'
import { useDispatch, useSelector } from 'react-redux'
import Icon from 'components/Icon'
import Loading from 'components/Loading'
import RoundImage from 'components/RoundImage'
import useDebounce from 'hooks/useDebounce'
import fetchPosts from 'store/actions/fetchPosts'
import { FETCH_POSTS } from 'store/constants'
import isPendingFor from 'store/selectors/isPendingFor'

import classes from './PostSelector.module.scss'

const PAGE_SIZE = 10

export default function PostSelector ({ collection, draggable, group, onRemovePost, onReorderPost, onSelectPost, posts }) {
  const dispatch = useDispatch()
  const [autocomplete, setAutocomplete] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [offset, setOffset] = useState('')
  const [selectedPosts, setSelectedPosts] = useState(posts || [])
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [dragIndex, setDragIndex] = useState(null)
  const searchBoxRef = useRef()
  const { t } = useTranslation()

  const debouncedAutcomplete = useDebounce(autocomplete, 300)

  useEffect(() => setSelectedPosts(posts || []), [posts])

  useEffect(() => {
    // TODO: tell people they need to type 2 characters to get results?
    if (!autocomplete?.length || autocomplete.length > 1) {
      dispatch(fetchPosts({
        collectionToFilterOut: collection?.id,
        context: 'groups',
        first: PAGE_SIZE,
        offset: 0,
        search: debouncedAutcomplete,
        slug: group.slug,
        sortBy: 'created'
      })).then(res => {
        setSuggestions(res.payload?.data?.group?.posts?.items || [])
      })
      setOffset(PAGE_SIZE)
    }
  }, [debouncedAutcomplete, collection?.id])

  const { observe } = useInView({
    onEnter: async () => {
      const res = await dispatch(fetchPosts({
        collectionToFilterOut: collection?.id,
        context: 'groups',
        first: PAGE_SIZE,
        search: debouncedAutcomplete,
        offset,
        slug: group.slug,
        sortBy: 'created'
      }))
      setSuggestions(suggestions.concat(res.payload?.data?.group?.posts?.items || []))
      setOffset(offset + PAGE_SIZE)
    }
  })

  const hideSuggestions = () => setSuggestionsOpen(false)

  useEffect(() => {
    if (suggestionsOpen) {
      // initiate the event handler
      window.addEventListener('click', hideSuggestions)

      // this will clean up the event every time the component is re-rendered
      return function cleanup () {
        window.removeEventListener('click', hideSuggestions)
      }
    }
  }, [suggestionsOpen])

  const handleInputChange = (input) => {
    setAutocomplete(input)
  }

  const handleDelete = (post, index) => () => {
    if (window.confirm(t('Remove post?'))) {
      setSelectedPosts((prevPosts) => {
        onRemovePost(post)
        return update(prevPosts, {
          $splice: [
            [index, 1]
          ]
        })
      })
    }
  }

  const handleSelectPost = (p, event) => {
    if (onSelectPost) {
      onSelectPost(p)
    }
    setSelectedPosts([...selectedPosts].concat(p))
    searchBoxRef.current.focus()
    event.preventDefault()
    event.stopPropagation()
  }

  const handleDragStart = (event) => {
    setDragIndex(event.active.data.current.sortable.index)
  }

  const handleDragEnd = (event) => {
    const { active, over } = event

    if (active.id !== over.id) {
      const activeIndex = active.data.current.sortable.index
      const overIndex = over.data.current.sortable.index
      onReorderPost(selectedPosts[activeIndex], over.data.current.sortable.index)
      setSelectedPosts((prevPosts) => {
        return update(prevPosts, {
          $splice: [
            [activeIndex, 1],
            [overIndex, 0, prevPosts[activeIndex]]
          ]
        })
      })
    }
    setDragIndex(null)
  }

  const displaySuggestions = useMemo(() => {
    const selectedPostIds = selectedPosts.map(p => p.id)
    return suggestions.filter(s => !selectedPostIds.includes(s.id))
  }, [suggestions, selectedPosts])

  const pending = useSelector(state => isPendingFor(FETCH_POSTS, state))

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <SortableContext items={selectedPosts} strategy={verticalListSortingStrategy}>
        <div>
          <div className={classes.selectedPosts}>
            {selectedPosts.map((p, i) => (
              <SelectedPostDraggable
                draggable={draggable}
                dragging={i === dragIndex}
                handleDelete={handleDelete}
                index={i}
                key={p.id}
                post={p}
              />)
            )}
          </div>
          <div className='relative'>
            <div>
              <input
                className='bg-input/60 focus:bg-input/100 rounded-lg text-foreground placeholder-foreground/40 w-full py-2 px-2 transition-all outline-none focus:outline-focus focus:outline-2'
                ref={searchBoxRef}
                type='text'
                placeholder={t('Search for posts')}
                spellCheck={false}
                onChange={event => handleInputChange(event.target.value)}
                onFocus={() => setSuggestionsOpen(true)}
                onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                onKeyDown={e => {
                  if (e.key === 'Escape') {
                    e.target.blur()
                    setSuggestionsOpen(false)
                  }
                }}
              />
            </div>
            {suggestionsOpen && (pending || !isEmpty(displaySuggestions)) &&
              <div className='absolute top-full left-0 w-full bg-card rounded-lg shadow-lg p-2 z-[10000]'>
                {pending && <Loading />}
                <ul className='flex flex-col gap-1 max-h-[300px] overflow-y-auto m-0 p-0'>
                  {displaySuggestions.map((s, idx) => (
                    <Suggestion
                      key={s.id}
                      item={s}
                      onSelect={handleSelectPost}
                      observeRef={idx === suggestions.length - 1 ? observe : null}
                    />
                  ))}
                </ul>
              </div>}
          </div>
        </div>
      </SortableContext>

      <DragOverlay>
        {dragIndex !== null
          ? (
            <SelectedPost
              draggable
              group={group}
              handleDelete={() => { }}
              index={dragIndex}
              post={selectedPosts[dragIndex]}
            />)
          : null}
      </DragOverlay>
    </DndContext>
  )
}

function SelectedPostDraggable ({ draggable, dragging, index, handleDelete, post }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition
  } = useSortable({
    id: post.id,
    disabled: !draggable,
    transition: {
      duration: 150, // milliseconds
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)'
    }
  })

  const style = {
    transform: CSS.Transform.toString(transform && { ...transform, scaleY: 1 }),
    transition,
    opacity: dragging ? 0 : 1,
    cursor: 'move'
  }

  return (
    <SelectedPost
      ref={setNodeRef}
      {...{ post, attributes, index, handleDelete, draggable, listeners, style }}
    />
  )
}

const SelectedPost = forwardRef(({ children, ...props }, ref) => {
  const { t } = useTranslation()
  const { attributes, draggable, index, handleDelete, listeners, post, style } = props

  return (
    <div className={cn('rounded-xl cursor-pointer p-1 flex flex-row gap-2 items-center justify-between transition-all bg-midground/50 hover:bg-midground/100 border-2 border-card/30 shadow-xl hover:shadow-lg mb-4 relative hover:z-[2] hover:scale-105 duration-400 cursor-pointer', { 'bg-selected cursor-grab': draggable })} ref={ref} style={style} {...attributes} {...listeners}>
      <div className='flex flex-row gap-2 items-center'>
        <RoundImage url={post?.creator?.avatarUrl} className={classes.selectedPostAvatar} small />
        <span className={classes.postTitle}>{post.title}</span>
      </div>
      <div className='flex flex-row gap-2 items-center'>
        <Icon name='Trash' onClick={handleDelete(post, index)} className={cn(classes.removePost, classes.selectedPostIcon)} dataTip={t('Remove Post')} />
        {draggable && <Icon name='Draggable' className='w-6 h-6 text-foreground/100 hover:text-foreground' />}
      </div>
    </div>
  )
})

function Suggestion ({ item, onSelect, observeRef }) {
  const { id, title, creator } = item
  return (
    <li key={id || 'blank'} className='m-0 p-0 text-sm' ref={observeRef}>
      <a onClick={event => onSelect(item, event)} className='text-foreground flex flex-row gap-1 items-center p-1 rounded-md hover:bg-selected hover:text-foreground'>
        <RoundImage url={creator?.avatarUrl} className={classes.suggestionAvatar} small />
        <div className={classes.suggestionName}>{title}</div>
      </a>
    </li>
  )
}
