import { LOCATION_CHANGE } from 'redux-first-history'
import { pick } from 'lodash/fp'
import rollbar from 'client/rollbar'
import {
  FETCH_FOR_CURRENT_USER,
  FETCH_FOR_GROUP_PENDING,
  LOGOUT_PENDING
} from 'store/constants'

export const MODULE_NAME = 'AuthLayoutRouter'

const TOGGLE_DRAWER = `${MODULE_NAME}/TOGGLE_DRAWER`

const TOGGLE_NAV_MENU = `${MODULE_NAME}/TOGGLE_NAV_MENU`

// Action to set a membership's lastViewedAt value
export const SET_MEMBERSHIP_LAST_VIEWED_AT = `${MODULE_NAME}/SET_MEMBERSHIP_LAST_VIEWED_AT`

export const initialState = {
  isDrawerOpen: false,
  isNavOpen: false
}

export default function reducer (state = initialState, action) {
  if (action.error) return state

  if (action.type === TOGGLE_DRAWER) {
    return { ...state, isDrawerOpen: !state.isDrawerOpen }
  }

  if (action.type === TOGGLE_NAV_MENU) {
    return { ...state, isNavOpen: action.value !== undefined ? action.value : !state.isNavOpen }
  }

  if (action.type === LOCATION_CHANGE) {
    return { ...state, isDrawerOpen: false }
  }

  // Links current user to rollbar config
  if (action.type === FETCH_FOR_CURRENT_USER && action.payload?.data?.me) {
    const { id, name, email } = action.payload.data.me
    rollbar.configure({
      payload: {
        person: {
          id,
          username: name,
          email
        }
      }
    })
  }

  return state
}

export function toggleDrawer () {
  return {
    type: TOGGLE_DRAWER
  }
}

export function toggleNavMenu (value) {
  return {
    type: TOGGLE_NAV_MENU,
    value
  }
}

export function ormSessionReducer (
  { Group, Me, Membership, Person },
  { type, meta, payload }
) {
  switch (type) {
    case LOGOUT_PENDING: {
      Me.first().delete()
      break
    }
    case FETCH_FOR_GROUP_PENDING: {
      const group = Group.safeGet({ slug: meta.slug })
      if (!group) return
      const me = Me.first()
      if (!me) return
      const membership = Membership.safeGet({ group: group.id, person: me.id })
      if (!membership) return
      return membership.update({ newPostCount: 0 })
    }
    case SET_MEMBERSHIP_LAST_VIEWED_AT: {
      const { groupId, personId, lastViewedAt } = meta || {}
      if (!groupId || !personId || !lastViewedAt) return
      const membership = Membership.safeGet({ group: groupId, person: personId })
      if (!membership) return
      membership.update({ lastViewedAt })
      break
    }
    case FETCH_FOR_CURRENT_USER: {
      const me = payload.data?.me
      if (me && !Person.idExists(me.id)) {
        Person.create(pick(['id', 'name', 'avatarUrl'], me))
      }
      break
    }
  }
}

export function setMembershipLastViewedAt (groupId, personId, lastViewedAt) {
  return {
    type: SET_MEMBERSHIP_LAST_VIEWED_AT,
    meta: { groupId, personId, lastViewedAt }
  }
}
