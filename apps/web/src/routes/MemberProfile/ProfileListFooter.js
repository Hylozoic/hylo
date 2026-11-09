import React from 'react'
import Loading from 'components/Loading'

export default function ProfileListFooter ({ t, settled, hasMore, loadingMore, hasItems, sentinelRef }) {
  return (
    <>
      {loadingMore && <Loading />}
      {settled && !hasMore && !loadingMore && hasItems && (
        <div className='text-center text-gray-500 py-4'>{t('No more activity to load')}</div>
      )}
      <div ref={sentinelRef} />
    </>
  )
}
