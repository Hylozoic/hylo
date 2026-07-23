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

export function getGroupsMenuDataReplayEntries (bootstrap) {
  const batches = bootstrap?.groupsMenuDataBatches || []
  return batches.map(entry => ({
    data: entry?.data,
    extractModel: [{
      getRoot: get('groups'),
      modelName: 'Group',
      append: true
    }]
  }))
}
