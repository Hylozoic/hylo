export const CUSTOM_VIEW_NAME_MIN_LENGTH = 2

/** Returns `{ name?, postTypes? }` flags for each field that blocks saving a custom view.
 * An empty object means the form can be saved. */
export default function validateCustomViewForm ({ name, postTypes } = {}) {
  const errors = {}
  if ((name || '').trim().length < CUSTOM_VIEW_NAME_MIN_LENGTH) errors.name = true
  if (!Array.isArray(postTypes) || postTypes.length === 0) errors.postTypes = true
  return errors
}
