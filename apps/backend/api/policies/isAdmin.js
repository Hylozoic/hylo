// kue-ui's static files are public, and Sails gives requests that look like files no session,
// so they can't be checked. Only this directory is skipped: any other path ending in .js/.css
// (e.g. /noo/admin/kue/api/jobs/0..100/asc.js) must still pass the admin check.
const KUE_UI_ASSETS_PATH = '/noo/admin/kue/assets/'

module.exports = function (req, res, next) {
  const fullPath = (req.baseUrl || '') + req.path
  const isKueUIAsset = ['GET', 'HEAD'].includes(req.method) &&
    fullPath.startsWith(KUE_UI_ASSETS_PATH) && !fullPath.includes('..')

  if (isKueUIAsset) {
    return next()
  }

  if (req.session && Admin.isSignedIn(req)) {
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
