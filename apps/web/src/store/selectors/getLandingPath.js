import { createSelector as ormCreateSelector } from 'redux-orm'
import { myHomeLandingUrl, personUrl } from '@hylo/navigation'
import orm from 'store/models'

/** The current user's memberships (spaces included). */
function myMemberships ({ Me, Membership }) {
  const me = Me.first()
  if (!me) return { me: null, memberships: [] }
  return { me, memberships: Membership.filter({ person: me.id }).toModelArray() }
}

/**
 * Where /my opens: All My Groups, or My Profile for someone who isn't in any
 * group yet (All My Groups would be empty). The card-menu layout keeps its
 * own My Home menu at /my and doesn't use this.
 */
export const getMyHomePath = ormCreateSelector(
  orm,
  session => {
    const { me, memberships } = myMemberships(session)
    if (me && memberships.length === 0) return personUrl(me.id)
    return myHomeLandingUrl()
  }
)
