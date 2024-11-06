import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Avatar from 'components/Avatar'
import { useInView } from 'react-intersection-observer'

export default forwardRef(({ items: initialItems, command, editor, onLoadMore, ...everything }, ref) => {
  const { t } = useTranslation()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [items, setItems] = useState(initialItems.items)
  const [hasMore, setHasMore] = useState(initialItems.hasMore)
  const [loading, setLoading] = useState(false)

  const { ref: loadMoreRef, inView } = useInView()

  const loadMore = async () => {
    if (!hasMore || loading || !onLoadMore) return
    setLoading(true)
    try {
      const result = await onLoadMore(items.length, initialItems.query)
      if (result?.items) {
        setItems(prev => [...prev, ...result.items])
        setHasMore(result.hasMore)
      }
    } catch (error) {
      console.error('Error loading more items:', error)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (inView) {
      loadMore()
    }
  }, [inView])

  useEffect(() => {
    setItems(initialItems.items || [])
    setHasMore(initialItems.hasMore || false)
  }, [initialItems])

  const selectItem = index => {
    const item = items[index]

    if (item) {
      command(item)
    }
  }

  const upHandler = () => {
    setSelectedIndex((selectedIndex + items.length - 1) % items.length)
    setTimeout(() => {
      const selectedElement = document.querySelector('.suggestion-list-item.is-selected')
      selectedElement?.scrollIntoView({ block: 'center' })
    }, 100)
  }

  const downHandler = () => {
    const newIndex = (selectedIndex + 1) % items.length
    setSelectedIndex(newIndex)
    setTimeout(() => {
      const selectedElement = document.querySelector('.suggestion-list-item.is-selected')
      selectedElement?.scrollIntoView({ block: 'center' })
      if (newIndex === items.length - 1) {
        loadMore()
      }
    }, 100)
  }

  const enterHandler = () => {
    selectItem(selectedIndex)
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        upHandler()
        return true
      }

      if (event.key === 'ArrowDown') {
        downHandler()
        return true
      }

      if (event.key === 'Enter') {
        enterHandler()
        return true
      }

      return false
    }
  }))

  return (
    <div className='suggestion-list'>
      {items && items.length > 0
        ? items.map((item, index) => (
          <button
            className={`suggestion-list-item ${index === selectedIndex ? 'is-selected' : ''}`}
            key={index}
            onClick={() => selectItem(index)}
          >
            {item.avatarUrl && (
              <Avatar avatarUrl={item.avatarUrl} tiny className='suggestion-list-item-avatar' />
            )}
            {item.suggestionLabel}
          </button>
        ))
        : <button className='suggestion-list-item suggestion-list-item-no-result'>{t('No result')}</button>}
      {hasMore && (
        <div ref={loadMoreRef} className='loading-more'>
          {loading && t('Loading...')}
        </div>
      )}
    </div>
  )
})
