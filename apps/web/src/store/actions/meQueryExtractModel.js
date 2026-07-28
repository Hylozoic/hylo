import { get } from 'lodash/fp'

/** Shared ORM extract config for MeQuery (`checkLogin` + `fetchForCurrentUser`). */
export default [
  {
    getRoot: get('me'),
    modelName: 'Me'
  }
]
