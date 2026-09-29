import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'

export const FETCH_MY_SOLE_ADMINISTRATOR_GROUPS = 'FETCH_MY_SOLE_ADMINISTRATOR_GROUPS'

export function fetchMySoleAdministratorGroups () {
  return {
    type: FETCH_MY_SOLE_ADMINISTRATOR_GROUPS,
    graphql: {
      query: `query MySoleAdministratorGroups {
        mySoleAdministratorGroups {
          id
          name
          slug
          avatarUrl
        }
      }`
    }
  }
}

/**
 * The groups where the current user is the only active Administrator, fetched
 * whenever `enabled` turns true. Returns { groups, loading }; groups is [] until loaded
 * and when the request fails, so callers only ever warn and never block.
 */
export function useSoleAdministratorGroups (enabled) {
  const dispatch = useDispatch()
  const [state, setState] = useState({ groups: [], loading: false })

  useEffect(() => {
    if (!enabled) return
    let active = true
    setState(current => ({ ...current, loading: true }))
    Promise.resolve(dispatch(fetchMySoleAdministratorGroups()))
      .then(result => {
        if (!active) return
        const groups = result?.payload?.data?.mySoleAdministratorGroups
        setState({ groups: Array.isArray(groups) ? groups : [], loading: false })
      })
      .catch(() => {
        if (active) setState({ groups: [], loading: false })
      })
    return () => { active = false }
  }, [enabled, dispatch])

  return state
}
