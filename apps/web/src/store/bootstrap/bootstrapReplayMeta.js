import { get } from 'lodash/fp'
import { meQueryExtractModel } from 'store/actions/fetchForCurrentUser'
import { groupsMenuDataExtractModel } from 'store/actions/fetchGroupsMenuData'

export const bootstrapReplayEntries = [
  {
    getData: bootstrap => bootstrap?.checkLogin?.data,
    extractModel: meQueryExtractModel
  },
  {
    getData: bootstrap => bootstrap?.currentUser?.data,
    extractModel: meQueryExtractModel
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
    extractModel: groupsMenuDataExtractModel
  }))
}
