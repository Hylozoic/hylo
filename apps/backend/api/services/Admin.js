module.exports = {
  isSignedIn: function (req) {
    return req.session.userId && (!!(req.session.userEmail || '').match(/@hylo\.com|@terran\.io$/) || (process.env.HYLO_ADMINS || '').split(',').map(id => Number(id)).includes(req.session.userId))
  }
}
