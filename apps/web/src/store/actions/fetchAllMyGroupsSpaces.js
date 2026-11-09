import { get } from 'lodash/fp'
import { FETCH_ALL_MY_GROUPS_SPACES } from 'store/constants'

/**
 * Loads every membership group (including spaces) with the fields the PostEditor
 * To field needs: parentId, type, acceptedPostTypes, icon. Ensures spaces from
 * all groups are available, not only those already hydrated by the current
 * group's menu fetch.
 */
export default function fetchAllMyGroupsSpaces () {
  return {
    type: FETCH_ALL_MY_GROUPS_SPACES,
    graphql: {
      query: `
        query FetchAllMyGroupsSpaces {
          me {
            memberships {
              id
              group {
                id
                name
                slug
                type
                status
                parentId
                icon
                avatarUrl
                acceptedPostTypes
                allowInPublic
              }
            }
          }
        }
      `
    },
    meta: {
      extractModel: [
        {
          getRoot: get('me'),
          modelName: 'Me'
        }
      ]
    }
  }
}
