import React, { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import Button from 'components/ui/button'
import { requestPublicListing } from 'store/actions/publicListingRequests'
import { GROUP_VISIBILITY } from 'store/models/Group'
import SettingsSection from '../SettingsSection'

function formatDate (date) {
  return date ? new Date(date).toLocaleDateString() : ''
}

/**
 * Lets a group administrator ask the Hylo team to add their public group to the
 * commons (allowInPublic), and shows where their latest request stands.
 */
export default function CommonsRequestSection ({ group }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const request = group.publicListingRequest
  const isPending = request?.status === 'pending'
  const isDenied = request?.status === 'denied'
  // The backend only accepts requests from groups that are already saved as public
  const savedAsPublic = group.visibility === GROUP_VISIBILITY.Public

  const handleRequest = async () => {
    setSubmitting(true)
    const onError = () => toast.error(t('Something went wrong sending your request. Please try again.'))
    try {
      const result = await dispatch(requestPublicListing(group.id, message))
      if (result?.error || !result?.payload?.data?.requestPublicListing) {
        onError()
      } else {
        setMessage('')
        toast.success(t('Your request has been sent to the Hylo team'))
      }
    } catch (e) {
      onError()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SettingsSection>
      <h3 className='text-foreground font-bold mb-2'>{t('Add my group into the commons')}</h3>
      <p className='text-foreground/70 mb-2'>{t('commonsExplainerText1')}</p>
      <p className='text-foreground/70 mb-4'>{t('commonsExplainerText2')}</p>

      {isPending && (
        <div className='rounded-lg bg-selected/20 p-4' data-testid='commons-request-pending'>
          <p className='text-foreground font-medium m-0'>
            {t('Request sent on {{date}}', { date: formatDate(request.requestedAt) })}
          </p>
          <p className='text-foreground/70 text-sm m-0 mt-1'>
            {t("The Hylo team will review it and email you when they've made a decision.")}
          </p>
        </div>
      )}

      {!isPending && (
        <>
          {isDenied && (
            <div className='rounded-lg bg-foreground/5 p-4 mb-4' data-testid='commons-request-denied'>
              <p className='text-foreground font-medium m-0'>
                {t('Your request from {{date}} was not approved', { date: formatDate(request.requestedAt) })}
              </p>
              {request.reviewMessage && (
                <p className='text-foreground/70 text-sm m-0 mt-1 whitespace-pre-wrap'>{request.reviewMessage}</p>
              )}
              <p className='text-foreground/70 text-sm m-0 mt-1'>{t('You can send a new request below.')}</p>
            </div>
          )}
          <label htmlFor='commons-request-message' className='block text-sm font-medium text-foreground mb-1'>
            {t('Tell the Hylo team about your group (optional)')}
          </label>
          <textarea
            id='commons-request-message'
            className='w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground mb-3'
            value={message}
            maxLength={2000}
            onChange={e => setMessage(e.target.value)}
            placeholder={t('What is your group about, and what will it share in public?')}
          />
          {!savedAsPublic && (
            <p className='text-foreground/70 text-sm mb-3'>{t('Save your group as Public before sending a request.')}</p>
          )}
          <Button
            variant='secondary'
            disabled={submitting || !savedAsPublic}
            onClick={handleRequest}
            data-testid='commons-request-button'
          >
            {t('Request to join the commons')}
          </Button>
        </>
      )}
    </SettingsSection>
  )
}
