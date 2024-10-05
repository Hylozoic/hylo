import React from 'react'
import { TouchableOpacity, View } from 'react-native'
import Modal from 'react-native-modal'
import Icon from 'components/Icon'
import { rhino, rhino30 } from 'style/colors'

export default function ScrollableModal ({
  isVisible,
  toggleModal,
  children,
  style,
  containerStyle,
  ...forwardedProps
}) {
  return (
    <Modal
      animationIn='slideInDown'
      isVisible={isVisible}
      onBackButtonPress={toggleModal}
      style={[styles.modal, style]}
      transparent
      propagateSwipe
      {...forwardedProps}
    >
      <View style={[styles.container, containerStyle]}>
        <TouchableOpacity onPress={toggleModal}><Icon name='Ex' style={styles.closeIcon} /></TouchableOpacity>
        {children}
      </View>
    </Modal>
  )
}

const styles = {
  container: {
    height: '60%',
    // width: '80%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    alignItems: 'flex-start',
    justifyContent: 'center',
    shadowColor: rhino,
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  closeIcon: {
    fontSize: 24,
    color: rhino30
  }
}
