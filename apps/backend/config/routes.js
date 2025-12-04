/* eslint-disable key-spacing */

/**
 * http://sailsjs.org/#/documentation/concepts/Routes/RouteTargetSyntax.html
 */

module.exports.routes = {
  // for OIDC
  // XXX: unclear if its ok to redirect like this, can we somehow directly call the oidc-provider discovery function here?
  'GET    /.well-known/openid-configuration':             '/noo/oauth/.well-known/openid-configuration',

  'POST   /noo/user':                                     'UserController.create',
  'POST   /noo/user/update-notification-settings':        'UserController.updateNotificationSettings',
  'GET    /noo/user/notification-settings':               'UserController.getNotificationSettings',

  'POST   /noo/post/:postId/update-last-read':            'PostController.updateLastRead',

  'GET    /noo/admin/login':                              'AdminSessionController.create',
  'GET    /noo/admin/login/oauth':                        'AdminSessionController.oauth',
  'GET    /noo/admin/logout':                             'AdminSessionController.destroy',
  'GET    /noo/admin/raw-metrics':                        'AdminController.rawMetrics',
  'GET    /noo/admin/login-as/:userId':                   'AdminController.loginAsUser',

  'POST   /noo/hook/comment':                             'CommentController.createFromEmail',
  'GET    /noo/hook/postForm':                            'PostController.createFromEmailForm',
  'POST   /noo/hook/postForm':                            'PostController.createFromEmailForm',
  'GET    /noo/hook/batchCommentForm':                    'CommentController.createBatchFromEmailForm',
  'POST   /noo/hook/batchCommentForm':                    'CommentController.createBatchFromEmailForm',

  'POST   /noo/login':                                    'SessionController.create',
  'GET    /noo/login/token':                              'SessionController.createWithToken',
  'POST   /noo/login/token':                              'SessionController.createWithToken',
  'GET    /noo/login/jwt':                                'SessionController.createWithJWT',
  'POST   /noo/login/jwt':                                'SessionController.createWithJWT',
  'POST   /noo/login/apple/oauth':                        'SessionController.finishAppleOAuth',
  'GET    /noo/login/google':                             'SessionController.startGoogleOAuth',
  'GET    /noo/login/google/oauth':                       'SessionController.finishGoogleOAuth',
  'GET    /noo/login/facebook':                           'SessionController.startFacebookOAuth',
  'GET    /noo/login/facebook/oauth':                     'SessionController.finishFacebookOAuth',
  'GET    /noo/login/linkedin':                           'SessionController.startLinkedinOAuth',
  'GET    /noo/login/linkedin/oauth':                     'SessionController.finishLinkedinOAuth',
  'GET    /noo/login/facebook-token/oauth':               'SessionController.finishFacebookTokenOAuth',
  'POST   /noo/login/facebook-token/oauth':               'SessionController.finishFacebookTokenOAuth',
  'GET    /noo/login/google-token/oauth':                 'SessionController.finishGoogleTokenOAuth',
  'POST   /noo/login/google-token/oauth':                 'SessionController.finishGoogleTokenOAuth',
  'GET    /noo/login/linkedin-token/oauth':               'SessionController.finishLinkedinTokenOAuth',
  'POST   /noo/login/linkedin-token/oauth':               'SessionController.finishLinkedinTokenOAuth',
  'GET    /noo/logout':                                   'SessionController.destroy',
  'DELETE /noo/session':                                  'SessionController.destroySession',

  // TODO: dont exist right now
  // 'POST   /noo/access-token':                             'AccessTokenController.create',
  // 'DELETE /noo/access-token/revoke':                      'AccessTokenController.destroy',

  'POST    /noo/subscription':                            'SubscriptionController.create',
  'POST   /noo/cookie-consent':                           'CookieConsentController.upsert',

  'GET     /noo/mobile/check-should-update':              'MobileAppController.checkShouldUpdate',
  'GET     /noo/mobile/auto-update-info':                 'MobileAppController.updateInfo',
  'POST    /noo/mobile/logerror':                         'MobileAppController.logError',

  'GET     /noo/payment/registerStripe':                  'PaymentController.registerStripe',
  'POST    /noo/payment/registerStripe':                  'PaymentController.registerStripe',

  // websockets routes
  'POST   /noo/user/subscribe':                           'UserController.subscribeToUpdates',
  'POST   /noo/user/unsubscribe':                         'UserController.unsubscribeFromUpdates',
  'POST   /noo/group/:groupId/subscribe':                 'GroupController.subscribe',
  'POST   /noo/group/:groupId/unsubscribe':               'GroupController.unsubscribe',
  'POST   /noo/post/:postId/subscribe':                   'PostController.subscribe', // to comments
  'POST   /noo/post/:postId/unsubscribe':                 'PostController.unsubscribe', // from comments
  'POST   /noo/post/:postId/typing':                      'PostController.typing',

  'GET    /noo/group/:groupSlug/murmurations':            'MurmurationsController.group',

  'POST   /noo/upload':                                   'UploadController.create',

  'GET    /noo/export/group':                             'ExportController.groupData',
  'POST   /noo/export/user-account':                      'ExportController.userAccountData',

  // Role Stewardship endpoints
  'POST   /noo/role/:roleId/volunteer':                   'RoleStewardshipController.volunteer',
  'POST   /noo/role/:roleId/nominate':                    'RoleStewardshipController.nominate',
  'POST   /noo/role/:roleId/trust':                       'RoleStewardshipController.trust',
  'GET    /noo/role/:roleId/trust-data':                  'RoleStewardshipController.trustData',
  'POST   /noo/role/:roleId/recalculate':                 'RoleStewardshipController.recalculate',
  'POST   /noo/group/:groupId/recalculate-roles':         'RoleStewardshipController.recalculateRoles'
}
