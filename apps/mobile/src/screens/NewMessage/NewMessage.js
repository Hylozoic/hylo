import React, { useCallback, useEffect, useState } from 'react'
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity
} from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigation, useRoute } from '@react-navigation/native'
import { get, isArray, isEmpty } from 'lodash/fp'
import getPeople from 'store/selectors/getPeople'
import scopedFetchPeopleAutocomplete from 'store/actions/scopedFetchPeopleAutocomplete'
import { getRecentContacts } from 'store/selectors/getContactList'
import scopedGetPeopleAutocomplete from 'store/selectors/scopedGetPeopleAutocomplete'
import {
  createMessage as createMessageAction,
  findOrCreateThread as findOrCreateThreadAction
} from './NewMessage.store.js'
import fetchRecentContactsAction from 'store/actions/fetchRecentContacts'
import Avatar from 'components/Avatar'
import Icon from 'components/Icon'
import Button from 'components/Button'
import MessageInput from 'components/MessageInput'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import Loading from 'components/Loading'
import PersonPickerItemRow from 'screens/ItemChooser/PersonPickerItemRow'
import styles from './NewMessage.styles'
import useGraphqlAction from 'hooks/useGraphqlAction'
import gql from 'graphql-tag'
import { useTranslation } from 'react-i18next'

export default function NewMessage (props) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const route = useRoute()
  const navigation = useNavigation()
  const graphqlAction = useGraphqlAction()
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const prompt = route?.params?.prompt
  const recentContacts = useSelector(getRecentContacts)
  const initialParticipantIds = !isArray(route?.params?.participants)
    ? route?.params?.participants?.split(',')
    : route?.params?.participants || []
  const initialParticipantsFromStore = useSelector(
    state => getPeople(state, { personIds: initialParticipantIds })
  ) || []

  const fetchInitialParticipants = () => {
    setLoading(true)

    if (initialParticipantIds) {
      async function asyncFunc () {
        const participantsToFetch = initialParticipantIds?.filter(initialParticipantId =>
          !initialParticipantsFromStore.map(p => p.id).includes(initialParticipantId)
        )
        const fetchedParticipants = await Promise.all(
          participantsToFetch.map(
            async initialParticipantId => {
              const person = await graphqlAction(gql`
                query Participant ($id: ID) {
                  person (id: $id) {
                    id
                    name
                    avatarUrl
                  }
                }
              `, { id: initialParticipantId })

              return person
            }
          )
        )

        setParticipants(
          [
            ...initialParticipantsFromStore,
            ...fetchedParticipants
          ].filter(p => !isEmpty(p))
        )
      }

      asyncFunc()
    }

    dispatch(fetchRecentContactsAction())
    setLoading(false)
  }

  useEffect(fetchInitialParticipants, [])

  const createMessage = async text => {
    const response = await dispatch(findOrCreateThreadAction(participants.map(p => p.id)))
    const messageThreadId = get('payload.data.findOrCreateThread.id', response)
    const { error } = await dispatch(createMessageAction(messageThreadId, text, true))

    if (!error) {
      navigation.replace('Thread', { id: messageThreadId })
    }
  }

  const handleAddParticipant = participant => {
    setParticipants([...participants, participant])
  }

  const handleRemoveParticipant = participant => {
    setParticipants(participants.filter(p => p.id !== participant.id))
  }

  const openParticipantChooser = useCallback(() => {
    const screenTitle = t('Add Participant')
    const chooserProps = {
      screenTitle,
      fetchSearchSuggestions: scopedFetchPeopleAutocomplete,
      getSearchSuggestions: scopedGetPeopleAutocomplete(screenTitle),
      initialItems: participants,
      pickItem: handleAddParticipant,
      ItemRowComponent: PersonPickerItemRow,
      defaultSuggestedItemsLabel: t('Recent Contacts'),
      defaultSuggestedItems: recentContacts
    }
    navigation.navigate('ItemChooser', chooserProps)
  }, [recentContacts, participants])

  if (loading) return <Loading />

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
            text={t('Add Participant')}
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
        placeholder={t('Type your message here')}
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
