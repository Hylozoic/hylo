import React, { useState, useEffect } from 'react'
import { View, Modal, FlatList, Text, TouchableOpacity, StyleSheet } from 'react-native'

const SimpleItemChooser = ({
  visible,
  onClose,
  fetchItems,
  items: initialItems = [],
  renderItem: CustomItem
}) => {
  const [items, setItems] = useState(initialItems)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (fetchItems) {
      setLoading(true)
      fetchItems()
        .then(fetchedItems => setItems(fetchedItems))
        .finally(() => setLoading(false))
    }
  }, [fetchItems])

  const renderItem = ({ item }) => {
    return CustomItem
      ? <CustomItem item={item} />
      : (
        <TouchableOpacity style={styles.item}>
          <Text>{item.name || 'Unnamed Item'}</Text>
        </TouchableOpacity>
        )
  }

  return (
    <Modal visible={visible} animationType='slide' onRequestClose={onClose}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
        {loading
          ? <Text>Loading...</Text>
          : (
            <FlatList
              data={items}
              renderItem={renderItem}
              keyExtractor={item => item.id || Math.random().toString()}
            />
            )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff'
  },
  closeButton: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#ccc',
    borderRadius: 5,
    alignItems: 'center'
  },
  closeText: {
    fontSize: 16,
    color: '#333'
  },
  item: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  }
})

export default SimpleItemChooser
