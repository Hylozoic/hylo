import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { View, FlatList, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useQuery } from 'urql'
import { isEmpty, isFunction, debounce } from 'lodash/fp'
import getFirstRootField from '@hylo/urql/getFirstRootFieldFromData'
import Avatar from 'components/Avatar'
import RoundCheckbox from 'components/RoundCheckBox'
import SearchBar from 'components/SearchBar'
import Colors from '../style/theme-colors'

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
        backgroundColor={Colors.selected}
        onValueChange={() => toggleChosen(item)}
      />
    )}
  </TouchableOpacity>
)

export const ItemSelector = ({
  items: providedItems,
  defaultItems,
  chosenItems: providedChosenItems,
  className,
  onItemPress,
  renderItem: CustomItem,
  itemsTransform,
  fetchItems,
  itemsUseQueryArgs: providedItemsUseQueryArgs,
  itemsUseQuerySelector = getFirstRootField,
  searchPlaceholder,
  initialSearchTerm = '',
  chooser = false,
  search = true,
  onClose,
  style = {},
  styles = defaultStyles,
  colors: providedColors = defaultColors
}) => {
  const [items, setItems] = useState(defaultItems)
  const [chosenItems, setChosenItems] = useState(providedChosenItems || [])
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm)
  const [debouncedSearchTerm, providedSetDebouncedSearchTerm] = useState(initialSearchTerm)
  const setDebouncedSearchTerm = useCallback(
    debounce(300, value => providedSetDebouncedSearchTerm(value)),
    []
  )
  const colors = { ...defaultColors, ...providedColors }

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
      let filteredItems = providedItems || (itemsUseQueryArgs && itemsUseQuerySelector(data)) || defaultItems || []
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
        onPress={item => handleItemPress(item)}
        chooser={chooser}
        chosen={isChosen(item)}
        toggleChosen={handleToggleChosen}
        styles={styles}
        colors={colors}
      />
    )
  }, [handleItemPress, isChosen, handleToggleChosen])

  return (
    <View className={className} style={[styles.container, style]}>
      {search && (
        <SearchBar
          style={{
            container: [styles.searchBar, { borderColor: colors.border }],
            searchIcon: { color: colors.border },
            searchInput: { color: colors.text },
            cancelText: { color: colors.text },
            cancelButton: { color: colors.border }
          }}
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder={searchPlaceholder}
          onCancel={() => setSearchTerm()}
        />
      )}
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

export const defaultColors = {
  text: Colors.muted,
  border: Colors.foreground80
}

export const defaultStyles = StyleSheet.create({
  // DefaultItem
  item: {
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1
  },
  itemAvatar: {
    marginRight: 12
  },
  itemName: {
    flex: 1
  },
  // ItemSelector
  container: {
    flex: 1,
    borderRadius: 20
  },
  loading: {
    padding: 15
  },
  searchBar: {
    marginBottom: 10
  }
})

export default ItemSelector
