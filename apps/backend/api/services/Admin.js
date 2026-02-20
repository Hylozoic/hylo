module.exports = {
  isSignedIn: function (req) {
    const userId = req.session.userId
    if (!userId) {
      return false
    }
    
    const email = req.session.userEmail || ''
    const emailMatches = !!(email.match(/@hylo\.com|@terran\.io$/))
    const adminIds = (process.env.HYLO_ADMINS || '').split(',').map(id => Number(id.trim())).filter(id => !isNaN(id))
    const isInAdminList = adminIds.includes(Number(userId))
    
    return emailMatches || isInAdminList
  },

  isTestAdmin: async function (userId) {
    if (!userId) return false

    // Check HYLO_TESTER_IDS (test admin list)
    const testerIds = process.env.HYLO_TESTER_IDS ? process.env.HYLO_TESTER_IDS.split(',') : []
    if (testerIds.includes(String(userId))) {
      return true
    }

    // Reuse the same logic from isSignedIn: check email pattern OR HYLO_ADMINS
    // Fetch user to check email
    const user = await User.find(userId)
    if (!user) return false

    const email = user.get('email') || ''
    const emailMatches = !!(email.match(/@hylo\.com|@terran\.io$/))
    const adminIds = process.env.HYLO_ADMINS ? process.env.HYLO_ADMINS.split(',') : []
    const isInAdminList = adminIds.map(id => Number(id)).includes(Number(userId))

    return emailMatches || isInAdminList
  }
}
