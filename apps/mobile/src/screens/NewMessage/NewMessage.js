import React, { useEffect, useRef, useState } from 'react'
import { View, ScrollView, Text, TouchableOpacity } from 'react-native'
import { gql, useClient, useMutation, useQuery } from 'urql'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { isArray, isEmpty } from 'lodash/fp'
import useRouteParams from 'hooks/useRouteParams'
import peopleAutocompleteQuery from '@hylo/graphql/queries/peopleAutocompleteQuery'
import findOrCreateThreadMutation from '@hylo/graphql/mutations/findOrCreateThreadMutation'
import createMessageMutation from '@hylo/graphql/mutations/createMessageMutation'
import Avatar from 'components/Avatar'
import Icon from 'components/Icon'
import ItemSelectorModal from 'components/ItemSelectorModal'
import Button from 'components/Button'
import MessageInput from 'components/MessageInput'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import Loading from 'components/Loading'
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

const useParticipantsQuery = (participantIds = []) => {
  const client = useClient()
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState()
  const [participants, setParticipants] = useState()

  useEffect(() => {
    if (!participantIds) return

    const fetchData = async () => {
      try {
        const fetchedParticipants = await Promise.all(
          participantIds.map(async id => {
            const result = await client.query(participantQuery, { id }).toPromise()
            return result.data?.person || null
          })
        )
        setParticipants(fetchedParticipants.filter(Boolean))
      } catch (e) {
        setError(e)
      } finally {
        setFetching(false)
      }
    }

    setFetching(true)
    fetchData()
  }, [participantIds?.join(',')])

  return [{ participants, fetching, error }]
}

export default function NewMessage () {
  const navigation = useNavigation()
  const { t } = useTranslation()
  const { prompt, participants: routeParticipants } = useRouteParams()
  const initialParticipantIds = !isArray(routeParticipants)
    ? routeParticipants?.split(',')
    : routeParticipants || []

  const participantsSelectorRef = useRef(null)
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState()

  const [, findOrCreateThread] = useMutation(findOrCreateThreadMutation)
  const [, createMessage] = useMutation(createMessageMutation)
  const [{ participants: initialParticipants, fetching: participantsFetching }] = useParticipantsQuery(initialParticipantIds)
  const [{ data: recentContactsData, fetching: recentContactsFetching }] = useQuery({
    query: recentContactsQuery,
    pause: initialParticipantIds
  })
  const recentContacts = recentContactsData?.connections?.items &&
    recentContactsData?.connections?.items.map(item => item.person)

  useEffect(() => {
    if (initialParticipants) {
      setParticipants(initialParticipants)
    }
  }, [initialParticipants])

  useEffect(() => {
    setLoading(participantsFetching || recentContactsFetching)
  }, [participantsFetching, recentContactsFetching])

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

  const handleAddParticipant = participant => setParticipants([...participants, participant])
  const handleRemoveParticipant = participant => setParticipants(participants.filter(p => p.id !== participant.id))

  if (loading) return <Loading />

  const emptyParticipantsList = participants.length === 0

  return (
    <KeyboardFriendlyView style={styles.container}>
      <ScrollView>
        <ItemSelectorModal
          ref={participantsSelectorRef}
          title={t('Add Participant')}
          searchPlaceholder={t('Search by name')}
          defaultItems={recentContacts}
          chosenItems={participants}
          onItemPress={handleAddParticipant}
          itemsUseQueryArgs={({ searchTerm }) => {
            // Don't query if no searchTerm so defaultItems will show
            return !isEmpty(searchTerm) && {
              query: peopleAutocompleteQuery,
              variables: { autocomplete: searchTerm }
            }
          }}
          itemsUseQuerySelector={data => data?.people?.items}
        />
        <TouchableOpacity onPress={() => participantsSelectorRef.current.show()} style={styles.participants}>
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
            onPress={() => participantsSelectorRef.current.show()}
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
