import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { debounce } from 'lodash/fp'
import { Search, X } from 'lucide-react'
import RoundImage from 'components/RoundImage'
import Loading from 'components/Loading'

/**
 * ItemSelector Component
 *
 * A flexible selector component for searching and selecting items (users, groups, etc).
 * Inspired by the mobile ItemSelector but adapted for web with Tailwind styling.
 *
 * @param {Object} props
 * @param {Array} props.items - Pre-loaded items to display (optional)
 * @param {Array} props.defaultItems - Items to show when no search term
 * @param {Object} props.selectedItem - Currently selected item (for single select)
 * @param {Function} props.onSelect - Callback when an item is selected
 * @param {Function} props.fetchItems - Redux action creator for fetching items
 * @param {Function} props.itemsSelector - Redux selector to get items from state
 * @param {String} props.searchPlaceholder - Placeholder text for search input
 * @param {Boolean} props.loading - External loading state
 * @param {String} props.emptyMessage - Message to show when no items found
 * @param {Function} props.renderItem - Custom item renderer (optional)
 * @param {Function} props.filterItems - Function to filter items (optional)
 */
export default function ItemSelector ({
  items: providedItems,
  defaultItems = [],
  selectedItem = null,
  onSelect,
  fetchItems,
  itemsSelector,
  searchPlaceholder,
  loading: externalLoading = false,
  emptyMessage,
  renderItem: CustomItemRenderer,
  filterItems
}) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const inputRef = useRef(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [internalLoading, setInternalLoading] = useState(false)
  const [fetchedItems, setFetchedItems] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const loading = externalLoading || internalLoading

  // Debounced fetch function
  const debouncedFetch = useMemo(() =>
    debounce(300, async (term) => {
      if (fetchItems && term && term.length >= 2) {
        setInternalLoading(true)
        try {
          const result = await dispatch(fetchItems({ autocomplete: term }))
          // Extract items from the result based on the expected structure
          const items = result?.payload?.data?.people?.items || []
          setFetchedItems(items)
        } catch (error) {
          console.error('Error fetching items:', error)
          setFetchedItems([])
        } finally {
          setInternalLoading(false)
        }
      } else {
        setFetchedItems([])
      }
    }),
  [dispatch, fetchItems]
  )

  // Trigger search when search term changes
  useEffect(() => {
    if (searchTerm.length >= 2) {
      debouncedFetch(searchTerm)
      setShowDropdown(true)
    } else {
      setFetchedItems([])
      if (searchTerm.length === 0) {
        setShowDropdown(false)
      }
    }
    return () => debouncedFetch.cancel && debouncedFetch.cancel()
  }, [searchTerm, debouncedFetch])

  // Determine which items to display
  const displayItems = useMemo(() => {
    let items = providedItems || fetchedItems || defaultItems

    // Apply custom filter if provided
    if (filterItems && typeof filterItems === 'function') {
      items = filterItems(items, searchTerm)
    }

    // Filter out already selected item
    if (selectedItem) {
      items = items.filter(item => item.id !== selectedItem.id)
    }

    return items
  }, [providedItems, fetchedItems, defaultItems, filterItems, searchTerm, selectedItem])

  /**
   * Handles item selection
   */
  const handleSelect = useCallback((item) => {
    if (onSelect) {
      onSelect(item)
    }
    setSearchTerm('')
    setShowDropdown(false)
    setSelectedIndex(-1)
  }, [onSelect])

  /**
   * Clears the current selection
   */
  const handleClear = useCallback(() => {
    if (onSelect) {
      onSelect(null)
    }
    setSearchTerm('')
    inputRef.current?.focus()
  }, [onSelect])

  /**
   * Handles keyboard navigation
   */
  const handleKeyDown = useCallback((e) => {
    if (!showDropdown || displayItems.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, displayItems.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && displayItems[selectedIndex]) {
          handleSelect(displayItems[selectedIndex])
        }
        break
      case 'Escape':
        setShowDropdown(false)
        setSelectedIndex(-1)
        break
      default:
        break
    }
  }, [showDropdown, displayItems, selectedIndex, handleSelect])

  /**
   * Default item renderer
   */
  const DefaultItemRenderer = useCallback(({ item, isSelected, onSelect: handleItemSelect }) => (
    <button
      type='button'
      onClick={() => handleItemSelect(item)}
      className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
        isSelected ? 'bg-accent/20' : 'hover:bg-foreground/5'
      }`}
    >
      {item.avatarUrl && (
        <RoundImage url={item.avatarUrl} className='w-8 h-8' small />
      )}
      <div className='flex-1 min-w-0'>
        <div className='font-medium text-foreground truncate'>{item.name}</div>
        {item.memberships && item.memberships.length > 0 && (
          <div className='text-xs text-foreground/60 truncate'>
            {item.memberships.map(m => m.group?.name).filter(Boolean).join(', ')}
          </div>
        )}
      </div>
    </button>
  ), [])

  const ItemRenderer = CustomItemRenderer || DefaultItemRenderer

  return (
    <div className='relative'>
      {/* Selected Item Display */}
      {selectedItem
        ? (
          <div className='flex items-center gap-2 p-2 bg-input border border-foreground/20 rounded-md'>
            {selectedItem.avatarUrl && (
              <RoundImage url={selectedItem.avatarUrl} className='w-8 h-8' small />
            )}
            <span className='flex-1 text-foreground'>{selectedItem.name}</span>
            <button
              type='button'
              onClick={handleClear}
              className='p-1 hover:bg-foreground/10 rounded transition-colors'
            >
              <X className='w-4 h-4 text-foreground/60' />
            </button>
          </div>
          )
        : (
          <>
            {/* Search Input */}
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/50' />
              <input
                ref={inputRef}
                type='text'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => searchTerm.length >= 2 && setShowDropdown(true)}
                placeholder={searchPlaceholder || t('Search...')}
                className='w-full pl-10 pr-4 py-2 bg-input border border-foreground/20 rounded-md text-foreground placeholder:text-foreground/50 focus:border-focus focus:outline-none'
              />
              {loading && (
                <div className='absolute right-3 top-1/2 -translate-y-1/2'>
                  <Loading type='inline' size='small' />
                </div>
              )}
            </div>

            {/* Dropdown */}
            {showDropdown && (
              <div className='absolute z-50 w-full mt-1 bg-card border border-foreground/20 rounded-md shadow-lg max-h-60 overflow-y-auto'>
                {loading && displayItems.length === 0 && (
                  <div className='p-4 text-center text-foreground/60'>
                    {t('Searching...')}
                  </div>
                )}
                {!loading && displayItems.length === 0 && searchTerm.length >= 2 && (
                  <div className='p-4 text-center text-foreground/60'>
                    {emptyMessage || t('No results found')}
                  </div>
                )}
                {!loading && searchTerm.length < 2 && (
                  <div className='p-4 text-center text-foreground/60'>
                    {t('Type at least 2 characters to search')}
                  </div>
                )}
                {displayItems.map((item, index) => (
                  <ItemRenderer
                    key={item.id}
                    item={item}
                    isSelected={index === selectedIndex}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            )}
          </>
          )}
    </div>
  )
}
