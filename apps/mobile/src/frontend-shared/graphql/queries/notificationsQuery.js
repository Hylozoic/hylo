import { gql } from 'urql'
import notificationFieldsFragment from 'frontend-shared/graphql/fragments/notificationFieldsFragment'
export const NOTIFICATIONS_PAGE_SIZE = 20

export default gql`
  query NotificationsQuery ($first: Int = ${NOTIFICATIONS_PAGE_SIZE}, $offset: Int = 0) {
    notifications (first: $first, offset: $offset, order: "desc") {
      total
      hasMore
      items {
        ...NotificationFieldsFragment
      }
    }
  }
  ${notificationFieldsFragment}
`
