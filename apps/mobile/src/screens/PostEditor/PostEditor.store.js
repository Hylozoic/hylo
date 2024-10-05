import {
  UPDATE_POST_PENDING
} from 'store/constants'

export const MAX_TITLE_LENGTH = 50

export function ormSessionReducer (session, action) {
  const { type, meta } = action
  if (type === UPDATE_POST_PENDING) {
    // deleting all attachments and topics here because we restore them from the result of the UPDATE_POST action
    const post = session.Post.withId(meta.graphql.variables.id)
    post.attachments.delete()
    post.update({ topics: [] })
  }
}
