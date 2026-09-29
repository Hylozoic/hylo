/* global Notification */
// An activity whose meta.inAppOnly is true creates only the in-app notification: no
// push and no email. For example "X joined" after an approved join request (D13),
// when the stewards already had the request notice.
export const inAppOnlyOverride = ({ activity }) => {
  if (activity.get('meta')?.inAppOnly === true) return [Notification.MEDIUM.InApp]
}
