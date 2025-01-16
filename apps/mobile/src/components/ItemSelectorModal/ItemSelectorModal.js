import React, { useEffect, useState, forwardRef, useImperativeHandle, useCallback, useMemo } from 'react'
import { View, Modal, FlatList, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useQuery } from 'urql'
import { isEmpty, isFunction, debounce } from 'lodash/fp'
import getFirstRootField from 'urql-shared/getFirstRootFieldFromData'
import SearchBar from 'components/SearchBar'
import RoundCheckbox from 'components/RoundCheckBox'
import { havelockBlue, rhino80, rhino50, white, caribbeanGreen } from 'style/colors'
import Avatar from 'components/Avatar'

const ItemSelectorModalHeader = ({
  searchTerm,
  headerText,
  setSearchTerm,
  searchPlaceholder,
  autoFocus = false,
  onFocus,
  loading
}) => {
  const { t } = useTranslation()
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
          {/* <TouchableOpacity onPress={clearSearchTerm}>
            <Text style={styles.listHeaderClear}>{t('Clear Search')}</Text>
          </TouchableOpacity> */}
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

export const ItemSelectorModal = forwardRef(({
  items: providedItems,
  defaultItems,
  chosenItems: providedChosenItems,
  onClose,
  onItemPress,
  renderItem: CustomItem,
  // Always ran on items, even on results of fetchItems or itemsUseQueryArgs
  itemsFilter,
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

  const handleOnClose = useCallback(() => {
    setSearchTerm && setSearchTerm()
    onClose && onClose(items.filter(item => item?.chosen))
    setVisible(false)
  }, [setSearchTerm, onClose, setVisible])

  const handleItemPress = useCallback(item => {
    if (onItemPress) {
      onItemPress(item)
    }
    handleOnClose(items)
  }, [onItemPress, handleOnClose])

  const handleToggleChosen = useCallback(toggleItem => {
    if (isChosen(toggleItem)) {
      setChosenItems(prevState => prevState.filter(chosenItem => chosenItem.id !== toggleItem.id))
    } else {
      setChosenItems(prevState => ([...prevState, toggleItem]))
    }
  }, [chosenItems])

  useImperativeHandle(ref, () => ({
    show: () => setVisible(true),
    hide: () => handleOnClose()
  }))

  useEffect(() => {
    isEmpty(items) && !isEmpty(defaultItems) && setItems(defaultItems)
  }, [defaultItems, items])

  useEffect(() => {
    if (visible && fetchItems) {
      (async () => fetchItems({ searchTerm: debouncedSearchTerm }))()
    }
  }, [visible, debouncedSearchTerm])

  useEffect(() => {
    if (visible && !fetching) {
      let filteredItems = providedItems || (itemsUseQueryArgs && itemsUseQuerySelector(data)) || []

      // chosenItems are excluded when not in chooser (multiple selection) mode
      if (!chooser) {
        filteredItems = filteredItems.filter(item => !isChosen(item))
      }

      // filter items if itemsFilter (may need to add chosen: isChosen(item) to callback)
      if (itemsFilter) {
        filteredItems = filteredItems.filter(item => itemsFilter(item, debouncedSearchTerm))
      // shown chosenItems by default when chooser and no itemsFilter or searchTerm is present
      } else if (chooser && !debouncedSearchTerm) {
        filteredItems = chosenItems
      }

      setItems(filteredItems)
    }
  }, [visible, debouncedSearchTerm, providedItems, providedChosenItems, chosenItems, fetching])

  useEffect(() => {
    setDebouncedSearchTerm(searchTerm)
    // Cleanup to prevent memory leaks
    return () => {
      setDebouncedSearchTerm.cancel && setDebouncedSearchTerm.cancel()
    }
  }, [searchTerm])

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
            <FlatList
              data={items}
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
    borderRadius: 5,
    // alignItems: 'center'
  },
  closeText: {
    fontSize: 16,
    color: '#333'
  },

  // Item

  item: {
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd'
},
  itemAvatar: {
    marginRight: 12
  },
  itemName: {
    fontFamily: 'Circular-Bold',
    flex: 1
  },
  checkbox: {
    marginLeft: 'auto',
    width: 50,
    alignItems: 'center',
    justifyContent: 'flex-start'
  },

  // from old ItemChooser

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
