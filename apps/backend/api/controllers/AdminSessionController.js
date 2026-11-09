var passport = require('passport')
var sentry = require('../../lib/sentry')

module.exports = {

  create: function (req, res) {
    passport.authenticate('admin', { scope: 'email' })(req, res)
  },

  oauth: function (req, res, next) {
    passport.authenticate('admin', function (err, user, info) {
      if (err) { return next(err) }
      if (!user) { return res.redirect('/noo/admin/login') }
      req.login(user, function (err) {
        if (err) { return next(err) }
        return res.redirect('/noo/admin/kue')
      })
    })(req, res, next)
  },

  destroy: function (req, res) {
    sentry.setUser(null)
    req.logout()
    res.redirect('/')
  }

}
