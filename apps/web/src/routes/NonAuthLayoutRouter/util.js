/* eslint-disable quote-props */
import React from 'react'
import classes from './NonAuthLayoutRouter.module.scss'

export function formatError (error, action, t) {
  if (!error) return

  // Matches User.INVALID_LOGIN_ERROR in the backend
  if (error === 'Incorrect email or password') {
    return (
      <div className={classes.error}>
        {t('Incorrect email or password.')} {t('If you signed up with Google, log in with Google instead.')} <a href='/reset-password'>{t('Reset your password')}</a>
      </div>
    )
  }

  function testJSON (text) {
    if (typeof text !== 'string') {
      return false
    } try {
      JSON.parse(text)
      return true
    } catch (e) {
      return false
    }
  }

  function errorMessages (type, t) {
    let err

    if (testJSON(type)) {
      err = JSON.parse(type)
      err = err.error
    } else {
      err = type
    }

    const errors = {
      'no user': t('{{action}} was canceled or no user data was found.', { action }),
      'no email': t('Please enter a valid email address'),
      'no email provided': t('Please enter a valid email address'),
      'invalid-email': t('Please enter a valid email address'),
      'duplicate-email': t('Account already exists'),
      'linked-account-in-use': t('This account is already connected to a different Hylo user. Log out and sign in with it instead.'),
      'no password provided': t('Please enter your password'),
      'email not found': t('Email address not found'),
      'invalid-code': t('Invalid code, please try again'),
      'invalid-link': t('Link expired, please start over'),
      // Matches RATE_LIMITED_ERROR in the backend
      'Too many attempts. Please wait a few minutes and try again.': t('Too many attempts. Please wait a few minutes and try again.'),
      'invite-expired': t('Sorry, your invitation to this group is expired, has already been used, or is invalid. Please contact a group Host for another one.'),
      // From oidc-provider
      'invalid_request': t('Request expired, please start over'),
      default: err
    }

    return errors[err] || errors.default
  }

  return <div className={classes.error}>{errorMessages(error, t)}</div>
}

// Used by Safari to make sure we have storage access when in an iFrame
export function checkForStorageAccess (successCallback, errorCallback) {
  const isInIframe = window.self !== window.top
  if (isInIframe && typeof document.hasStorageAccess === 'function' && typeof document.requestStorageAccess === 'function') {
    const requestStorageAccessPromise = document.requestStorageAccess()
    return requestStorageAccessPromise.then(successCallback, errorCallback)
  } else {
    return successCallback()
  }
}
