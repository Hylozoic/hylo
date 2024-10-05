import React from 'react'
import { Text, TouchableOpacity, View, ScrollView } from 'react-native'
import { isEmpty } from 'lodash/fp'
import Modal from 'react-native-modal'
import Avatar from 'components/Avatar'
import Icon from 'components/Icon'
import styles from './PeopleListModal.styles'

/*

`TopDownModal` or maybe `HyloModal`

To be extracted to it's own world if it proves a useful pattern.

Keep it abstract if it looks like its going to.

The animation direction is entirely configurable and the codified
pattern here would more likely be the close button and general
container styling and swipe-down dismiss behavior.

*/
export function TopDownModal ({
  isVisible,
  toggleModal,
  children,
  style,
  ...forwardedProps
}) {
  return (
    <Modal
      animationIn='slideInDown'
      isVisible={isVisible}
      onBackButtonPress={toggleModal}
      onSwipeComplete={toggleModal}
      style={[styles.modal, style]}
      swipeDirection={['down']}
      transparent
      {...forwardedProps}
    >
      <View style={[styles.container]}>
        <TouchableOpacity onPress={toggleModal}><Icon name='Ex' style={styles.closeIcon} /></TouchableOpacity>
        {children}
      </View>
    </Modal>
  )
}

export default function PeopleListModal ({
  people,
  onPressPerson: providedOnPressPerson,
  isVisible,
  toggleModal,
  children
}) {
  if (isEmpty(people)) return null

  const onPressPerson = (person) => {
    toggleModal()
    providedOnPressPerson(person)
  }

  return (
    <TopDownModal
      isVisible={isVisible}
      propagateSwipe={people.length > 5}
      toggleModal={toggleModal}
    >
      {children}
      <ScrollView contentContainerStyle={styles.modalContent}>
        {people.map(person => (
          <PersonRow person={person} onPress={onPressPerson} key={person.id} />
        ))}
      </ScrollView>
    </TopDownModal>
  )
}

export function PersonRow ({ person, onPress, children }) {
  return (
    <TouchableOpacity
      onPress={() => onPress(person)}
      style={styles.personRow}
    >
      <Avatar hasBorder={false} avatarUrl={person.avatarUrl} style={styles.personAvatar} />
      <Text style={styles.personName}>{person.name}</Text>
      {children}
    </TouchableOpacity>
  )
}
