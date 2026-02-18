export function isTestAdmin (userId, email) {
  if (!userId) return false

  // Check HYLO_TESTER_IDS (test admin list)
  const testerIds = process.env.HYLO_TESTER_IDS ? process.env.HYLO_TESTER_IDS.split(',') : []
  if (testerIds.includes(String(userId))) {
    return true
  }

  // Reuse the same logic from isSignedIn: check email pattern OR HYLO_ADMINS
  const emailMatches = email && !!(email.match(/@hylo\.com|@terran\.io$/))
  const adminIds = process.env.HYLO_ADMINS ? process.env.HYLO_ADMINS.split(',') : []
  const isInAdminList = adminIds.map(id => Number(id)).includes(Number(userId))

  return emailMatches || isInAdminList
}
