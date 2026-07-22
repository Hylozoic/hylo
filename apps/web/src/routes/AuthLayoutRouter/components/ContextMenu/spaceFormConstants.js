import { GROUP_ACCESSIBILITY, GROUP_VISIBILITY } from 'store/models/Group'

/** Suggested icons covering common space archetypes (chat, circle, team, local group, etc). */
export const SPACE_ICON_SUGGESTIONS = [
  'Circle',
  'MessageCircleMore',
  'Shapes',
  'BadgeDollarSign',
  'Layers',
  'Building2',
  'MapPin',
  'Users',
  'Sparkles',
  'Heart',
  'Landmark',
  'Trees',
  'Globe'
]

/** Access presets shared by AddSpaceDialog (creation) and SpaceSettingsModal (editing). */
export const ACCESS_OPTIONS = [
  {
    value: 'open',
    labelKey: 'Open',
    descKey: 'Anyone who can see this space can join it',
    visibility: GROUP_VISIBILITY.Public,
    accessibility: GROUP_ACCESSIBILITY.Open
  },
  {
    value: 'request',
    labelKey: 'Request to Join',
    descKey: 'Must be approved by a group host',
    visibility: GROUP_VISIBILITY.Public,
    accessibility: GROUP_ACCESSIBILITY.Restricted
  },
  {
    value: 'invite',
    labelKey: 'Invite Only',
    descKey: 'Only people who are invited can join',
    visibility: GROUP_VISIBILITY.Hidden,
    accessibility: GROUP_ACCESSIBILITY.Closed
  },
  {
    value: 'role',
    labelKey: 'Role Gated',
    descKey: 'Only members with the selected roles can join',
    visibility: GROUP_VISIBILITY.Hidden,
    accessibility: GROUP_ACCESSIBILITY.Closed
  },
  {
    value: 'paid',
    labelKey: 'Paid',
    descKey: 'Requires payment to join (details coming soon)',
    visibility: GROUP_VISIBILITY.Hidden,
    accessibility: GROUP_ACCESSIBILITY.Closed
  }
]

/** Reverse-maps a space's visibility/accessibility/requiredRoles onto one of ACCESS_OPTIONS. */
export function accessValueForSpace ({ visibility, accessibility, requiredRoles }) {
  if (requiredRoles && requiredRoles.length > 0) return 'role'
  const match = ACCESS_OPTIONS.find(option => option.visibility === visibility && option.accessibility === accessibility)
  return match?.value || 'invite'
}

/** Serializes a date for FundingRound GraphQL Date inputs (ISO string). */
export function toIsoOrNull (value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
