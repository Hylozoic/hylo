import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import Button from 'components/ui/button'
import { CheckCircle, Loader2 } from 'lucide-react'
import { groupUrl } from '@hylo/navigation'
import { isDev } from 'config/index'
import getGroupForSlug from 'store/selectors/getGroupForSlug'
import fetchForGroup from 'store/actions/fetchForGroup'

/** Dev / Playwright: allow slow bootstraps before auto-redirect; production keeps a short delay. */
const PAYMENT_SUCCESS_REDIRECT_MS = isDev ? 30000 : 5000

/**
 * PaymentSuccess Component
 *
 * Displays a success message after a user completes a Stripe checkout
 * and redirects them to the group home page.
 */
export default function PaymentSuccess () {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { groupSlug } = useParams()
  const [searchParams] = useSearchParams()
  const [redirecting, setRedirecting] = useState(false)

  const group = useSelector(state => getGroupForSlug(state, { groupSlug }))

  const sessionId = searchParams.get('session_id')

  // Fetch group data if not already loaded
  useEffect(() => {
    if (groupSlug && !group) {
      dispatch(fetchForGroup(groupSlug))
    }
  }, [dispatch, groupSlug, group])

  // Auto-redirect to group home after a short delay (longer in dev so E2E can assert the shell)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (groupSlug) {
        setRedirecting(true)
        navigate(groupUrl(groupSlug))
      }
    }, PAYMENT_SUCCESS_REDIRECT_MS)

    return () => clearTimeout(timer)
  }, [navigate, groupSlug])

  const handleReturnToGroup = () => {
    if (groupSlug) {
      setRedirecting(true)
      navigate(groupUrl(groupSlug))
    }
  }

  return (
    <div className='max-w-2xl mx-auto p-6'>
      <div className='bg-card p-8 rounded-lg text-center shadow-xl border-2 border-foreground/20'>
        <CheckCircle className='w-16 h-16 mx-auto mb-4 text-green-500' />
        <h2 className='text-2xl font-bold mb-2'>{t('Payment Successful!')}</h2>
        <p className='text-foreground/70 mb-4'>
          {t('Thank you for your purchase. Your access to this group has been granted.')}
        </p>
        {sessionId && (
          <p className='text-sm text-foreground/50 mb-6'>
            {t('Session ID')}: {sessionId}
          </p>
        )}
        <div className='flex flex-col sm:flex-row gap-4 justify-center'>
          <Button
            onClick={handleReturnToGroup}
            disabled={redirecting}
            className='min-w-[200px]'
          >
            {redirecting
              ? (
                <>
                  <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                  {t('Redirecting...')}
                </>
                )
              : (
                  t('Return to Group')
                )}
          </Button>
        </div>
        <p className='text-xs text-foreground/50 mt-4'>
          {t('You will be redirected automatically in a few seconds...')}
        </p>
      </div>
    </div>
  )
}
