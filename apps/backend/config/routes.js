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
  'GET    /noo/admin/stripe-analytics':                   'AdminController.stripeAnalytics',
  'POST   /noo/admin/stripe-sales-pause':                 'AdminController.setStripeSalesPaused',
  'GET    /noo/admin/login-as/:userId':                   'AdminController.loginAsUser',

  'POST   /noo/hook/comment':                             'CommentController.createFromEmail',
  'GET    /noo/hook/postForm':                            'PostController.createFromEmailForm',
  'POST   /noo/hook/postForm':                            'PostController.createFromEmailForm',
  'GET    /noo/hook/batchCommentForm':                    'CommentController.createBatchFromEmailForm',
  'POST   /noo/hook/batchCommentForm':                    'CommentController.createBatchFromEmailForm',

  'POST   /noo/login':                                    'SessionController.create',
  'POST   /noo/login/native':                             'SessionController.nativeLogin',
  'POST   /noo/session/from-token':                       'SessionController.fromToken',
  'GET    /noo/login/token':                              'SessionController.createWithToken',
  'POST   /noo/login/token':                              'SessionController.createWithToken',
  'GET    /noo/login/jwt':                                'SessionController.createWithJWT',
  'POST   /noo/login/jwt':                                'SessionController.createWithJWT',
  'POST   /noo/login/apple/oauth':                        'SessionController.finishAppleOAuth',
  'GET    /noo/login/google':                             'SessionController.startGoogleOAuth',
  'GET    /noo/login/google/oauth':                       'SessionController.finishGoogleOAuth',
  'GET    /noo/login/google-token/oauth':                 'SessionController.finishGoogleTokenOAuth',
  'POST   /noo/login/google-token/oauth':                 'SessionController.finishGoogleTokenOAuth',
  'GET    /noo/logout':                                   'SessionController.destroy',
  'DELETE /noo/session':                                  'SessionController.destroySession',

  // TODO: dont exist right now
  // 'POST   /noo/access-token':                             'AccessTokenController.create',
  // 'DELETE /noo/access-token/revoke':                      'AccessTokenController.destroy',

  'POST   /noo/cookie-consent':                           'CookieConsentController.upsert',

  // "Stop invitations" link in invitation emails: GET asks to confirm, POST records it
  'GET    /noo/invitation/:token/opt-out':                'InvitationController.showOptOut',
  'POST   /noo/invitation/:token/opt-out':                'InvitationController.optOut',

  'GET     /noo/mobile/check-should-update':              'MobileAppController.checkShouldUpdate',
  'GET     /noo/mobile/auto-update-info':                 'MobileAppController.updateInfo',
  'POST    /noo/mobile/logerror':                         'MobileAppController.logError',

  'GET     /noo/payment/registerStripe':                  'PaymentController.registerStripe',
  'POST    /noo/payment/registerStripe':                  'PaymentController.registerStripe',

  // Stripe Connect routes
  'GET     /noo/stripe/health':                          'StripeController.health',
  'GET     /noo/stripe/checkout/success':                'StripeController.checkoutSuccess',
  'GET     /noo/stripe/checkout/cancel':                 'StripeController.checkoutCancel',
  'POST    /noo/stripe/webhook':                         'StripeController.webhook',

  // websockets routes
  'POST   /noo/user/subscribe':                           'UserController.subscribeToUpdates',
  'POST   /noo/user/unsubscribe':                         'UserController.unsubscribeFromUpdates',
  'POST   /noo/group/:groupId/subscribe':                 'GroupController.subscribe',
  'POST   /noo/group/:groupId/unsubscribe':               'GroupController.unsubscribe',
  'POST   /noo/group/:groupId/typing':                    'GroupController.typing',
  'POST   /noo/post/:postId/subscribe':                   'PostController.subscribe', // to comments
  'POST   /noo/post/:postId/unsubscribe':                 'PostController.unsubscribe', // from comments
  'POST   /noo/post/:postId/typing':                      'PostController.typing',

  'GET    /noo/group/:groupSlug/murmurations':            'MurmurationsController.group',

  'POST   /noo/upload':                                   'UploadController.create',

  'GET    /noo/export/group':                             'ExportController.groupData',
  'POST   /noo/export/user-account':                      'ExportController.userAccountData',

  // One-click unsubscribe from bulk email (RFC 8058): GET only redirects to the
  // confirmation page, POST unsubscribes
  'GET    /noo/email/unsubscribe':                        'UnsubscribeController.show',
  'GET    /noo/email/unsubscribe/describe':               'UnsubscribeController.describe',
  'POST   /noo/email/unsubscribe':                        'UnsubscribeController.unsubscribe',

  // SendGrid Event Webhook for bounces and spam complaints (signed; its own key)
  'POST   /noo/hook/email-events':                        'EmailEventsController.receive'
}
