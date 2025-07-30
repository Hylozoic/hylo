import React, { useState, useImperativeHandle, useCallback } from 'react'
import { View, Modal, StyleSheet, Text, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import ItemSelector, { defaultColors } from 'components/ItemSelector'
import { rhino } from '@hylo/presenters/colors'
import { X } from 'lucide-react-native'

// TODO: Make it close when pressing outside the modal: https://stackoverflow.com/a/52936928
export const ItemSelectorModal = React.forwardRef((props = {}, ref) => {
  const { colors, title } = props
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
      <View
        style={[
          styles.container,
          { marginTop: insets.top, marginBottom: insets.bottom + 60 },
          { backgroundColor: colors?.background || rhino }
        ]}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleOnClose}>
            <X style={[styles.closeButton, { color: colors?.text || defaultColors.text }]} />
          </TouchableOpacity>
          {title && (
            <Text style={[styles.title, { color: colors?.text || defaultColors.text }]}>{title}</Text>
          )}
        </View>
        <ItemSelector {...props} onClose={handleOnClose} />
      </View>
    </Modal>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: 30,
    borderRadius: 20,
    padding: 10
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  closeButton: {
    padding: 12,
    margin: 12
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8
  }
})

export default ItemSelectorModal
