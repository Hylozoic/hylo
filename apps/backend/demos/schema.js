/**
 * Structural checks for a demo spec. Reference checks live in lib/demo/validate.js.
 * @param {object} spec
 * @returns {string[]}
 */
function validateDemoSchema (spec) {
  const errors = []
  if (!spec || typeof spec !== 'object') return ['Spec must be an object']
  if (spec.version !== 1) errors.push('version must be 1')
  requireString(errors, spec, 'slug')
  requireString(errors, spec, 'name')
  requireString(errors, spec, 'tz')
  requireString(errors, spec, 'emailDomain')
  if (spec.emailDomain && spec.emailDomain !== 'demo.invalid') {
    errors.push('emailDomain must be demo.invalid so mail to fake users is not deliverable')
  }
  requireString(errors, spec, 'realUserEmail')
  if (!spec.place || typeof spec.place !== 'object') errors.push('place is required')
  if (!Array.isArray(spec.topics) || !spec.topics.length) errors.push('topics must be a non-empty array')
  if (!Array.isArray(spec.emojis) || !spec.emojis.length) errors.push('emojis must be a non-empty array')
  if (!spec.filler || !Array.isArray(spec.filler.en) || !spec.filler.en.length) errors.push('filler.en is required')
  if (!spec.centers || typeof spec.centers !== 'object') errors.push('centers is required')
  if (!spec.neighborhoods || typeof spec.neighborhoods !== 'object') errors.push('neighborhoods is required')
  if (!Array.isArray(spec.people) || !spec.people.length) errors.push('people must be a non-empty array')
  if (!Array.isArray(spec.posts)) errors.push('posts must be an array')
  if (!Array.isArray(spec.chats)) errors.push('chats must be an array')
  if (!Array.isArray(spec.threads)) errors.push('threads must be an array')
  if (!spec.group || typeof spec.group !== 'object') errors.push('group is required')
  else {
    requireString(errors, spec.group, 'name', 'group.name')
    requireString(errors, spec.group, 'slug', 'group.slug')
    requireString(errors, spec.group, 'purpose', 'group.purpose')
    if (!spec.group.location) errors.push('group.location is required')
    if (!Array.isArray(spec.group.polygon)) errors.push('group.polygon must be an array of [lng, lat]')
    if (!Array.isArray(spec.group.menu)) errors.push('group.menu must be an array')
  }
  if (!Array.isArray(spec.spaces)) errors.push('spaces must be an array')
  if (!spec.images || typeof spec.images !== 'object') errors.push('images is required')
  if (spec.images && (!spec.images.marks || typeof spec.images.marks !== 'object')) {
    errors.push('images.marks is required')
  }
  if (!Array.isArray(spec.agreements)) errors.push('agreements must be an array')
  if (!Array.isArray(spec.questions)) errors.push('questions must be an array')
  if (!Array.isArray(spec.roles)) errors.push('roles must be an array')
  if (spec.expectedPeople != null && spec.people && spec.people.length !== spec.expectedPeople) {
    errors.push(`expected ${spec.expectedPeople} people, found ${spec.people.length}`)
  }
  return errors
}

/**
 * Record a missing string field.
 * @param {string[]} errors
 * @param {object} object
 * @param {string} key
 * @param {string} [label]
 */
function requireString (errors, object, key, label) {
  if (!object || typeof object[key] !== 'string' || !object[key]) {
    errors.push(`${label || key} is required`)
  }
}

module.exports = { validateDemoSchema }
