const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return null
  }
  return require('stripe')(process.env.STRIPE_SECRET_KEY)
}

module.exports = {
  create: function (req, res) {
    const stripe = getStripe()
    if (!stripe) {
      return res.serverError(new Error('Stripe is not configured'))
    }
    var params = req.allParams()

    return stripe.customers.create({
      email: params.token.email,
      source: params.token.id,
      plan: params.planId
    })
    .then(() => res.ok({}))
    .catch(res.serverError)
  }
}
