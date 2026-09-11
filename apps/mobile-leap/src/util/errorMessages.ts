function testJSON (text: unknown) {
  if (typeof text !== 'string') return false
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

export default function errorMessages (type: unknown, action = '') {
  let err: string

  if (testJSON(type)) {
    err = JSON.parse(type as string).error
  } else {
    err = String(type)
  }

  const errors: Record<string, string> = {
    'no user': `${action} was canceled or no user data was found.`,
    'no email': 'Please enter a valid email address',
    'no email provided': 'Please enter a valid email address',
    'invalid-email': 'Please enter a valid email address',
    'duplicate-email': 'Account already exists',
    'no password provided': 'Please enter your password',
    'email not found': 'Email address not found',
    'invalid-code': 'Invalid code, please try again',
    'invalid-link': 'Link expired, please start over',
    'invite-expired': 'Sorry, your invitation to this group is expired, has already been used, or invalid. Please contact a group moderator for another one.',
    default: err
  }

  return errors[err] || errors.default
}
