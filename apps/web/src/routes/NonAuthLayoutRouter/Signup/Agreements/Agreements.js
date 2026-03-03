import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import Button from 'components/ui/button'
import Icon from 'components/Icon'
import logout from 'store/actions/logout'
import { cn } from 'util/index'

/**
 * SafeLink component - Renders an external link safely
 */
function SafeLink ({ href, children, className }) {
  return (
    <a 
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  )
}

export default function Agreements () {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [accepted, setAccepted] = useState(false)

  const handleCancel = () => {
    if (window.confirm(t("We're almost done, are you sure you want to cancel?"))) {
      dispatch(logout()).then(() => {
        navigate('/signup')
      })
    }
  }

  const handleAccept = () => {
    if (accepted) {
      // Navigate to finish registration
      navigate('/signup/finish')
    }
  }

  const handleCheckboxChange = (e) => {
    setAccepted(e.target.checked)
  }

  return (
    <div className='bg-background shadow-lg rounded-lg w-[320px] md:w-[640px] max-h-[70vh] flex flex-col mt-20'>
      <div className='relative flex-1 overflow-y-auto'>
        <Icon
          name='Ex'
          className='absolute top-2 right-2 text-sm cursor-pointer text-muted-foreground hover:text-foreground transition-colors z-10'
          onClick={handleCancel}
        />
        <div className='p-6'>
          <h1 className='text-2xl font-bold text-foreground text-center mb-2'>{t('agreementTitle')}</h1>
          <p className='text-sm text-muted-foreground text-center mb-6'>{t('agreementSubtitle')}</p>

          <div className='space-y-4 text-sm text-foreground/80 leading-relaxed'>
            <p>
              {t('agreementChunk1', {
                codeOfConductLink: '',
                termsOfUseLink: '',
                fullAgreementsLink: ''
              })}
              <SafeLink 
                href="https://www.hylo.com/agreements/#code-of-conduct"
                className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
              >
                {t('codeOfConductText')}
              </SafeLink>
              {' '}{t('and')}{' '}
              <SafeLink 
                href="https://www.hylo.com/terms/"
                className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
              >
                {t('termsOfUseText')}
              </SafeLink>
              .
            </p>
            <div className='space-y-3'>
              <p className='font-medium text-foreground flex items-start gap-2'>
                <span className='text-blue-600'>•</span>
                <span>{t('agreementChunk2')}</span>
              </p>
              <p className='font-medium text-foreground flex items-start gap-2'>
                <span className='text-blue-600'>•</span>
                <span>{t('agreementChunk3')}</span>
              </p>
              <p className='font-medium text-foreground flex items-start gap-2'>
                <span className='text-blue-600'>•</span>
                <span>{t('agreementChunk4')}</span>
              </p>
              <p className='font-medium text-foreground flex items-start gap-2'>
                <span className='text-blue-600'>•</span>
                <span>{t('agreementChunk5')}</span>
              </p>
              <p className='font-medium text-foreground flex items-start gap-2'>
                <span className='text-blue-600'>•</span>
                <span>{t('agreementChunk6')}</span>
              </p>
              <p className='font-medium text-foreground flex items-start gap-2'>
                <span className='text-blue-600'>•</span>
                <span>{t('agreementChunk7')}</span>
              </p>
              <p>
                <SafeLink 
                  href="https://www.hylo.com/agreements/#hylo-platform-agreements"
                  className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                >
                  {t('viewDetailedAgreements')}
                </SafeLink>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className='p-6 border-t border-foreground/10 bg-background'>
        <div className='space-y-4'>
          <div className='flex items-start gap-3'>
            <input
              type='checkbox'
              id='accept-agreements'
              checked={accepted}
              onChange={handleCheckboxChange}
              className='w-4 h-4 text-primary bg-input border-foreground/20 rounded focus:ring-primary focus:ring-2'
            />
            <label htmlFor='accept-agreements' className='text-sm text-foreground/80 leading-relaxed'>
              {t('acceptAgreements')}
            </label>
          </div>

          <Button
            className={cn(
              'w-full text-center rounded-2xl flex items-center justify-center px-5 py-2 transition-colors',
              accepted ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
            onClick={handleAccept}
            disabled={!accepted}
          >
            {t('Continue')}
          </Button>
        </div>
      </div>
    </div>
  )
}
