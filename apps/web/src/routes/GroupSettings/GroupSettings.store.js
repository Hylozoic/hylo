import { get, pick } from 'lodash/fp'

export const MODULE_NAME = 'GroupSettings'

// Must match GroupSettingsInput in schema.graphql. Read-only fields like
// agreementsLastUpdatedAt live on GroupSettings but are not writable.
const GROUP_SETTINGS_INPUT_FIELDS = [
  'allowGroupInvites',
  'askGroupToGroupJoinQuestions',
  'askJoinQuestions',
  'defaultDigestFrequency',
  'hideExtensionData',
  'layout',
  'locationDisplayPrecision',
  'publicMemberDirectory',
  'publishMurmurationsProfile',
  'showSuggestedSkills',
  'showWelcomePage',
  'showPostNoticesInChat'
]

export const DELETE_GROUP = `${MODULE_NAME}/DELETE_GROUP`
export const FETCH_GROUP_SETTINGS = `${MODULE_NAME}/FETCH_GROUP_SETTINGS`
export const REGENERATE_ACCESS_CODE = `${MODULE_NAME}/REGENERATE_ACCESS_CODE`
export const UPDATE_GROUP_SETTINGS = `${MODULE_NAME}/UPDATE_GROUP_SETTINGS`
export const UPDATE_GROUP_SETTINGS_PENDING = UPDATE_GROUP_SETTINGS + '_PENDING'
export const TRANSITION_GROUP_TO_NEW_MENU = 'TRANSITION_GROUP_TO_NEW_MENU'

export function orderFromSort (sortBy) {
  if (sortBy === 'name') return 'asc'
  return 'desc'
}

export function fetchGroupSettings (slug) {
  return {
    type: FETCH_GROUP_SETTINGS,
    graphql: {
      query: `query ($slug: String) {
        group (slug: $slug) {
          id
          acceptedPostTypes
          accessibility
          avatarUrl
          bannerUrl
          description
          geoShape
          location
          locationObject {
            id
            addressNumber
            addressStreet
            bbox {
              lat
              lng
            }
            center {
              lat
              lng
            }
            city
            country
            fullText
            locality
            neighborhood
            region
          }
          invitePath
          name
          purpose
          settings {
            allowGroupInvites
            askGroupToGroupJoinQuestions
            askJoinQuestions
            defaultDigestFrequency
            hideExtensionData
            locationDisplayPrecision
            publicMemberDirectory
            publishMurmurationsProfile
            showSuggestedSkills
            showWelcomePage
            showPostNoticesInChat
            layout
          }
          type
          slug
          visibility
          stripeAccountId
          stripeDashboardUrl
          stripeChargesEnabled
          stripePayoutsEnabled
          stripeDetailsSubmitted
          paywall
          agreements {
            items {
              id
              description
              order
              title
            }
          }
          childGroups (first: 100) {
            items {
              id
              name
              avatarUrl
            }
          }
          groupRelationshipInvitesFrom {
            items {
              id
              toGroup {
                id
                name
                slug
              }
              fromGroup {
                id
              }
              type
              createdBy {
                id
                name
              }
            }
          }
          groupRelationshipInvitesTo {
            items {
              id
              fromGroup {
                id
                name
                slug
              }
              toGroup {
                id
              }
              type
              createdBy {
                id
                name
              }
              questionAnswers {
                id
                question {
                  id
                  text
                }
                answer
              }
            }
          }
          groupRoles {
            items {
              active
              id
              emoji
              name
              description
              type
            }
          }
          groupToGroupJoinQuestions {
            items {
              id
              questionId
              text
            }
          }
          joinQuestions {
            items {
              id
              questionId
              text
            }
          }
          stewards (first: 100) {
            hasMore
            items {
              id
              name
              avatarUrl
            }
          }
          parentGroups (first: 100) {
            items {
              avatarUrl
              id
              name
            }
          }
          prerequisiteGroups {
            items {
              avatarUrl
              id
              name
              slug
            }
          }
          pendingInvitations {
            hasMore
            items {
              id
              email
              name
              userId
              createdAt
              lastSentAt
            }
          }
          suggestedSkills {
            items {
              id
              name
            }
          }
        }
      }`,
      variables: {
        slug
      }
    },
    meta: {
      extractModel: [
        {
          getRoot: get('group'),
          modelName: 'Group',
          append: true
        },
        // XXX: have to do this because i cant figure out how to specify these relationships on the Group model and have them picked up by the ModelExtractor
        {
          getRoot: get('group.groupRelationshipInvitesFrom'),
          modelName: 'GroupRelationshipInvite',
          append: true
        },
        {
          getRoot: get('group.groupRelationshipInvitesTo'),
          modelName: 'GroupRelationshipInvite',
          append: true
        }
      ]
    }
  }
}

export function updateGroupSettings (id, changes) {
  if (changes.prerequisiteGroups) {
    changes.prerequisiteGroupIds = changes.prerequisiteGroups.map(g => g.id)
    delete changes.prerequisiteGroups
  }

  if (changes.settings) {
    changes.settings = pick(GROUP_SETTINGS_INPUT_FIELDS, changes.settings)
  }

  return {
    type: UPDATE_GROUP_SETTINGS,
    graphql: { // TODO: integrate custom views into this query
      query: `mutation ($id: ID, $changes: GroupInput) {
        updateGroupSettings(id: $id, changes: $changes) {
          id
          acceptedPostTypes
          stripeAccountId
          stripeChargesEnabled
          stripePayoutsEnabled
          stripeDetailsSubmitted
          paywall
          settings {
            defaultDigestFrequency
            locationDisplayPrecision
            showSuggestedSkills
            showWelcomePage
            showPostNoticesInChat
            layout
          }
          agreements {
            items {
              id
              description
              order
              title
            }
          }
          groupToGroupJoinQuestions {
            items {
              id
              questionId
              text
            }
          }
          joinQuestions {
            items {
              id
              questionId
              text
            }
          }
          prerequisiteGroups {
            items {
              id
              avatarUrl
              geoShape
              name
              slug
            }
          }
        }
      }`,
      variables: {
        id, changes
      }
    },
    meta: {
      id,
      changes,
      extractModel: 'Group',
      optimistic: true
    }
  }
}

export function regenerateAccessCode (groupId) {
  return {
    type: REGENERATE_ACCESS_CODE,
    graphql: {
      query: `mutation ($groupId: ID) {
        regenerateAccessCode(groupId: $groupId) {
          id
          invitePath
        }
      }`,
      variables: {
        groupId
      }
    },
    meta: {
      extractModel: 'Group'
    }
  }
}

export function deleteGroup (id) {
  return {
    type: DELETE_GROUP,
    graphql: {
      query: `mutation ($id: ID) {
        deleteGroup(id: $id) {
          success
        }
      }`,
      variables: {
        id
      }
    },
    meta: {
      optimistic: true,
      id
    }
  }
}
