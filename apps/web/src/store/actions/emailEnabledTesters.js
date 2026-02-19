import { get } from 'lodash/fp'
import { FETCH_EMAIL_ENABLED_TESTERS, ADD_EMAIL_ENABLED_TESTER, REMOVE_EMAIL_ENABLED_TESTER } from 'store/constants'

const emailEnabledTestersQuery = `
  query {
    emailEnabledTesters {
      id
      userId
      user {
        id
        name
        avatarUrl
      }
      createdAt
      updatedAt
    }
  }
`

export function fetchEmailEnabledTesters () {
  return {
    type: FETCH_EMAIL_ENABLED_TESTERS,
    graphql: {
      query: emailEnabledTestersQuery,
      variables: {}
    },
    meta: {
      extractModel: 'EmailEnabledTester',
      extractQueryResults: {
        getItems: get('payload.data.emailEnabledTesters')
      }
    }
  }
}

export function addEmailEnabledTester (userId) {
  return {
    type: ADD_EMAIL_ENABLED_TESTER,
    graphql: {
      query: `
        mutation ($userId: ID!) {
          addEmailEnabledTester(userId: $userId) {
            id
            userId
            user {
              id
              name
              avatarUrl
            }
            createdAt
            updatedAt
          }
        }
      `,
      variables: { userId }
    },
    meta: {
      extractModel: [
        {
          getRoot: get('addEmailEnabledTester'),
          modelName: 'EmailEnabledTester'
        }
      ],
      then: () => fetchEmailEnabledTesters()
    }
  }
}

export function removeEmailEnabledTester (userId) {
  return {
    type: REMOVE_EMAIL_ENABLED_TESTER,
    graphql: {
      query: `
        mutation ($userId: ID!) {
          removeEmailEnabledTester(userId: $userId)
        }
      `,
      variables: { userId }
    },
    meta: {
      then: () => fetchEmailEnabledTesters()
    }
  }
}

