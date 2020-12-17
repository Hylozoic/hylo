import { get } from 'lodash/fp'
import { FETCH_COMMENTS } from 'components/Comments/Comments.store'
export const FETCH_POST = 'FETCH_POST'

export function getPostFieldsFragment (withComments = true) {
  return `
  id
  title
  details
  type
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
  announcement
  creator {
    id
    name
    avatarUrl
    tagline
  }
  createdAt
  updatedAt
  isPublic
  fulfilledAt
  startTime
  endTime
  myEventResponse
  commenters(first: 3) {
    id
    name
    avatarUrl
  }
  commentersTotal
  commentsTotal
  ${withComments
    ? `comments(first: 10, order: "desc") {
        items {
          id
          text
          creator {
            id
            name
            avatarUrl
          }
          createdAt
        }
        total
        hasMore
      }`
  : ''}
  linkPreview {
    title
    url
    imageUrl
  }
  votesTotal
  myVote
  communities {
    id
    name
    slug
  }
  attachments {
    id
    position
    type
    url
  }
  postMemberships {
    id
    pinned
    community {
      id
    }
  }
  topics {
    id
    name
    postsTotal
    followersTotal
  }
  members {
    items {
      id
      name
      avatarUrl
    }
    total
  }`
}

export default function fetchPost (id, opts = {}) {
  return {
    type: FETCH_POST,
    graphql: {
      query: `query ($id: ID) {
        post(id: $id) {
          ${getPostFieldsFragment(true)}
        }
      }`,
      variables: {
        id
      }
    },
    meta: {
      afterInteractions: true,
      extractModel: 'Post',
      extractQueryResults: {
        getItems: get('payload.data.post.comments'),
        getType: () => FETCH_COMMENTS
      }
    }
  }
}
