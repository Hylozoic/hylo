import { isEmpty } from 'lodash'
import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import TextareaAutosize from 'react-textarea-autosize'
import Button from 'components/ui/button'
import CheckBox from 'components/CheckBox'
import Icon from 'components/Icon'
import MultiSelect from 'components/MultiSelect'
import fetchPlatformAgreements from 'store/actions/fetchPlatformAgreements'
import { createModerationAction } from 'store/actions/moderationActions'
import { agreementsURL } from 'store/constants'
import presentGroup from 'store/presenters/presentGroup'
import getGroupForDetail from 'store/selectors/getGroupForDetails'
import getPlatformAgreements from 'store/selectors/getPlatformAgreements'
import { groupUrl } from 'util/navigation'
import Tooltip from 'components/Tooltip'

const FlagGroupContent = ({ onClose, onFlag, linkData, type = 'content' }) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const { id, slug } = linkData || {}

  useEffect(() => {
    dispatch(fetchPlatformAgreements())
  }, [])

  // Add escape key handler
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  const platformAgreements = useSelector(getPlatformAgreements)
  const currentGroup = useSelector(state => getGroupForDetail(state, { slug }))
  const group = presentGroup(currentGroup)

  const agreements = group?.agreements || []
  const groupAgreementsUrl = group ? groupUrl(group.slug) + `/group/${group.slug}` : ''

  const [anonymous, setAnonymous] = useState(false)
  const [explanation, setExplanation] = useState('')
  const explanationPlaceholder = t('What was wrong?')
  const [agreementsSelected, setAgreementsSelected] = useState([])
  const [platformAgreementsSelected, setPlatformAgreementsSelected] = useState([])

  const isValid = () => {
    if (isEmpty(agreementsSelected) && isEmpty(platformAgreementsSelected)) return false
    if (explanation.length < 5) return false
    return true
  }

  const closeModal = () => {
    if (onClose) {
      onClose()
    }
  }

  const handleAgreementsSelect = (selected) => {
    if (agreementsSelected.includes(selected)) {
      setAgreementsSelected(agreementsSelected.filter(ag => ag !== selected))
    } else {
      setAgreementsSelected([...agreementsSelected, selected])
    }
  }

  const handlePlatformAgreementsSelect = (selected) => {
    if (platformAgreementsSelected.includes(selected)) {
      setPlatformAgreementsSelected(platformAgreementsSelected.filter(ag => ag !== selected))
    } else {
      setPlatformAgreementsSelected([...platformAgreementsSelected, selected])
    }
  }

  const submit = () => {
    dispatch(createModerationAction({ text: explanation, postId: id, groupId: group.id, agreements: agreementsSelected, platformAgreements: platformAgreementsSelected, anonymous }))
    if (onFlag) {
      onFlag({ postId: id, groupId: group.id })
    }
    closeModal()
    return true
  }

  return (
    <div className='fixed inset-0 z-[1001] overflow-y-auto pointer-events-auto' onClick={(e) => e.stopPropagation()}>
      <div className='fixed inset-0 bg-black/50 z-0 w-full h-full top-0 left-0' onClick={closeModal} />
      <div className='relative max-h-screen flex items-center justify-center p-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-[750px] w-full'>
        <div className='relative bg-background rounded-lg shadow-xl w-full max-w-[750px] p-6'>
          <div className='flex flex-row items-center justify-between mb-4'>
            <h2 className='text-xl font-semibold'>{t('Explanation for Flagging')}</h2>
            <button onClick={closeModal} className='text-foreground/70 hover:text-foreground transition-colors'>
              <Icon name='Ex' className='w-5 h-5' />
            </button>
          </div>

          <div className='space-y-4 max-h-[80vh] overflow-y-auto pr-2'>
            <div className='text-foreground/70 text-sm'>
              {t('flaggingExplainer')}
            </div>
            <div className='text-accent text-sm font-medium'>
              {t('flagsNeedACategory')}
            </div>
            <TextareaAutosize
              className='w-full min-h-[120px] p-3 rounded-lg border-2 border-foreground/10 bg-transparent text-foreground/80 focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-foreground/50'
              minRows={4}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder={explanationPlaceholder}
            />
            {group && agreements.length > 0 && (
              <div className='space-y-3'>
                <h3 className='text-base font-medium'>{t('Not permitted in {{groupName}}', { groupName: group?.name })}</h3>
                <a
                  href={groupAgreementsUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-foreground/50 hover:text-foreground/80 text-sm border-2 border-foreground/10 rounded-lg p-1 px-2 w-fit block hover:scale-105 transition-all'
                >
                  {t('View group agreements')}
                </a>
                <MultiSelect items={agreements} selected={agreementsSelected} handleSelect={handleAgreementsSelect} />
              </div>
            )}
            <div className='space-y-3'>
              <h3 className='text-base font-medium'>{t('Violations of platform agreements')}</h3>
              <a
                href={agreementsURL}
                target='_blank'
                rel='noopener noreferrer'
                className='text-foreground/50 hover:text-foreground/80 text-sm border-2 border-foreground/10 rounded-lg p-1 px-2 w-fit block hover:scale-105 transition-all'
              >
                {t('View platform agreements')}
              </a>
              <div className='space-y-2'>
                <h5 className='text-sm font-medium text-foreground/70'>{t('Not permitted in Public Spaces')}</h5>
                <MultiSelect
                  items={platformAgreements.filter((ag) => ag.type !== 'anywhere')}
                  selected={platformAgreementsSelected}
                  handleSelect={handlePlatformAgreementsSelect}
                />
              </div>
              <div className='space-y-2'>
                <h5 className='text-sm font-medium text-foreground/70'>{t('Not permitted anywhere on the platform')}</h5>
                <MultiSelect
                  items={platformAgreements.filter((ag) => ag.type === 'anywhere')}
                  selected={platformAgreementsSelected}
                  handleSelect={handlePlatformAgreementsSelect}
                />
              </div>
            </div>
            <div className='flex items-center justify-between pt-2 border-t border-foreground/10'>
              <CheckBox
                checked={anonymous}
                label={t('Anonymous (moderators will see your name)')}
                onChange={value => setAnonymous(value)}
                className='text-sm text-foreground/70'
              />
              <Button
                variant='secondary'
                onClick={submit}
                disabled={!isValid()}
                data-tooltip-content={t('Select an agreement and add an explanation for why you are flagging this post')}
                data-tooltip-id='flagging-submit-tt'
              >
                {t('Submit')}
              </Button>
              <Tooltip
                id='flagging-submit-tt'
                delay={250}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FlagGroupContent
