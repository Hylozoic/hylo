import { useSelector } from 'react-redux'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { uploadLimitFor } from '@hylo/shared'
import { hasProFeature } from 'hooks/useProFeature'
import orm from 'store/models'

/**
 * Whether every one of `groupIds` has Hylo Pro's largerUploads feature, from the groups in the
 * store (a group whose proFeatures haven't been fetched counts as not having it)
 */
export const getLargerUploadsForGroupIds = ormCreateSelector(
  orm,
  (state, groupIds) => groupIds,
  ({ Group }, groupIds) => {
    if (!groupIds || groupIds.length === 0) return false
    return groupIds.every(id => hasProFeature(Group.safeGet({ id })?.ref, 'largerUploads'))
  }
)

/**
 * The per-file upload size limit (bytes) for an attachment to the given groups: the Pro limit
 * when every group has largerUploads, otherwise the free limit (also with no groups, e.g. a
 * direct message). A hint for the picker and drop zone; the server checks again on upload.
 */
export default function useUploadLimit (groupIds) {
  const largerUploads = useSelector(state => getLargerUploadsForGroupIds(state, groupIds))
  return uploadLimitFor({ largerUploads })
}
