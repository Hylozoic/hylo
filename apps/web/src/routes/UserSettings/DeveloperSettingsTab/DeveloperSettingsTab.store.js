/**
 * Developer Settings Store
 *
 * Actions for managing developer mode and OAuth applications
 */

export const MODULE_NAME = 'DeveloperSettings'

export const UPDATE_DEVELOPER_MODE = `${MODULE_NAME}/UPDATE_DEVELOPER_MODE`
export const FETCH_APPLICATIONS = `${MODULE_NAME}/FETCH_APPLICATIONS`
export const CREATE_APPLICATION = `${MODULE_NAME}/CREATE_APPLICATION`
export const UPDATE_APPLICATION = `${MODULE_NAME}/UPDATE_APPLICATION`
export const DELETE_APPLICATION = `${MODULE_NAME}/DELETE_APPLICATION`
export const REGENERATE_CLIENT_SECRET = `${MODULE_NAME}/REGENERATE_CLIENT_SECRET`
export const CREATE_BOT = `${MODULE_NAME}/CREATE_BOT`

/**
 * Enable or disable developer mode
 */
export function updateDeveloperMode (enabled) {
  return {
    type: UPDATE_DEVELOPER_MODE,
    graphql: {
      query: `mutation UpdateDeveloperMode($enabled: Boolean!) {
        updateDeveloperMode(enabled: $enabled) {
          success
        }
      }`,
      variables: { enabled }
    },
    meta: {
      enabled,
      optimistic: true
    }
  }
}

/**
 * Fetch user's applications
 */
export function fetchApplications () {
  return {
    type: FETCH_APPLICATIONS,
    graphql: {
      query: `query FetchApplications {
        me {
          id
          developerModeEnabled
          applications {
            id
            name
            description
            clientId
            redirectUris
            scopes
            hasBot
            bot {
              id
              name
              avatarUrl
            }
            webhookUrl
            webhookEvents
            createdAt
          }
        }
      }`
    }
  }
}

/**
 * Create a new OAuth application
 */
export function createApplication (data) {
  return {
    type: CREATE_APPLICATION,
    graphql: {
      query: `mutation CreateApplication($data: ApplicationInput!) {
        createApplication(data: $data) {
          application {
            id
            name
            description
            clientId
            redirectUris
            scopes
            hasBot
            createdAt
          }
          clientSecret
        }
      }`,
      variables: { data }
    },
    meta: {
      data
    }
  }
}

/**
 * Update an existing application
 */
export function updateApplication (id, changes) {
  return {
    type: UPDATE_APPLICATION,
    graphql: {
      query: `mutation UpdateApplication($id: ID!, $changes: ApplicationInput!) {
        updateApplication(id: $id, changes: $changes) {
          id
          name
          description
          clientId
          redirectUris
          scopes
          hasBot
          createdAt
        }
      }`,
      variables: { id, changes }
    },
    meta: {
      id,
      changes
    }
  }
}

/**
 * Delete an application
 */
export function deleteApplication (id) {
  return {
    type: DELETE_APPLICATION,
    graphql: {
      query: `mutation DeleteApplication($id: ID!) {
        deleteApplication(id: $id) {
          success
        }
      }`,
      variables: { id }
    },
    meta: {
      id,
      optimistic: true
    }
  }
}

/**
 * Regenerate client secret
 */
export function regenerateClientSecret (applicationId) {
  return {
    type: REGENERATE_CLIENT_SECRET,
    graphql: {
      query: `mutation RegenerateClientSecret($applicationId: ID!) {
        regenerateClientSecret(applicationId: $applicationId)
      }`,
      variables: { applicationId }
    },
    meta: {
      applicationId
    }
  }
}

/**
 * Create a bot for an application
 */
export function createBotForApplication (applicationId) {
  return {
    type: CREATE_BOT,
    graphql: {
      query: `mutation CreateBotForApplication($applicationId: ID!) {
        createBotForApplication(applicationId: $applicationId) {
          id
          name
          avatarUrl
        }
      }`,
      variables: { applicationId }
    },
    meta: {
      applicationId
    }
  }
}
