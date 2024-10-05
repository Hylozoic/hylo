import { createSelector } from 'reselect'
import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'
import { get, pick, uniqueId } from 'lodash/fp'
import { TextHelpers, AnalyticsEvents } from 'hylo-shared'
import CreateMessageMutation from 'graphql/mutations/CreateMessageMutation.graphql'
import MessageThreadMessagesQuery from 'graphql/queries/MessageThreadMessagesQuery.graphql'
import { makeGetQueryResults } from 'store/reducers/queryResults'

export const BATCH_MINUTES = 5
export const CREATE_MESSAGE = 'Thread/CREATE_MESSAGE'
export const CREATE_MESSAGE_PENDING = `${CREATE_MESSAGE}_PENDING`
export const FETCH_MESSAGES = 'Thread/FETCH_MESSAGES'
export const UPDATE_THREAD_READ_TIME = 'Thread/UPDATE_THREAD_READ_TIME'
export const UPDATE_THREAD_READ_TIME_PENDING = `${UPDATE_THREAD_READ_TIME}_PENDING`

const MESSAGE_PAGE_SIZE = 20

export function fetchMessages (id, opts = {}) {
  const variables = { id, messagePageSize: MESSAGE_PAGE_SIZE }

  if (opts.cursor) variables.cursor = opts.cursor

  return {
    type: FETCH_MESSAGES,
    graphql: {
      query: MessageThreadMessagesQuery,
      variables
    },
    meta: {
      afterInteractions: true,
      extractModel: 'MessageThread',
      extractQueryResults: {
        getItems: get('payload.data.messageThread.messages')
      },
      reset: opts.reset,
      id
    }
  }
}

export function createMessage (messageThreadId, messageText, forNewThread) {
  return {
    type: CREATE_MESSAGE,
    graphql: {
      query: CreateMessageMutation,
      variables: {
        messageThreadId,
        optimistic: true,
        text: messageText
      }
    },
    meta: {
      optimistic: true,
      extractModel: 'Message',
      tempId: uniqueId(`messageThread${messageThreadId}_`),
      messageThreadId,
      messageText,
      forNewThread,
      analytics: AnalyticsEvents.DIRECT_MESSAGE_SENT
    }
  }
}

export function updateThreadReadTime (id) {
  return {
    type: UPDATE_THREAD_READ_TIME,
    payload: { api: { path: `/noo/post/${id}/update-last-read`, method: 'POST' } },
    meta: { id }
  }
}

export function isWithinBatchLimit (d1, d2) {
  const elapsed = (new Date(d1) - new Date(d2)) / 60000
  return elapsed <= BATCH_MINUTES
}

export const getThread = ormCreateSelector(
  orm,
  (_, { route }) => route.params.id,
  (session, id) => session?.MessageThread.safeWithId(id)
)

export function refineMessage ({ id, createdAt, creator, text }, i, messages) {
  const creatorFields = pick(['id', 'name', 'avatarUrl'], creator.ref)

  // This might seem counter-intuitive, because the list is reversed. These
  // values handle compact display of consecutive messages by the same creator
  // when received in MessageCard.
  const next = i > 0 && i < messages.length ? messages[i - 1] : null
  const prev = i > 0 && i < messages.length - 1 ? messages[i + 1] : null
  const suppressCreator = prev &&
    creator.id === prev.creator.id &&
    isWithinBatchLimit(createdAt, prev.createdAt)
  const suppressDate = next &&
    creator.id === next.creator.id &&
    isWithinBatchLimit(next.createdAt, createdAt)

  return {
    id,
    createdAt: TextHelpers.humanDate(createdAt),
    creator: creatorFields,
    text,
    suppressCreator,
    suppressDate
  }
}

export const getAndPresentMessages = ormCreateSelector(
  orm,
  (_, { route }) => route.params.id,
  (session, messageThreadId) => {
    const messageThread = session.MessageThread.withId(messageThreadId)
    if (!messageThread) return []
    return messageThread
      .messages
      .orderBy(c => Number(c.id), 'desc')
      .toModelArray()
      .map(refineMessage)
  }
)

const getMessageResults = makeGetQueryResults(FETCH_MESSAGES)

export const getHasMoreMessages = createSelector(
  getMessageResults,
  get('hasMore')
)
