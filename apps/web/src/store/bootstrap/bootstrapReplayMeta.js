import { get } from 'lodash/fp'

export const bootstrapReplayEntries = [
  {
    getData: bootstrap => bootstrap?.checkLogin?.data,
    extractModel: [{ getRoot: get('me'), modelName: 'Me' }]
  },
  {
    getData: bootstrap => bootstrap?.currentUser?.data,
    extractModel: [{ getRoot: get('me'), modelName: 'Me' }]
  }
]

export function getGroupReplayEntries (bootstrap) {
  const groupsBySlug = bootstrap?.groupsBySlug || {}
  return Object.entries(groupsBySlug).map(([slug, entry]) => ({
    slug,
    data: entry?.data,
    extractModel: [{
      getRoot: get('group'),
      modelName: 'Group',
      append: true
    }]
  }))
}
