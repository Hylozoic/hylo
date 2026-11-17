import { FETCH_TASK_EVENTS, FETCH_TASK_STATUSES, JOIN_PROJECT, LEAVE_PROJECT, MOVE_TASK } from 'store/constants'

const taskStatusFields = `
  id
  fulfilledAt
  taskCategory
  taskPlacements {
    id
    groupId
    taskStatusId
    statusName
    statusCategory
    position
  }
`

/** Loads the columns of a group's (or space's) Tasks board. Resolves with them on `payload.data.group.taskStatuses`. */
export function fetchTaskStatuses (groupId) {
  return {
    type: FETCH_TASK_STATUSES,
    graphql: {
      query: `query FetchTaskStatuses ($id: ID) {
        group (id: $id) {
          id
          taskStatuses {
            id
            name
            category
            order
          }
        }
      }`,
      variables: { id: groupId }
    }
  }
}

/** Loads a group's recent task activity for the daily summary card. Resolves with it on `payload.data.group.taskEvents`. */
export function fetchTaskEvents (groupId, sinceDaysAgo = 1) {
  return {
    type: FETCH_TASK_EVENTS,
    graphql: {
      query: `query FetchTaskEvents ($id: ID, $sinceDaysAgo: Int) {
        group (id: $id) {
          id
          taskEvents (sinceDaysAgo: $sinceDaysAgo) {
            id
            type
            createdAt
            meta
            actor {
              id
              name
              avatarUrl
            }
            post {
              id
              title
            }
          }
        }
      }`,
      variables: { id: groupId, sinceDaysAgo }
    }
  }
}

/** Moves a task to a column on one group's board. Omit index to put it at the bottom. */
export function moveTask ({ postId, groupId, taskStatusId, index }) {
  return {
    type: MOVE_TASK,
    graphql: {
      query: `mutation MoveTask ($postId: ID, $groupId: ID, $taskStatusId: ID, $index: Int) {
        moveTask (postId: $postId, groupId: $groupId, taskStatusId: $taskStatusId, index: $index) {
          ${taskStatusFields}
        }
      }`,
      variables: { postId, groupId, taskStatusId, index }
    },
    meta: {
      postId,
      extractModel: 'Post'
    }
  }
}

// Taking a task and stepping off it reuse the project member reducers, which add or
// remove the current user from the post's members straight away.

/** Puts the current user on a task ("I'll take this"). */
export function takeTask (postId) {
  return {
    type: JOIN_PROJECT,
    graphql: {
      query: `mutation AssignTask ($postId: ID) {
        assignTask (postId: $postId) {
          id
        }
      }`,
      variables: { postId }
    },
    meta: { id: postId }
  }
}

/** Takes the current user off a task ("Step off"). */
export function stepOffTask (postId) {
  return {
    type: LEAVE_PROJECT,
    graphql: {
      query: `mutation UnassignTask ($postId: ID) {
        unassignTask (postId: $postId) {
          id
        }
      }`,
      variables: { postId }
    },
    meta: { id: postId }
  }
}
