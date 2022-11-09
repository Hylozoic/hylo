import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity
} from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigation, useRoute } from '@react-navigation/native'
import { get, isArray } from 'lodash/fp'
import getPeople from 'store/selectors/getPeople'
import isPendingFor from 'store/selectors/isPendingFor'
import scopedFetchPeopleAutocomplete from 'store/actions/scopedFetchPeopleAutocomplete'
import { getRecentContacts } from 'store/selectors/getContactList'
import scopedGetPeopleAutocomplete from 'store/selectors/scopedGetPeopleAutocomplete'
import {
  createMessage as createMessageAction,
  findOrCreateThread as findOrCreateThreadAction
} from './NewMessage.store.js'
import fetchPersonAction from 'store/actions/fetchPerson'
import fetchRecentContactsAction from 'store/actions/fetchRecentContacts'
import Avatar from 'components/Avatar'
import Icon from 'components/Icon'
import Button from 'components/Button'
import MessageInput from 'components/MessageInput'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import Loading from 'components/Loading'
import PersonPickerItemRow from 'screens/ItemChooser/PersonPickerItemRow'
import styles from './NewMessage.styles'

export default function NewMessage () {
  const dispatch = useDispatch()
  const route = useRoute()
  const navigation = useNavigation()
  const [participants, updateParticipants] = useState([])
  const pending = useSelector(state => isPendingFor([
    fetchRecentContactsAction,
    fetchPersonAction,
    findOrCreateThreadAction,
    createMessageAction
  ], state))
  const prompt = route?.params?.prompt
  const recentContacts = useSelector(getRecentContacts)
  const initialParticipantIds = !isArray(route?.params?.participants)
    ? route?.params?.participants?.split(',')
    : route?.params?.participants || []
  const initialParticipants = useSelector(state => getPeople(state, { personIds: initialParticipantIds }))
  const loadedInitialParticipantIds = initialParticipants?.map(p => p.id)

  useEffect(() => {
    if (initialParticipants) updateParticipants(initialParticipants)

    dispatch(fetchRecentContactsAction())
    initialParticipantIds?.forEach(initialParticipantId => {
      if (!loadedInitialParticipantIds?.includes(initialParticipantId)) {
        dispatch(fetchPersonAction(initialParticipantId))
      }
    })
  }, [])

  const createMessage = async text => {
    const response = await dispatch(findOrCreateThreadAction(participants.map(p => p.id)))
    const messageThreadId = get('payload.data.findOrCreateThread.id', response)
    const { error } = await dispatch(createMessageAction(messageThreadId, text, true))

    if (!error) {
      navigation.navigate('Thread', { id: messageThreadId })
    }
  }

  const addParticipant = participant => {
    updateParticipants([...participants, participant])
  }

  const handleRemoveParticipant = participant => {
    updateParticipants(participants.filter(p => p.id !== participant.id))
  }

  const openParticipantChooser = useCallback(() => {
    const screenTitle = 'Add Participant'
    const chooserProps = {
      screenTitle,
      fetchSearchSuggestions: scopedFetchPeopleAutocomplete,
      getSearchSuggestions: scopedGetPeopleAutocomplete(screenTitle),
      initialItems: participants,
      pickItem: addParticipant,
      ItemRowComponent: PersonPickerItemRow,
      defaultSuggestedItemsLabel: 'Recent Contacts',
      defaultSuggestedItems: recentContacts
    }
    navigation.navigate('ItemChooser', chooserProps)
  }, [recentContacts, participants])

  if (pending) return <Loading />

  const emptyParticipantsList = participants.length === 0

  return (
    <KeyboardFriendlyView style={styles.container}>
      <ScrollView>
        <TouchableOpacity onPress={openParticipantChooser} style={styles.participants}>
          {participants.map((participant, index) =>
            <Participant
              participant={participant}
              onPress={handleRemoveParticipant}
              key={index}
            />)}
        </TouchableOpacity>
        <View style={styles.addParticipantButtonWrapper}>
          <Button
            text='Add Participant'
            style={styles.addParticipantButton}
            onPress={() => openParticipantChooser()}
          />
        </View>
      </ScrollView>
      <MessageInput
        style={styles.messageInput}
        value={prompt}
        multiline
        onSubmit={createMessage}
        placeholder='Type your message here'
        emptyParticipants={emptyParticipantsList}
      />
    </KeyboardFriendlyView>
  )
}

export function Participant ({ participant, onPress }) {
  return (
    <View style={[styles.participant]}>
      {participant?.avatarUrl && (
        <Avatar avatarUrl={participant.avatarUrl} style={styles.personAvatar} dimension={24} />
      )}
      <Text numberOfLines={1} ellipsizeMode='tail' style={styles.participantName}>{participant.name}</Text>
      <TouchableOpacity onPress={() => { onPress(participant) }}>
        <Icon name='Ex' style={styles.participantRemoveIcon} />
      </TouchableOpacity>
    </View>
  )
}
