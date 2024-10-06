import orm from '../models'
import { createSelector as ormCreateSelector } from 'redux-orm'
import getMe from './getMe'
import { useQuery } from 'urql'
import fetchCommonRoles from 'store/actions/fetchCommonRoles'
import fetchPerson from 'store/actions/fetchPerson'
import { useEffect, useState } from 'react'

export const useRolesForGroup = (personId, groupId) => {
  const [commonRoles, setCommonRoles] = useState([])
  const [{ data: commonRolesData, fetching: fetchingCommonRoles }] = useQuery(fetchCommonRoles().graphql)

  const [person, setPerson] = useState()
  const [{ data: personData, fetching: fetchingPerson }] = useQuery(fetchPerson(personId).graphql)

  useEffect(() => {
    if (!fetchingCommonRoles && commonRolesData?.commonRoles) {
      setCommonRoles(commonRolesData?.commonRoles)
    }
  }, [fetchingCommonRoles, commonRolesData])

  useEffect(() => {
    if (!fetchingPerson && personData?.person) {
      setPerson(personData?.person)
    }
  }, [fetchingPerson, personData])

  if (person && commonRoles) {
    let membershipCommonRoles = person.membershipCommonRoles.items.filter(role => role.groupId === groupId)

    membershipCommonRoles = commonRoles
      .filter(commonRole =>
        membershipCommonRoles.find(role => role.commonRoleId === commonRole.id)
      )
      .map(commonRole => ({ ...commonRole, common: true }))
    console.log('!!!!! membershipCommonRoles:', commonRolesData)
    return membershipCommonRoles.concat(person.groupRoles ? person.groupRoles.items.filter(role => role.groupId === groupId) : [])
  } else {
    return null
  }
}

const getRolesForGroup = ormCreateSelector(
  orm,
  (state, props) => props.person || getMe(state),
  (state, props) => props.groupId,
  (session, person, groupId) => {
    const commonRoles = session.CommonRole.all().toModelArray()
    if (typeof person === 'number' || typeof person === 'string') {
      person = session.Me.withId(person) || session.Person.withId(person)
    }
    let membershipCommonRoles = ((person.membershipCommonRoles && (person.membershipCommonRoles.items || ('toModelArray' in person.membershipCommonRoles && person.membershipCommonRoles.toModelArray()) || person.membershipCommonRoles)) || []).filter(mcr => mcr.groupId === groupId)
    membershipCommonRoles = commonRoles.filter(cr => membershipCommonRoles.find(mcr => mcr.commonRoleId === cr.id)).map(cr => ({ ...cr.ref, common: true }))
    return membershipCommonRoles.concat(person.groupRoles ? person.groupRoles.items.filter(role => role.groupId === groupId) : [])
  }
)

export default getRolesForGroup
