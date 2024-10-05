import { createSelector } from 'reselect'
import { get, reduce } from 'lodash/fp'
import orm from 'store/models'
import { FETCH_COMMENTS } from 'store/constants'
import { makeGetQueryResults } from 'store/reducers/queryResults'

const normaliseCommentModel = comment => ({
  ...comment.ref,
  creator: comment.creator,
  attachments: comment.attachments
    .orderBy('position').toRefArray()
})

export const getComments = createSelector(
  state => orm.session(state.orm),
  (_, props) => props.commentId,
  (_, props) => props.postId,
  ({ Comment }, parentComment, post) => {
    const comments = Comment
      .filter({ post })
      .orderBy(c => -Number(c.id))
      .toModelArray()
      .map(normaliseCommentModel)
    const parentComments = comments.filter(c => !c.parentComment)

    return reduce.convert({ cap: false })((commentsWithSubComments, comment, index) => {
      return [
        ...commentsWithSubComments,
        {
          sectionIndex: index,
          ...comment,
          subComments: comments
            .filter(sc => sc.parentComment === comment.id)
            .map((c, i) => ({
              sectionIndex: index,
              itemIndex: i + 1,
              ...c
            }))
        }
      ]
    }, [], parentComments)
  }
)

const getCommentResults = makeGetQueryResults(FETCH_COMMENTS)

export const getHasMoreComments = createSelector(
  getCommentResults,
  get('hasMore')
)

export const getTotalComments = createSelector(
  getCommentResults,
  get('total')
)
