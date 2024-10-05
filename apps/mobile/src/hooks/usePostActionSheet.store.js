export const MODULE_NAME = 'PostActionSheet'

// Constants
export const DELETE_POST = `${MODULE_NAME}/DELETE_POST`
export const DELETE_POST_PENDING = DELETE_POST + '_PENDING'
export const REMOVE_POST = `${MODULE_NAME}/REMOVE_POST`
export const REMOVE_POST_PENDING = REMOVE_POST + '_PENDING'
export const PIN_POST = `${MODULE_NAME}/PIN_POST`
export const PIN_POST_PENDING = `${PIN_POST}_PENDING`

// Action Creators
export function deletePost (id) {
  return {
    type: DELETE_POST,
    graphql: {
      query: `mutation ($id: ID) {
        deletePost(id: $id) {
          success
        }
      }`,
      variables: {
        id
      }
    },
    meta: {
      optimistic: true,
      id
    }
  }
}

export function removePost (postId, slug) {
  return {
    type: REMOVE_POST,
    graphql: {
      query: `mutation ($postId: ID, $slug: String) {
        removePost(postId: $postId, slug: $slug) {
          success
        }
      }`,
      variables: {
        postId,
        slug
      }
    },
    meta: {
      optimistic: true,
      postId,
      slug
    }
  }
}

export function pinPost (postId, groupId) {
  return {
    type: PIN_POST,
    graphql: {
      query: `mutation ($postId: ID, $groupId: ID) {
        pinPost(postId: $postId, groupId: $groupId) {
          success
        }
      }`,
      variables: {
        postId,
        groupId
      }
    },
    meta: {
      optimistic: true,
      postId,
      groupId
    }
  }
}

export function ormSessionReducer ({ Post }, { type, meta }) {
  switch (type) {
    case DELETE_POST_PENDING: {
      Post.withId(meta.id).delete()
      break
    }

    case PIN_POST_PENDING: {
      const post = Post.withId(meta.postId)
      // this line is to clear the selector memoization
      post.update({ _invalidate: (post._invalidate || 0) + 1 })
      const postMembership = post.postMemberships.filter(p =>
        Number(p.group) === Number(meta.groupId)).toModelArray()[0]
      postMembership && postMembership.update({ pinned: !postMembership.pinned })
      break
    }

    case REMOVE_POST_PENDING: {
      const post = Post.withId(meta.postId)
      const groups = post.groups.filter(c =>
        c.slug !== meta.slug).toModelArray()
      post.update({ groups })
      break
    }
  }
}
