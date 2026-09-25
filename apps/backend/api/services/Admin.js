// Admin status comes only from env ID lists. Emails can be changed by users via updateMe without re-verification.
function idsFromEnv (name) {
  return (process.env[name] || '').split(',').map(id => Number(id.trim())).filter(id => id > 0)
}

function isHyloAdmin (userId) {
  return !!userId && idsFromEnv('HYLO_ADMINS').includes(Number(userId))
}

module.exports = {
  isSignedIn: function (req) {
    return isHyloAdmin(req.session.userId)
  },

  isSuperAdmin: async function (userId) {
    return isHyloAdmin(userId)
  },

  isTestAdmin: async function (userId) {
    if (!userId) return false
    return idsFromEnv('HYLO_TESTER_IDS').includes(Number(userId)) || isHyloAdmin(userId)
  }
}
