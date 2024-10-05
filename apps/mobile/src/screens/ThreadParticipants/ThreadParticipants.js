import React from 'react'
import { useSelector } from 'react-redux'
import { View, ScrollView, Text, TouchableOpacity } from 'react-native'
import { modalScreenName } from 'hooks/useIsModalScreen'
import { getThread } from '../Thread/Thread.store'
import getCurrentUserId from 'store/selectors/getCurrentUserId'
import Loading from 'components/Loading'
import Avatar from 'components/Avatar'
import { isEmpty } from 'lodash/fp'
import styles from './ThreadParticipants.styles'

export default function ThreadParticipants ({ threadId, navigation }) {
  const currentUserId = useSelector(getCurrentUserId)
  const thread = useSelector(state => getThread(state, { route: { params: { id: threadId } } }))
  const participants = thread && thread.participants.filter(p => p.id !== currentUserId).toRefArray()
  const goToParticipant = id => navigation.navigate(modalScreenName('Member'), { id })

  if (isEmpty(participants)) {
    return (
      <View style={styles.container}>
        <Loading />
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {participants.map(p => (
        <ParticipantRow participant={p} goToParticipant={goToParticipant} key={p.id} />
      ))}
    </ScrollView>
  )
}

export function ParticipantRow ({ participant, goToParticipant }) {
  return (
    <TouchableOpacity
      onPress={() => goToParticipant(participant.id)}
      style={styles.participantRow}
    >
      <Avatar avatarUrl={participant.avatarUrl} style={styles.avatar} />
      <Text style={styles.name}>{participant.name}</Text>
    </TouchableOpacity>
  )
}
