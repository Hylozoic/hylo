export const CHECK_VERSION = 'CHECK_VERSION'

export function checkVersion (platform, version) {
  const queryParams = `${platform}-version=${version}`
  return {
    type: CHECK_VERSION,
    payload: {
      api: { method: 'get', path: `/noo/mobile/check-should-update?${queryParams}` }
    }
  }
}
