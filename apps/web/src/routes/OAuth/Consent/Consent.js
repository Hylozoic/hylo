import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isEmpty } from 'lodash/fp'
import { useDispatch } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { formatError } from 'routes/NonAuthLayoutRouter/util'
import Button from 'components/ui/button'
import useRouteParams from 'hooks/useRouteParams'
import getQuerystringParam from 'store/selectors/getQuerystringParam'
import { cancel, confirm } from './Consent.store'

export default function Consent (props) {
  const [error, setError] = useState(null)
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const location = useLocation()
  const routeParams = useRouteParams()

  // Connector logic merged in
  let missingOIDCScopes = getQuerystringParam('missingScopes', location) || []

  // XXX: ideally we would know offline_access was requested even if it's not missing, so we can tell user they already granted it
  //      but i don't know how to get that from the back-end yet.
  const offlineAccessRequested = missingOIDCScopes.includes('offline_access')

  if (!isEmpty(missingOIDCScopes)) {
    if (!Array.isArray(missingOIDCScopes)) {
      missingOIDCScopes = [missingOIDCScopes]
    }
    // remove openid and offline_access from scopes
    missingOIDCScopes = missingOIDCScopes.filter(s => !['openid', 'offline_access'].includes(s))
  }

  let missingOIDCClaims = getQuerystringParam('missingClaims', location) || []
  if (Array.isArray(missingOIDCClaims) && missingOIDCClaims.length) {
    missingOIDCClaims = missingOIDCClaims.filter(c => !['sub', 'sid', 'auth_time', 'acr', 'amr', 'iss'].includes(c))
  }

  const missingResourceScopes = getQuerystringParam('missingResourceScopes', location) || []
  const previousAuthsOnly = isEmpty(missingOIDCScopes) && isEmpty(missingOIDCClaims) && isEmpty(missingResourceScopes)
  const appName = getQuerystringParam('name', location) || 'The App'
  const oauthUID = routeParams.uid

  const submit = () => {
    dispatch(confirm(oauthUID)).then((results) => {
      if (results.error) {
        setError(results.error)
        console.error(t('Something weird happened during consent process'), results.error)
      } else if (results.payload && results.payload.redirectTo) {
        window.location.href = results.payload.redirectTo
      } else {
        console.error(t('Something weird happened during consent process'))
      }
    })
  }

  const cancelAction = () => {
    dispatch(cancel(oauthUID)).then((results) => {
      window.location.href = results.payload.redirectTo
    })
  }

  return (
    <div className='bg-card shadow-md rounded-md w-full max-w-[320px]'>
      <div className='p-4'>
        <h1 className='text-2xl font-bold mb-4 text-foreground text-center'>{t('{{appName}} wants access to your Hylo account', { appName })}</h1>
        {error && formatError(error, 'Login')}

        <div>
          {previousAuthsOnly
            ? <p>{t('{{appName}} is asking you to confirm previously given authorization', { appName })}</p>
            : ''}

          {!isEmpty(missingOIDCScopes)
            ? (
              <div className='mb-4'>
                <h3>{t('This will allow {{appName}} to:', { appName })}</h3>
                <ul className='list-disc'>
                  {missingOIDCScopes.map((scope) =>
                    <li key={scope}>
                      {scope === 'profile'
                        ? t('Access your profile, including your name and image.')
                        : scope === 'address'
                          ? t('Access to your physical address.')
                          : scope === 'email'
                            ? t('Access to your email address.')
                            : scope === 'phone'
                              ? t('Access to your phone number.')
                              : ''}
                    </li>
                  )}
                </ul>
              </div>
              )
            : ''}

          {!isEmpty(missingOIDCClaims)
            ? (
              <div>
                <h3>{t('Claims:')}</h3>
                <ul>
                  {missingOIDCClaims.map((claim) => {
                    return <li key={claim}>{claim}</li>
                  })}
                </ul>
              </div>
              )
            : ''}

          {!isEmpty(missingResourceScopes)
            ? Object.keys(missingResourceScopes).map(indicator => (
              <div key={indicator}>
                <h3>{indicator}</h3>
                <ul>
                  {missingResourceScopes[indicator].map(scope => <li key={scope}>{scope}</li>)}
                </ul>
              </div>
            ))
            : ''}

          {offlineAccessRequested
            ? (
              <div>
                {t('{{appName}} is asking to have offline access to Hylo', { appName })}
                {/* XXX: Don't know currently how to tell here if the client is asking for offline_access but already granted it
                  {isEmpty(missingOIDCScopes) || !missingOIDCScopes.includes('offline_access')
                  ? <p>(which you've previously granted)</p>
                  : ''
                } */}
              </div>
              )
            : ''}
        </div>

        <div className='flex gap-2 justify-center'>
          <Button variant='outline' onClick={cancelAction}>{t('Cancel')}</Button>
          <Button variant='secondary' onClick={submit}>{t('Allow')}</Button>
        </div>
      </div>
    </div>
  )
}
