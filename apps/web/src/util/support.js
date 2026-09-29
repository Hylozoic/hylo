/**
 * Building Hylo is Hylo's own community group and the help route for anyone
 * who can't use the support chat: people who turned off support cookies,
 * signed-out visitors, error screens and the mobile app. index.html's boot
 * fallback can't import this module and repeats the path inline.
 */
export const BUILDING_HYLO_SLUG = 'building-hylo'

/** The group's About page, which signed-out visitors can open too. */
export const BUILDING_HYLO_ABOUT_PATH = `/groups/${BUILDING_HYLO_SLUG}/about`
