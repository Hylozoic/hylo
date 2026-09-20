import { get } from 'lodash/fp'
import { createSelector as ormCreateSelector } from 'redux-orm'
import orm from 'store/models'
import { GROUP_TYPES } from 'store/models/Group'

export const MODULE_NAME = 'PostEditor'
export const FETCH_LINK_PREVIEW = `${MODULE_NAME}/FETCH_LINK_PREVIEW`
export const REMOVE_LINK_PREVIEW = `${MODULE_NAME}/REMOVE_LINK_PREVIEW`
export const CLEAR_LINK_PREVIEW = `${MODULE_NAME}/CLEAR_LINK_PREVIEW`

// Actions

export function fetchLinkPreview (url) {
  return {
    type: FETCH_LINK_PREVIEW,
    graphql: {
      query: `mutation ($url: String) {
        findOrCreateLinkPreviewByUrl(data: {url: $url}) {
          id
          url
          imageUrl
          title
          description
          status
        }
      }`,
      variables: {
        url
      }
    },
    meta: {
      extractModel: {
        modelName: 'LinkPreview',
        getRoot: get('findOrCreateLinkPreviewByUrl')
      }
    }
  }
}

export async function pollingFetchLinkPreview (dispatch, providedURL) {
  let url = providedURL

  if (providedURL.match(/^\//)) {
    url = `https://hylo.com${providedURL}`
  } else if (!providedURL.match(/^http/)) {
    url = `http://${providedURL}`
  }

  const MAX_RETRIES = 4
  const poll = async (url, retry = 1) => {
    if (retry > MAX_RETRIES) return

    const value = await dispatch(fetchLinkPreview(url))

    if (!value) return

    const linkPreviewFound = value.meta.extractModel.getRoot(value.payload.data)

    if (!linkPreviewFound) {
      setTimeout(() => poll(url, retry + 1), retry * 0.5 * 1000)
    }
  }

  poll(url)
}

export function removeLinkPreview () {
  return { type: REMOVE_LINK_PREVIEW }
}

export function clearLinkPreview () {
  return { type: CLEAR_LINK_PREVIEW }
}

// Selectors

export const getLinkPreview = ormCreateSelector(
  orm,
  state => state[MODULE_NAME],
  ({ LinkPreview }, { linkPreviewId }) =>
    LinkPreview.idExists(linkPreviewId) ? LinkPreview.withId(linkPreviewId).ref : null
)

/**
 * Plain destination record for the PostEditor To field. Reads Group inside the
 * ORM selector so parentId/type updates invalidate the result (unlike mapping
 * `membership.group` in a component after getMyMemberships).
 */
function toDestinationGroup (group, extras = {}) {
  if (!group) return null
  const raw = group.ref || group
  if (!raw.id) return null
  if (raw.status === 'archived') return null
  if (raw.paywall && raw.canAccess === false) return null

  const relatedParentId = group.parentGroup?.id || raw.parentGroup?.id || null
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    type: raw.type || extras.type || null,
    status: raw.status,
    parentId: extras.parentId || raw.parentId || relatedParentId || null,
    icon: raw.icon,
    avatarUrl: raw.avatarUrl,
    acceptedPostTypes: raw.acceptedPostTypes,
    allowInPublic: raw.allowInPublic,
    paywall: raw.paywall,
    canAccess: raw.canAccess
  }
}

/** Merges a destination into the map, filling in missing parentId/type from later copies. */
function addDestinationGroup (byId, group, extras = {}) {
  const next = toDestinationGroup(group, extras)
  if (!next) return
  const key = String(next.id)
  const prev = byId.get(key)
  if (!prev) {
    byId.set(key, next)
    return
  }
  byId.set(key, {
    ...prev,
    ...next,
    parentId: next.parentId || prev.parentId,
    type: next.type || prev.type,
    acceptedPostTypes: next.acceptedPostTypes != null ? next.acceptedPostTypes : prev.acceptedPostTypes
  })
}

/**
 * Groups and spaces the current user can send a post to. Includes every
 * membership destination, plus the current parent group and its menu/off-menu
 * spaces so the To field can list the parent and sibling spaces at the top
 * when composing from inside a space.
 */
export const getPostEditorDestinationGroups = ormCreateSelector(
  orm,
  (state, parentGroupId) => parentGroupId,
  ({ Me, Membership, Group }, parentGroupId) => {
    const me = Me.first()
    const byId = new Map()

    if (me) {
      Membership.filter({ person: me.id }).toModelArray().forEach(membership => {
        addDestinationGroup(byId, membership.group)
      })
    }

    const parent = parentGroupId
      ? (Group.idExists(parentGroupId)
          ? Group.withId(parentGroupId)
          : Group.all().toModelArray().find(g => String(g.id) === String(parentGroupId)))
      : null
    if (parent) {
      addDestinationGroup(byId, parent)
      for (const view of parent.groupViews?.items || []) {
        if (view.type === 'space' && view.linkedGroup) {
          addDestinationGroup(byId, view.linkedGroup, {
            parentId: view.linkedGroup.parentId || parent.id,
            type: view.linkedGroup.type || GROUP_TYPES.space
          })
        }
      }
      for (const space of parent.spaces?.items || []) {
        addDestinationGroup(byId, space, {
          parentId: space.parentId || parent.id,
          type: space.type || GROUP_TYPES.space
        })
      }
    }

    return [...byId.values()].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }
)

// Reducer

export const defaultState = {
  linkPreviewId: null,
  linkPreviewStatus: null
}

export default function reducer (state = defaultState, action) {
  const { error, type, payload, meta } = action

  if (error) return state

  switch (type) {
    case FETCH_LINK_PREVIEW: {
      const linkPreview = meta.extractModel.getRoot(payload.data)

      if (linkPreview && !linkPreview.title) {
        return { ...state, linkPreviewId: null, linkPreviewStatus: 'invalid' }
      }
      return { ...state, linkPreviewId: get('id')(linkPreview), linkPreviewStatus: null }
    }
    case REMOVE_LINK_PREVIEW: {
      return { ...state, linkPreviewId: null, linkPreviewStatus: 'removed' }
    }
    case CLEAR_LINK_PREVIEW: {
      return { ...state, linkPreviewId: null, linkPreviewStatus: 'cleared' }
    }
    default: {
      return state
    }
  }
}
