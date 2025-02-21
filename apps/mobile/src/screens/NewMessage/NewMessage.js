import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { gql, useClient, useMutation, useQuery } from 'urql'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { isArray, isEmpty } from 'lodash/fp'
import peopleAutocompleteQuery from '@hylo/graphql/queries/peopleAutocompleteQuery'
import findOrCreateThreadMutation from '@hylo/graphql/mutations/findOrCreateThreadMutation'
import createMessageMutation from '@hylo/graphql/mutations/createMessageMutation'
import { isIOS } from 'util/platform'
import confirmDiscardChanges from 'util/confirmDiscardChanges'
import useRouteParams from 'hooks/useRouteParams'
import Avatar from 'components/Avatar'
import Icon from 'components/Icon'
import ItemSelector from 'components/ItemSelector'
import MessageInput from 'components/MessageInput'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import Loading from 'components/Loading'
import { capeCod20, pictonBlue, alabaster, amaranth, rhino80, caribbeanGreen } from 'style/colors'

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
  const messageInputRef = useRef()
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState()
  const { prompt, participants: routeParticipants } = useRouteParams()
  const initialParticipantIds = !isArray(routeParticipants)
    ? routeParticipants?.split(',')
    : routeParticipants || []

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

  useEffect(() => {
    navigation.setOptions({ headerLeftStyle: { color: caribbeanGreen } })
  }, [])

  useEffect(() => {
    const removeBeforeRemove = navigation.addListener('beforeRemove', (e) => {
      if (loading) return null
      e.preventDefault()
      confirmDiscardChanges({
        hasChanges: participants.length > 0 ||
          (messageInputRef.current && messageInputRef.current.getMessageText().length > 0),
        onDiscard: () => navigation.dispatch(e.data.action),
        title: t('Are you sure?'),
        confirmationMessage: t('Your new unsent message will not be saved'),
        t
      })
    })

    return () => {
      removeBeforeRemove()
    }
  }, [loading, participants, navigation, t])

  const handleCreateMessage = async text => {
    setLoading(true)
    const { data: messageThreadData, error: messageThreadError } = await findOrCreateThread({ participantIds: participants.map(p => p.id) })
    if (messageThreadError) {
      setLoading(false)
      console.error('Error creating thread:', messageThreadError)
      return
    }
    const messageThreadId = messageThreadData?.findOrCreateThread?.id
    const { error: createMessageError } = await createMessage({ messageThreadId, text })
    if (createMessageError) {
      setLoading(false)
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
      <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={styles.participants}>
        {participants.length > 0 && participants.map((participant, index) => (
          <Participant
            participant={participant}
            onPress={handleRemoveParticipant}
            key={index}
          />
        ))}
      </ScrollView>
      <ItemSelector
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
        colors={{ text: rhino80, border: alabaster }}
        style={{ paddingHorizontal: 10 }}
        itemsUseQuerySelector={data => data?.people?.items}
      />
      <MessageInput
        style={styles.messageInput}
        value={prompt}
        multiline
        onSubmit={handleCreateMessage}
        placeholder={t('Type your message here')}
        emptyParticipants={emptyParticipantsList}
        ref={messageInputRef}
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
      <TouchableOpacity onPress={() => onPress(participant)}>
        <Icon name='Ex' style={styles.participantRemoveIcon} />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: alabaster,
    position: 'relative',
    flex: 1
  },
  // participants
  addParticipantButtonWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  addParticipantButton: {
    backgroundColor: pictonBlue,
    width: 150,
    fontSize: 14,
    height: 36
  },
  participants: {
    borderTopWidth: isIOS ? 0 : 1,
    borderTopColor: capeCod20,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    padding: 12,
    paddingBottom: 0
  },
  participant: {
    borderWidth: 1,
    borderColor: capeCod20,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    marginRight: 3,
    marginLeft: 3,
    marginBottom: 5,
    paddingLeft: 6,
    paddingRight: 5,
    flexBasis: 'auto'
  },
  participantName: {
    maxWidth: 99,
    fontFamily: 'Circular-Bold'
  },
  personAvatar: {
    marginRight: 10
  },
  participantRemoveIcon: {
    paddingLeft: 5,
    fontSize: 20,
    color: amaranth,
    marginRight: 'auto'
  }
})
