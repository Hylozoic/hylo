import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import CheckBox from '@react-native-community/checkbox'
import PropTypes from 'prop-types'

// TODO: Consider adopting ItemSelector to replace this component's use
const MultiSelect = ({ items, selected = [], hideAfter, handleSelect }) => {
  const { t } = useTranslation()
  const [showAll, setShowAll] = useState(false)

  const handleShowMore = () => {
    setShowAll(true)
  }

  const renderItems = () => {
    const itemsToRender = showAll || !hideAfter || items.length <= hideAfter
      ? items
      : items.slice(0, hideAfter)

    return itemsToRender.map((item) => {
      const itemText = item.text || item.title
      const ellipsis = itemText.length > 35 ? '...' : ''

      return (
        <TouchableOpacity
          onPress={() => handleSelect && handleSelect(item.id)}
          key={item.id}
          style={[styles.item, selected.includes(item.id) && styles.selectedItem]}
        >
          <Text style={styles.itemText}>{itemText.slice(0, 35) + ellipsis}</Text>
          {handleSelect && (
            <CheckBox
              boxType='square'
              value={selected.includes(item.id)}
            />
          )}
        </TouchableOpacity>
      )
    })
  }

  return (
    <View style={styles.multiSelect}>
      {renderItems()}
      {hideAfter && items.length > hideAfter && !showAll && (
        <TouchableOpacity style={styles.showMore} onPress={handleShowMore}>
          <Text style={styles.showMoreText}>{t('Show more')}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

MultiSelect.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    text: PropTypes.string,
    title: PropTypes.string
  })).isRequired,
  selected: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number])),
  hideAfter: PropTypes.number,
  handleSelect: PropTypes.func
}

const styles = StyleSheet.create({
  multiSelect: {},
  item: {
    borderWidth: 1,
    borderColor: '#ccc',
    marginVertical: 5,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'hidden',
    flex: 1
  },
  itemText: {
    fontSize: 14
  },
  selectedItem: {
    backgroundColor: '#f0f0f0'
  },
  showMore: {
    alignItems: 'center',
    borderTopWidth: 2,
    borderTopColor: '#ccc',
    borderStyle: 'dashed'
  },
  showMoreText: {
    color: '#1abc9c'
  }
})

export default MultiSelect
