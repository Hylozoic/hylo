import { HeartHandshake } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import SupportHyloModal from 'components/SupportHyloModal/SupportHyloModal'
import { Switch } from 'components/ui/switch'
import { fetchGroupSupporterInfo, setSupporterBadgeVisibility } from 'store/actions/supportHylo'
import SettingsSection from '../SettingsSection'

/**
 * Group settings: the group's Hylo supporter badge (#1754). A group is a
 * supporter when an admin counts their contribution for it (or the Hylo team
 * gives it supporter status). The badge is off by default and saves at once.
 * Renders nothing for people who aren't group administrators.
 */
export default function GroupSupporterSection ({ group }) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [info, setInfo] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (!group?.id) return
    dispatch(fetchGroupSupporterInfo(group.id))
      .then(res => setInfo(res?.payload?.data?.groupSupporterInfo || null))
      .catch(() => setInfo(null))
  }, [group?.id])

  if (!info) return null

  const isSupporter = info.supporterStatus === 'supporter'

  const handleToggle = async show => {
    setInfo(prev => ({ ...prev, showSupporterBadge: show }))
    try {
      await dispatch(setSupporterBadgeVisibility({ groupId: group.id, show }))
    } catch (e) {
      setInfo(prev => ({ ...prev, showSupporterBadge: !show }))
    }
  }

  return (
    <SettingsSection>
      <div data-testid='group-supporter-section'>
        <h3 className='text-foreground text-xl mb-2 mt-0 flex items-center gap-2'>
          <HeartHandshake className='h-5 w-5 text-pink-500' aria-hidden='true' />
          {t('Hylo supporter badge')}
        </h3>
        {isSupporter
          ? (
            <>
              <div className='flex items-center justify-between gap-4'>
                <label htmlFor='group-show-supporter-badge' className='text-foreground text-sm'>
                  {t('Show a supporter badge on this group')}
                </label>
                <Switch
                  id='group-show-supporter-badge'
                  data-testid='group-show-supporter-badge'
                  checked={!!info.showSupporterBadge}
                  onCheckedChange={handleToggle}
                />
              </div>
              <p className='text-foreground/60 text-xs mt-2 mb-0'>{t('Only shows that this group supports Hylo, never how much.')}</p>
            </>
            )
          : (
            <>
              <p className='text-foreground/80 text-sm'>
                {t('Groups become Hylo supporters when an administrator who supports Hylo counts their contribution for the group.')}
              </p>
              <button
                type='button'
                onClick={() => setModalOpen(true)}
                className='rounded-md border-2 border-foreground/20 px-3 py-1.5 text-sm font-medium text-foreground hover:border-foreground/50'
              >
                {t('Support Hylo for this group')}
              </button>
              <SupportHyloModal open={modalOpen} onOpenChange={setModalOpen} initialGroupId={group.id} />
            </>
            )}
      </div>
    </SettingsSection>
  )
}
