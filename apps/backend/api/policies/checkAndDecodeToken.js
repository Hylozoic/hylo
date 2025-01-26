import { GraphQLError } from 'graphql'

module.exports = function checkAndDecodeToken (req, res, next) {
  const token = req.param('token')
  try {
    res.locals.tokenData = Email.decodeFormToken(token)
    next()
  } catch (e) {
    res.badRequest(new GraphQLYogaError('Invalid token: ' + token))
  }
}
