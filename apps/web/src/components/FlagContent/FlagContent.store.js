export const MODULE_NAME = 'FlagContent'

// Constants
export const FLAG_CONTENT = `${MODULE_NAME}/FLAG_CONTENT`

// Action Creators
export function submitFlagContent (category, reason, linkData) {
  return {
    type: FLAG_CONTENT,
    graphql: {
      query: `mutation ($category: String, $reason: String, $linkData: LinkDataInput) {
        flagInappropriateContent(data: {category: $category, reason: $reason, linkData: $linkData}) {
          success
        }
      }`,
      variables: {
        category,
        reason,
        linkData
      }
    },
    meta: {
      optimistic: true
    }
  }
}

export const REPORT_TO_STAFF = `${MODULE_NAME}/REPORT_TO_STAFF`

// Link types that go to Hylo staff instead of a group's moderators
export const STAFF_REPORT_TYPES = ['member', 'thread']

/**
 * Report a person (linkData.type 'member') or a direct message conversation
 * (linkData.type 'thread') to Hylo staff.
 */
export function reportToStaff (category, reason, linkData) {
  const isThread = linkData?.type === 'thread'
  return {
    type: REPORT_TO_STAFF,
    graphql: {
      query: `mutation ($data: StaffReportInput) {
        reportToStaff(data: $data) {
          success
        }
      }`,
      variables: {
        data: {
          category,
          text: reason,
          reportedUserId: isThread ? linkData?.reportedUserId : linkData?.id,
          messageThreadId: isThread ? linkData?.id : undefined
        }
      }
    }
  }
}
