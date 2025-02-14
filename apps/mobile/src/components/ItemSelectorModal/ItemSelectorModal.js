import React, { useState, useImperativeHandle, useCallback } from 'react'
import { View, Modal, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ItemSelector from 'components/ItemSelector'
import Icon from 'components/Icon'
import { alabaster, rhino } from 'style/colors'

export const ItemSelectorModal = React.forwardRef((props, ref) => {
  const [visible, setVisible] = useState(false)
  const insets = useSafeAreaInsets()

  const handleOnOpen = useCallback(() => setVisible(true), [])
  const handleOnClose = useCallback(() => {
    props.onClose && props.onClose()
    setVisible(false)
  }, [props.onClose])

  useImperativeHandle(ref, () => ({ show: handleOnOpen, hide: handleOnClose }))

  return (
    <Modal visible={visible} animationType='slide' onRequestClose={handleOnClose} transparent>
      <View style={[styles.container, { marginTop: insets.top, marginBottom: insets.bottom + 60 }]}>
        <Icon name='Ex' style={styles.closeButton} onPress={handleOnClose} />
        <ItemSelector {...props} onClose={handleOnClose} />
      </View>
    </Modal>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: rhino,
    margin: 30,
    borderRadius: 20,
    padding: 10
  },
  closeButton: {
    padding: 3,
    fontSize: 22,
    color: alabaster,
    textAlign: 'left'
  }
})

export default ItemSelectorModal
