import { get } from 'lodash/fp'
import {
  FETCH_SITE_BANNERS,
  FETCH_ALL_SITE_BANNERS,
  CREATE_SITE_BANNER,
  UPDATE_SITE_BANNER,
  PUBLISH_SITE_BANNER,
  UNPUBLISH_SITE_BANNER,
  DELETE_SITE_BANNER,
  DISMISS_SITE_BANNER
} from 'store/constants'

const siteBannerFields = `
  id
  text
  type
  actionText
  actionUrl
  publishedAt
  unpublishedAt
  createdAt
  updatedAt
  creator {
    id
    name
    avatarUrl
  }
  dismissedCount
`

export function fetchSiteBanners () {
  return {
    type: FETCH_SITE_BANNERS,
    graphql: {
      query: `
        query {
          siteBanners {
            id
            text
            type
            actionText
            actionUrl
          }
        }
      `,
      variables: {}
    },
    meta: {
      extractQueryResults: {
        getItems: get('payload.data.siteBanners')
      }
    }
  }
}

export function fetchAllSiteBanners () {
  return {
    type: FETCH_ALL_SITE_BANNERS,
    graphql: {
      query: `
        query {
          allSiteBanners {
            ${siteBannerFields}
          }
        }
      `,
      variables: {}
    },
    meta: {
      extractQueryResults: {
        getItems: get('payload.data.allSiteBanners')
      }
    }
  }
}

export function createSiteBanner (data) {
  return {
    type: CREATE_SITE_BANNER,
    graphql: {
      query: `
        mutation ($data: SiteBannerInput) {
          createSiteBanner(data: $data) {
            ${siteBannerFields}
          }
        }
      `,
      variables: { data }
    }
  }
}

export function updateSiteBanner (id, data) {
  return {
    type: UPDATE_SITE_BANNER,
    graphql: {
      query: `
        mutation ($id: ID!, $data: SiteBannerInput) {
          updateSiteBanner(id: $id, data: $data) {
            ${siteBannerFields}
          }
        }
      `,
      variables: { id, data }
    }
  }
}

export function publishSiteBanner (id) {
  return {
    type: PUBLISH_SITE_BANNER,
    graphql: {
      query: `
        mutation ($id: ID!) {
          publishSiteBanner(id: $id) {
            ${siteBannerFields}
          }
        }
      `,
      variables: { id }
    }
  }
}

export function unpublishSiteBanner (id) {
  return {
    type: UNPUBLISH_SITE_BANNER,
    graphql: {
      query: `
        mutation ($id: ID!) {
          unpublishSiteBanner(id: $id) {
            ${siteBannerFields}
          }
        }
      `,
      variables: { id }
    }
  }
}

export function deleteSiteBanner (id) {
  return {
    type: DELETE_SITE_BANNER,
    graphql: {
      query: `
        mutation ($id: ID!) {
          deleteSiteBanner(id: $id)
        }
      `,
      variables: { id }
    }
  }
}

export function dismissSiteBanner (id) {
  return {
    type: DISMISS_SITE_BANNER,
    graphql: {
      query: `
        mutation ($id: ID!) {
          dismissSiteBanner(id: $id)
        }
      `,
      variables: { id }
    }
  }
}
