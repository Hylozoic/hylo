import React, { useEffect, useState, useImperativeHandle, useCallback, useMemo } from 'react'
import { View, Modal, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useQuery } from 'urql'
import { isEmpty, isFunction, debounce } from 'lodash/fp'
import getFirstRootField from '@hylo/urql/getFirstRootFieldFromData'
import Avatar from 'components/Avatar'
import RoundCheckbox from 'components/RoundCheckBox'
import SearchBar from 'components/SearchBar'
import { havelockBlue, rhino80, rhino50, white, caribbeanGreen, rhino10 } from 'style/colors'

// TODO: URQL! Finish styling this modal component
const ItemSelectorModalHeader = ({
  searchTerm,
  headerText,
  setSearchTerm,
  searchPlaceholder,
  autoFocus = false,
  onFocus,
  loading
}) => {
  const clearSearchTerm = () => setSearchTerm()

  if (!setSearchTerm) return null

  return (
    <View style={styles.listHeader}>
      <SearchBar
        style={styles.searchBar}
        autoFocus={autoFocus}
        onFocus={onFocus}
        value={searchTerm}
        onChangeText={setSearchTerm}
        placeholder={searchPlaceholder}
        onCancel={clearSearchTerm}
        onCancelText='Clear'
        loading={loading}
      />
      {!isEmpty(searchTerm) && (
        <View style={styles.listHeaderStatus}>
          <Text style={styles.listHeaderText}>
            <Text>{headerText}</Text>
          </Text>
        </View>
      )}
    </View>
  )
}

export const DefaultItem = ({ item, onPress, chooser, chosen, toggleChosen }) => {
  return (
    <TouchableOpacity style={styles.item} onPress={() => onPress(item)}>
      {item?.avatarUrl && (
        <Avatar style={styles.itemAvatar} avatarUrl={item.avatarUrl} dimension={30} />
      )}
      <Text style={styles.itemName}>{item?.name || "<no 'name' property found for item>"}</Text>
      {chooser && (
        <RoundCheckbox
          style={styles.checkbox}
          checked={!!chosen || false}
          backgroundColor={caribbeanGreen}
          onValueChange={() => toggleChosen(item)}
        />
      )}
    </TouchableOpacity>
  )
}

