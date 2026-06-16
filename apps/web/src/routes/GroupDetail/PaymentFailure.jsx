import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Button from 'components/ui/button'
import { XCircle, ArrowLeft } from 'lucide-react'
import { groupUrl } from '@hylo/navigation'

/**
 * PaymentFailure Component
 *
 * Displays a message when a user cancels or fails a Stripe checkout
 * and provides options to retry or return to the group.
 */
export default function PaymentFailure () {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { groupSlug } = useParams()

  const handleReturnToGroup = () => {
    if (groupSlug) {
      navigate(groupUrl(groupSlug))
    }
  }

  const handleTryAgain = () => {
    if (groupSlug) {
      navigate(groupUrl(groupSlug))
    }
  }

  return (
    <div className='max-w-2xl mx-auto p-6'>
      <div className='bg-card p-8 rounded-lg text-center shadow-xl border-2 border-foreground/20'>
        <XCircle className='w-16 h-16 mx-auto mb-4 text-red-500' />
        <h2 className='text-2xl font-bold mb-2'>{t('Payment Cancelled')}</h2>
        <p className='text-foreground/70 mb-4'>
          {t('Your payment was cancelled. No charges were made to your account.')}
        </p>
        <p className='text-sm text-foreground/60 mb-6'>
          {t('If you experienced any issues during checkout, please try again or contact support for assistance.')}
        </p>
        <div className='flex flex-col sm:flex-row gap-4 justify-center'>
          <Button
            onClick={handleTryAgain}
            variant='secondary'
            className='min-w-[200px]'
          >
            <ArrowLeft className='w-4 h-4 mr-2' />
            {t('Try Again')}
          </Button>
          <Button
            onClick={handleReturnToGroup}
            variant='outline'
            className='min-w-[200px]'
          >
            {t('Return to Group')}
          </Button>
        </div>
      </div>
    </div>
  )
}
