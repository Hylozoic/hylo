import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { View, FlatList, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useQuery } from 'urql'
import { isEmpty, isFunction, debounce } from 'lodash/fp'
import getFirstRootField from '@hylo/urql/getFirstRootFieldFromData'
import Avatar from 'components/Avatar'
import RoundCheckbox from 'components/RoundCheckBox'
import SearchBar from 'components/SearchBar'
import { caribbeanGreen, alabaster, rhino80 } from 'style/colors'

export const DefaultItem = ({ item, onPress, chooser, chosen, toggleChosen, styles = defaultStyles, colors = defaultColors }) => (
  <TouchableOpacity style={[styles.item, { borderBottomColor: colors.border }]} onPress={() => onPress(item)}>
    {item?.avatarUrl && (
      <Avatar style={styles.itemAvatar} avatarUrl={item.avatarUrl} dimension={30} />
    )}
    <Text style={[styles.itemName, { color: colors.text }]}>
      {item?.name || "<no 'name' property found for item>"}
    </Text>
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

export const ItemSelector = ({
  items: providedItems,
  defaultItems,
  chosenItems: providedChosenItems,
  onItemPress,
  renderItem: CustomItem,
  itemsTransform,
  fetchItems,
  itemsUseQueryArgs: providedItemsUseQueryArgs,
  itemsUseQuerySelector = getFirstRootField,
  searchPlaceholder,
  title,
  initialSearchTerm = '',
  chooser = false,
  onClose,
  styles = defaultStyles,
  colors = defaultColors
}) => {
  const [items, setItems] = useState(defaultItems)
  const [chosenItems, setChosenItems] = useState(providedChosenItems || [])
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm)
  const [debouncedSearchTerm, providedSetDebouncedSearchTerm] = useState(initialSearchTerm)

  const setDebouncedSearchTerm = useCallback(
    debounce(300, value => providedSetDebouncedSearchTerm(value)),
    []
  )

  const itemsUseQueryArgs = useMemo(() => (
    !fetchItems && isFunction(providedItemsUseQueryArgs)
      ? providedItemsUseQueryArgs({ searchTerm: debouncedSearchTerm })
      : providedItemsUseQueryArgs
  ), [providedItemsUseQueryArgs, debouncedSearchTerm])

  const [{ data, fetching }] = useQuery({
    query: 'query { __typename }',
    ...(itemsUseQueryArgs || {}),
    pause: !providedItemsUseQueryArgs || providedItems || fetchItems
  })

  const isChosen = useCallback(
    item => chosenItems && chosenItems.find(chosenItem => item.id === chosenItem.id),
    [chosenItems]
  )

  const handleItemPress = useCallback(item => {
    if (onItemPress) onItemPress(item)
    if (!chooser) onClose && onClose(chosenItems)
  }, [onItemPress, onClose, chooser, chosenItems])

  const handleToggleChosen = useCallback(toggleItem => {
    setChosenItems(prevState => (
      isChosen(toggleItem)
        ? prevState.filter(chosenItem => chosenItem.id !== toggleItem.id)
        : [...prevState, toggleItem]
    ))
  }, [chosenItems])

  useEffect(() => {
    setChosenItems(providedChosenItems)
  }, [providedChosenItems])

  useEffect(() => {
    if (!fetching) {
      let filteredItems = providedItems || (itemsUseQueryArgs && itemsUseQuerySelector(data)) || []
      if (!chooser) {
        filteredItems = filteredItems.filter(item => !isChosen(item))
      }
      if (isFunction(itemsTransform)) filteredItems = itemsTransform(filteredItems, debouncedSearchTerm)
      else if (chooser && isEmpty(debouncedSearchTerm)) filteredItems = chosenItems
      setItems(filteredItems)
    }
  }, [debouncedSearchTerm, providedItems, chosenItems, fetching])

  useEffect(() => {
    setDebouncedSearchTerm(searchTerm)
    return () => setDebouncedSearchTerm.cancel && setDebouncedSearchTerm.cancel()
  }, [searchTerm])

  useEffect(() => {
    if (fetchItems) fetchItems({ searchTerm: debouncedSearchTerm })
  }, [debouncedSearchTerm])

  const renderItem = useCallback(({ item }) => {
    const ItemComponent = CustomItem || DefaultItem
    return (
      <ItemComponent
        item={item}
        onPress={() => handleItemPress(item)}
        chooser={chooser}
        chosen={isChosen(item)}
        toggleChosen={handleToggleChosen}
        styles={styles}
        colors={colors}
      />
    )
  }, [handleItemPress, isChosen, handleToggleChosen])

  return (
    <View style={styles.container}>
      <SearchBar
        style={{
          container: [styles.searchBar, { borderColor: colors.border }],
          searchInput: [styles.searchInput, { color: colors.text }]
        }}
        value={searchTerm}
        onChangeText={setSearchTerm}
        placeholder={searchPlaceholder}
        onCancel={() => setSearchTerm()}
      />
      {fetching
        ? (
          <Text style={[styles.loading, { color: colors.text }]}>Loading...</Text>
          )
        : (
          <FlatList data={items} renderItem={renderItem} keyExtractor={item => item.id} />
          )}
    </View>
  )
}

const defaultColors = {
  text: alabaster,
  border: rhino80
}

export const defaultStyles = StyleSheet.create({
  // DefaultItem
  item: {
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: rhino80
  },
  itemAvatar: {
    marginRight: 12
  },
  itemName: {
    color: alabaster,
    flex: 1
  },
  // ItemSelector
  container: {
    flex: 1,
    padding: 10,
    borderRadius: 20
  },
  loading: {
    padding: 15,
    color: alabaster
  },
  searchBar: {
    marginBottom: 5
  },
  searchInput: {
    color: alabaster
  }
})

export default ItemSelector
