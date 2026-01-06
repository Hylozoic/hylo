module.exports = function(req, res, next) {
  // Skip admin check for static assets (CSS, JS, images, etc.)
  const isAssetRequest = req.path.includes('/assets/') ||
    /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(req.path)

  if (isAssetRequest) {
    return next()
  }

  if (Admin.isSignedIn(req)) {
    sails.log.debug('isAdmin: ' + req.session.userEmail)
    return next()
  } else {
    if (res.forbidden) {
      res.forbidden()
    } else {
      // when this middleware is used outside of the Sails stack
      // (see http.js), it needs to fall back to the standard API
      // for http.ServerResponse
      res.statusCode = 403
      res.end('Forbidden')
    }
  }
}
