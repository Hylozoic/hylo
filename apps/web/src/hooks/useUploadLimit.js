import { useSelector } from 'react-redux'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { UPLOAD_LIMIT_FEATURES, uploadLimitForGroups } from '@hylo/shared'
import { hasProFeature } from 'hooks/useProFeature'
import orm from 'store/models'

/**
 * The per-file upload size limit (bytes) for `groupIds`, from the groups in the store: each group
 * gets the highest limit its Hylo Pro features give (largerUploads 250 MB, higherUploadLimits
 * 1 GB), and several groups get the highest of theirs (one entitled group is enough). The free
 * limit with no groups; a group whose proFeatures haven't been fetched counts as having neither
 * feature. The server only counts groups the user may post to.
 */
export const getUploadLimitForGroupIds = ormCreateSelector(
  orm,
  (state, groupIds) => groupIds,
  ({ Group }, groupIds) => uploadLimitForGroups((groupIds || []).map(id => {
    const group = Group.safeGet({ id })?.ref
    return Object.fromEntries(UPLOAD_LIMIT_FEATURES.map(key => [key, hasProFeature(group, key)]))
  }))
)

/**
 * The per-file upload size limit (bytes) for an attachment to the given groups (see
 * getUploadLimitForGroupIds; e.g. a direct message has no groups and gets the free limit). A hint
 * for the picker and drop zone; the server checks again on upload.
 */
export default function useUploadLimit (groupIds) {
  return useSelector(state => getUploadLimitForGroupIds(state, groupIds))
}
