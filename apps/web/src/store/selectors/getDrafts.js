import orm from 'store/models'
import { createSelector as ormCreateSelector } from 'redux-orm'

const sameId = (a, b) => String(a || '') === String(b || '')
const isNil = value => value === null || value === undefined || value === ''

function matchesContext (draft, { type, groupId, topicId, postId, messageThreadId, isEdit }) {
  if (type && draft.type !== type) return false

  if (type === 'post') {
    const draftIsEdit = !!draft.isEdit
    if (!!isEdit !== draftIsEdit) return false

    if (draftIsEdit) {
      return sameId(draft.postId, postId)
    }

    if (!sameId(draft.groupId, groupId)) return false
    if (isNil(topicId)) return isNil(draft.topicId)
    return sameId(draft.topicId, topicId)
  }

  if (type === 'comment') {
    return sameId(draft.postId, postId)
  }

  if (type === 'message') {
    return sameId(draft.messageThreadId, messageThreadId)
  }

  return true
}

export const selectDraftsForMyDraftsPage = ormCreateSelector(
  orm,
  session => {
    return session.Draft
      .all()
      .toModelArray()
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
  }
)

export const selectDraftForContext = ormCreateSelector(
  orm,
  (state, props) => props || {},
  (session, context) => {
    const drafts = session.Draft.all().toModelArray()
    return drafts.find(draft => matchesContext(draft, context)) || null
  }
)
