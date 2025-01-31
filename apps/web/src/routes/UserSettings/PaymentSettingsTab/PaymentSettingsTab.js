import PropTypes from 'prop-types'
import React, { Component } from 'react'
import { withTranslation } from 'react-i18next'
import classes from './PaymentSettingsTab.module.scss'
import Loading from 'components/Loading'
import Button from 'components/Button'
import { PROJECT_CONTRIBUTIONS } from 'config/featureFlags'
const { object } = PropTypes

const clientId = process.env.STRIPE_CLIENT_ID
const stripeUrl = `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${clientId}&scope=read_write`

class PaymentSettingsTab extends Component {
  static propTypes = {
    currentUser: object
  }

  constructor (props) {
    super(props)
    this.state = {}
  }

  render () {
    const {
      currentUser,
      queryParams,
      t
    } = this.props

    if (!currentUser) return <Loading />
    const { hasStripeAccount } = currentUser
    const { registered } = queryParams
    const registerSuccess = registered === 'success'
    const registerError = registered === 'error'

    const goToStripe = () => window.open(stripeUrl)

    if (!currentUser.hasFeature(PROJECT_CONTRIBUTIONS)) return null

    return (
      <div>
        <div className={classes.title}>{t('Connect Stripe Account')}</div>
        {!hasStripeAccount && <div className={classes.prompt}>{t('Click the button below to create a free Stripe account (or connect an existing account). Once you\'ve done that you will be able to accept contributions to Projects.')}</div>}
        {hasStripeAccount && <div className={classes.prompt}>{t('You already have a stripe account linked to this account. If you would like to link a different account, click the button below.')}</div>}
        {registerSuccess && <div className={classes.successNotification}>{t('Your account is registered, you\'re ready to accept contributions to projects.')}</div>}
        {registerError && <div className={classes.errorNotification}>{t('There was an issue registering your stripe account. Please try again. If the problem persists, contact us.')}</div>}
        <Button
          label={t('Link Stripe Account')}
          onClick={goToStripe}
        />
      </div>
    )
  }
}
export default withTranslation()(PaymentSettingsTab)
