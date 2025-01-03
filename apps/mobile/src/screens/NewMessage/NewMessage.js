import React, { useCallback, useEffect, useState } from 'react'
import { View, ScrollView, Text, TouchableOpacity } from 'react-native'
import { useSelector } from 'react-redux'
import { gql, useClient, useMutation, useQuery } from 'urql'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { isArray } from 'lodash/fp'
import useRouteParams from 'hooks/useRouteParams'
import scopedFetchPeopleAutocomplete from 'store/actions/scopedFetchPeopleAutocomplete'
import { getRecentContacts } from 'store/selectors/getContactList'
import findOrCreateThreadMutation from 'graphql/mutations/findOrCreateThreadMutation'
import createMessageMutation from 'graphql/mutations/createMessageMutation'
import scopedGetPeopleAutocomplete from 'store/selectors/scopedGetPeopleAutocomplete'
import Avatar from 'components/Avatar'
import Icon from 'components/Icon'
import Button from 'components/Button'
import MessageInput from 'components/MessageInput'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import Loading from 'components/Loading'
import PersonPickerItemRow from 'screens/ItemChooser/PersonPickerItemRow'
import styles from './NewMessage.styles'

export const recentContactsQuery = gql`
  query RecentContactsQuery ($first: Int = 20) {
    connections (first: $first) {
      items {
        id
        person {
          id
          name
          avatarUrl
          memberships (first: 1) {
            id
            group {
              id
              name
            }
          }
        }
        type
        updatedAt
      }
    }
  }
`

export const participantQuery = gql`
  query ParticipantQuery ($id: ID!) {
    person (id: $id) {
      id
      name
      avatarUrl
    }
  }
`

export default function NewMessage (props) {
  const navigation = useNavigation()
  const { t } = useTranslation()
  const client = useClient()
  const [, fetchRecentContacts] = useQuery({ query: recentContactsQuery })
  const [, findOrCreateThread] = useMutation(findOrCreateThreadMutation)
  const [, createMessage] = useMutation(createMessageMutation)
  const { prompt, participants: routeParticipants } = useRouteParams()

  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const recentContacts = useSelector(getRecentContacts)
  const initialParticipantIds = !isArray(routeParticipants)
    ? routeParticipants?.split(',')
    : routeParticipants || []

  console.log('!!! initialParticipantsIds', initialParticipantIds)
  // useEffect(() => {
  //   setLoading(true)

  //   async function fetchParticipants () {
  //     try {
  //       const fetchedParticipants = await Promise.all(
  //         initialParticipantIds.map(async id => {
  //           const result = await client.query(participantQuery, { id }).toPromise()

  //           return result.data?.person || null
  //         })
  //       )

  //       setParticipants(fetchedParticipants.filter(p => p))
  //     } catch (error) {
  //       console.error('Error fetching participants:', error)
  //     } finally {
  //       setLoading(false)
  //     }
  //   }

  //   if (initialParticipantIds) {
  //     fetchParticipants()
  //   } else {
  //     setLoading(false)
  //   }
  // }, [initialParticipantIds, client])

  // fetchRecentContacts()

  const handleCreateMessage = async text => {
    const { data: messageThreadData, error: messageThreadError } = await findOrCreateThread({ participantIds: participants.map(p => p.id) })

    if (messageThreadError) {
      console.error('Error creating thread:', messageThreadError)
      return
    }

    const messageThreadId = messageThreadData?.findOrCreateThread?.id

    const { error: createMessageError } = await createMessage({ messageThreadId, text })

    if (createMessageError) {
      console.error('Error creating message:', createMessageError)
      return
    }

    navigation.replace('Thread', { id: messageThreadId })
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
        onSubmit={handleCreateMessage}
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