export const ItemSelectorModal = React.forwardRef(({
  items: providedItems,
  defaultItems,
  chosenItems: providedChosenItems,
  onClose,
  onItemPress,
  renderItem: CustomItem,
  // Final items transformation (after fetchItems and itemsUseQueryArgs)
  // e.g., (items, searchTerm) => return items
  itemsTransform,
  // For initiating async queries either provide a fetchItems or itemsUseQueryArgs prop.
  // If both are provided itemsUseQueryArgs will be ignored.
  fetchItems,
  itemsUseQueryArgs: providedItemsUseQueryArgs,
  itemsUseQuerySelector = getFirstRootField,
  searchPlaceholder,
  initialSearchTerm,
  // Turn on to have multiple selections
  chooser = false
}, ref) => {
  const [visible, setVisible] = useState(false)

  const [items, setItems] = useState(defaultItems)
  const [chosenItems, setChosenItems] = useState(providedChosenItems || [])
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm)
  const [debouncedSearchTerm, providedSetDebouncedSearchTerm] = useState(initialSearchTerm)
  const setDebouncedSearchTerm = useCallback(debounce(300, (value) => { providedSetDebouncedSearchTerm(value) }), [])

  const itemsUseQueryArgs = useMemo(() => (
    !fetchItems && isFunction(providedItemsUseQueryArgs)
      ? providedItemsUseQueryArgs({ searchTerm: debouncedSearchTerm })
      : providedItemsUseQueryArgs
  ), [providedItemsUseQueryArgs, debouncedSearchTerm])

  const [{ data, fetching }] = useQuery({
    query: 'query { __typename }', // Valid query is required by useQuery, using a dummy fallback
    ...(itemsUseQueryArgs || {}),
    pause: !visible || !providedItemsUseQueryArgs || providedItems || fetchItems
  })

  const isChosen = useCallback(
    item => chosenItems && chosenItems.find(chosenItem => item.id === chosenItem.id),
    [chosenItems]
  )

  const handleOnOpen = useCallback(() => {
    setItems(providedItems)
    setChosenItems(providedChosenItems)
    setSearchTerm(initialSearchTerm)
    providedSetDebouncedSearchTerm(initialSearchTerm)
    setVisible(true)
  }, [providedItems, providedChosenItems, initialSearchTerm])

  const handleOnClose = useCallback(() => {
    setSearchTerm && setSearchTerm()
    onClose && onClose(chosenItems)
    setVisible(false)
  }, [setSearchTerm, onClose, setVisible, items, chosenItems])

  useImperativeHandle(ref, () => ({
    show: () => handleOnOpen(),
    hide: () => handleOnClose()
  }))

  const handleItemPress = useCallback(item => {
    if (onItemPress) {
      onItemPress(item)
    }
    handleOnClose(items)
  }, [onItemPress, handleOnClose])

  const handleToggleChosen = useCallback(toggleItem => {
    setChosenItems(prevState => {
      if (isChosen(toggleItem)) {
        return prevState.filter(chosenItem => chosenItem.id !== toggleItem.id)
      } else {
        return [...prevState, toggleItem]
      }
    })
  }, [chosenItems])

  // 1) Gets items from useQuery data using itemsUseQuerySelector (defaults to getFirstRootField)
  // 2) If not a chooser (multiple selection) then chosenItems serves as an exclude list from results
  // 3) Finally, apply itemsTransform on result of the above if it was provided
  // 4) If no itemsTransform, is a chooser, and no searchTerm, show current chosenItems
  // 5) Resets items to defaultItems when no other items are shown (e.g. empty search result after filters)
  useEffect(() => {
    if (visible && !fetching) {
      let filteredItems = providedItems || (itemsUseQueryArgs && itemsUseQuerySelector(data)) || []

      if (!filteredItems) {
        throw new Error(
          'No items provided or results from query + itemsUseQuerySelector is not null or an array. Items found:', filteredItems
        )
      }

      // chosenItems are excluded when not in chooser (multiple selection) mode
      if (!chooser) {
        filteredItems = filteredItems.filter(item => !isChosen(item))
      }

      // filter items if itemsFilter
      if (isFunction(itemsTransform)) {
        filteredItems = itemsTransform(filteredItems, debouncedSearchTerm)
      // shown chosenItems by default when chooser and no itemsFilter or searchTerm is present
      } else if (chooser && isEmpty(debouncedSearchTerm)) {
        filteredItems = chosenItems
      }

      // Resets items to defaultItems when no other items are shown (e.g. empty search result)
      if (isEmpty(filteredItems) && !isEmpty(defaultItems)) {
        setItems(isFunction(defaultItems))
      } else {
        setItems(filteredItems)
      }
    }
  }, [visible, debouncedSearchTerm, providedItems, providedChosenItems, chosenItems, fetching])

  useEffect(() => {
    setDebouncedSearchTerm(searchTerm)
    // Cleanup to prevent memory leaks
    return () => {
      setDebouncedSearchTerm.cancel && setDebouncedSearchTerm.cancel()
    }
  }, [searchTerm])

  // Runs fetchItems on searches if a fetchItems method was provided
  useEffect(() => {
    if (visible && fetchItems) {
      (async () => fetchItems({ searchTerm: debouncedSearchTerm }))()
    }
  }, [visible, debouncedSearchTerm])

  const renderItem = useCallback(({ item }) => {
    const ItemComponent = CustomItem || DefaultItem
    return (
      <ItemComponent
        item={item}
        onPress={() => handleItemPress(item)}
        chooser={chooser}
        chosen={isChosen(item)}
        toggleChosen={handleToggleChosen}
      />
    )
  }, [handleItemPress, isChosen, handleToggleChosen])

  return (
    <Modal visible={visible} animationType='slide' onRequestClose={handleOnClose}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeButton} onPress={handleOnClose}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
        <ItemSelectorModalHeader
          setSearchTerm={setSearchTerm}
          searchTerm={searchTerm}
          searchPlaceholder={searchPlaceholder}
        />
        {fetching
          ? <Text>Loading...</Text>
          : (
            <FlashList
              data={items}
              estimatedItemSize={55}
              renderItem={renderItem}
              keyExtractor={item => item.id}
            />
            )}
      </View>
    </Modal>
  )
})

const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    flex: 1
  },
  content: {
    flex: 1
  },
  closeButton: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#ccc',
    borderRadius: 5
  },
  closeText: {
    fontSize: 16,
    color: '#333'
  },

  // Default Item
  item: {
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: rhino10
  },
  itemAvatar: {
    marginRight: 12
  },
  itemName: {
    fontFamily: 'Circular-Bold',
    flex: 1
  },

  // From ItemChooser, for reference
  sectionHeader: {
    backgroundColor: 'white',
    paddingHorizontal: 10,
    paddingTop: 10
  },
  sectionHeaderText: {
    color: rhino50,
    fontFamily: 'Circular-Book',
    fontSize: 12
  },
  sectionFooter: {
    marginBottom: 40
  },
  listHeader: {
    backgroundColor: white
  },
  listHeaderStatus: {
    paddingHorizontal: 10,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center'
  },
  listHeaderText: {
    fontWeight: 'bold',
    color: rhino80,
    flex: 1
  },
  listHeaderClear: {
    marginLeft: 'auto',
    fontWeight: 'bold',
    fontSize: 14,
    color: havelockBlue
  },
  itemList: {
    backgroundColor: white,
    marginBottom: 50
  },
  searchBar: {
    margin: 10
  }
})

export default ItemSelectorModal
