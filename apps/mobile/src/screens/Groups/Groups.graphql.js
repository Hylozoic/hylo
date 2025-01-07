import { gql } from 'urql'

// Note: The most reliable query here for getting memberCount
// was on `me.memberships`. `group(id: x)` nor `groups(groupIds: [x])
// were returning (or extracting) the expected full set.

export const MeMembershipsMemberCountQuery = gql`
  query MeMembershipsMemberCountQuery {
    me {
      memberships {
        group {
          id
          memberCount
          childGroups {
            items {
              id
              name
              memberCount
            }
          }
          parentGroups {
            items {
              id
              name
              memberCount
            }
          }
        }
      }
    }
  }
`

export const GroupsMemberCountQuery = gql`
  query GroupsMemberCountQuery($id: ID) {
    groups(groupIds: [$id]) {
      items {
        id
        memberCount
        childGroups {
          items {
            id
            memberCount
          }
        }
        parentGroups {
          items {
            id
            memberCount
          }
        }
      }
    }
  }
`

export const GroupMemberCountQuery = gql`
  query GroupMemberCountQuery($id: ID) {
    groups(groupIds: [$id]) {
      items {
        id
        memberCount
        childGroups {
          items {
            id
            memberCount
          }
        }
        parentGroups {
          items {
            id
            memberCount
          }
        }
      }
    }
    group(id: $id) {
      id
      slug
      memberCount
      parentGroups {
        items {
          id
          slug
          memberCount
        }
      }
      childGroups {
        items {
          id
          slug
          memberCount
        }
      }
    }
  }
`
