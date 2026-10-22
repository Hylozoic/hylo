import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Button from 'components/ui/button'
import { groupUrl } from '@hylo/navigation'

export default function RetainedAccessPanel ({
  group,
  isSpace = false,
  parentGroup,
  hasActiveParentMembership = true,
  onRejoin,
  rejoining = false,
  error
}) {
  const { t } = useTranslation()
  const mustRejoinParent = isSpace && !hasActiveParentMembership

  return (
    <section className='rounded-xl border border-selected/30 bg-selected/5 p-5' aria-live='polite'>
      <h2 className='mt-0 mb-2 text-lg font-bold text-foreground'>
        {t('You still have access to {{name}}', { name: group.name })}
      </h2>
      <p className='mb-4 text-sm leading-relaxed text-foreground/75'>
        {t('You are not currently a member of {{name}}, but your access is still valid. Rejoin to participate again.', { name: group.name })}
      </p>
      {mustRejoinParent
        ? (
          <p className='mb-0 text-sm text-foreground/75'>
            {t('To rejoin this space, you need to be a member of its parent group first.')}{' '}
            {parentGroup?.slug && (
              <Link to={groupUrl(parentGroup.slug, 'about', {})} className='text-focus underline underline-offset-2'>
                {t('Go to {{name}} about page', { name: parentGroup.name })}
              </Link>
            )}
          </p>
          )
        : (
          <Button variant='highVisibility' onClick={onRejoin} disabled={rejoining}>
            {rejoining ? t('Rejoining...') : t('Rejoin {{name}}', { name: group.name })}
          </Button>
          )}
      {error && (
        <p role='alert' className='mt-3 mb-0 text-sm text-red-500'>
          {t('Your access may have expired. Refresh this page to check your options.')}
        </p>
      )}
    </section>
  )
}
