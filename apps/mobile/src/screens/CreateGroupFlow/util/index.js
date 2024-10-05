export const slugValidatorRegex = /^[0-9a-z-]{2,40}$/
export const invalidSlugMessage = 'URLs must have between 2 and 40 characters, and can only have lower case letters, numbers, and dashes.'

export function formatDomainWithUrl (groupDomain) {
  if (!groupDomain) return
  let formattedDomain = groupDomain.replace(/hylo\.com\/groups\/?/, '')
  if (formattedDomain !== '') {
    formattedDomain = 'hylo.com/groups/' + formattedDomain
  }
  return formattedDomain
}

export function removeDomainFromURL (groupDomain) {
  if (!groupDomain) return
  return groupDomain.replace('hylo.com/groups/', '')
}
