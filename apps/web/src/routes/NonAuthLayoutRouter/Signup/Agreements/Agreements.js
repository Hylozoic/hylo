import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import Button from 'components/ui/button'
import Checkbox from 'components/ui/checkbox'
import Icon from 'components/Icon'
import logout from 'store/actions/logout'
import { cn } from 'util/index'

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

  const handleCheckboxChange = (value) => {
    setAccepted(!!value)
  }

  const renderAgreementText = (key) => {
    const codeOfConductLink = `<a href="https://www.hylo.com/agreements/#code-of-conduct" target="_blank" rel="noopener noreferrer" class="text-focus hover:text-selected hover:underline font-medium">${t('codeOfConductText')}</a>`
    const termsOfUseLink = `<a href="https://www.hylo.com/terms/" target="_blank" rel="noopener noreferrer" class="text-focus hover:text-selected hover:underline font-medium">${t('termsOfUseText')}</a>`
    const fullAgreementsLink = `<a href="https://www.hylo.com/agreements/#hylo-platform-agreements" target="_blank" rel="noopener noreferrer" class="text-focus hover:text-selected hover:underline font-medium">${t('agreementTitle')}</a>`

    const text = t(key, {
      codeOfConductLink,
      termsOfUseLink,
      fullAgreementsLink
    })

    return <span dangerouslySetInnerHTML={{ __html: text }} />
  }

  return (
    <div className='bg-midground shadow-md rounded-md w-[320px] md:w-[640px] max-h-[70vh] flex flex-col mt-20'>
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
            <p>{renderAgreementText('agreementChunk1')}</p>
            <div className='space-y-3'>
              <p className='font-medium text-foreground flex items-start gap-2'>
                <span className='text-focus'>•</span>
                <span>{renderAgreementText('agreementChunk2')}</span>
              </p>
              <p className='font-medium text-foreground flex items-start gap-2'>
                <span className='text-focus'>•</span>
                <span>{renderAgreementText('agreementChunk3')}</span>
              </p>
              <p className='font-medium text-foreground flex items-start gap-2'>
                <span className='text-focus'>•</span>
                <span>{renderAgreementText('agreementChunk4')}</span>
              </p>
              <p className='font-medium text-foreground flex items-start gap-2'>
                <span className='text-focus'>•</span>
                <span>{renderAgreementText('agreementChunk5')}</span>
              </p>
              <p className='font-medium text-foreground flex items-start gap-2'>
                <span className='text-focus'>•</span>
                <span>{renderAgreementText('agreementChunk6')}</span>
              </p>
              <p className='font-medium text-foreground flex items-start gap-2'>
                <span className='text-focus'>•</span>
                <span>{renderAgreementText('agreementChunk7')}</span>
              </p>
              <p>
                <a href='https://www.hylo.com/agreements/#hylo-platform-agreements' target='_blank' rel='noopener noreferrer' className='text-focus hover:text-selected hover:underline font-medium'>
                  {t('viewDetailedAgreements')}
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className='p-6 border-t border-foreground/10 bg-midground rounded-b-md'>
        <div className='space-y-4'>
          <div className='flex items-start gap-3'>
            <Checkbox
              id='accept-agreements'
              checked={accepted}
              onCheckedChange={handleCheckboxChange}
              className='mt-0.5'
            />
            <label htmlFor='accept-agreements' className='text-sm text-foreground/80 leading-relaxed cursor-pointer'>
              {t('acceptAgreements')}
            </label>
          </div>

          <Button
            variant='highVisibility'
            className={cn('w-full text-base', accepted ? 'bg-selected' : 'bg-gray-400 cursor-not-allowed')}
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
