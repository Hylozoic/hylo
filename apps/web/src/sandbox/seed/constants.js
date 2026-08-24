/**
 * Shared placeholder and ID conventions for sandbox seed data.
 * Edit copy in the en/*.js files — names use PLACEHOLDER_NAME, prose uses PLACEHOLDER_COPY.
 */

/** 12-character name placeholder — replace % blocks with real names */
export const PLACEHOLDER_NAME = '%%%%%%%%%%%%'

/** 200-character body/comment/description placeholder — replace * blocks with real copy */
export const PLACEHOLDER_COPY = '*'.repeat(100)

/** Stable slug for the primary demo group */
export const MAIN_GROUP_SLUG = 'terran-collective'

/** Stable slug for the simpler community group */
export const SIMPLE_GROUP_SLUG = 'eastbayconnect'

/** Stable slug for the worker-owned staff cooperative */
export const STAFF_GROUP_SLUG = 'holistica-staff'

/** Main group member count (includes sandbox Me) */
export const MAIN_GROUP_MEMBER_COUNT = 127

/** Sandbox entity ids are numeric (see sid() in helpers.js) so Hylo URL helpers match them */
