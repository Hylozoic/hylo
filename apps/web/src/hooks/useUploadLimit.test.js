import React from 'react'
import { FREE_UPLOAD_LIMIT_BYTES, PRO_PLUS_UPLOAD_LIMIT_BYTES, PRO_UPLOAD_LIMIT_BYTES } from '@hylo/shared'
import orm from 'store/models'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import useUploadLimit, { getUploadLimitForGroupIds } from './useUploadLimit'

function Probe ({ groupIds }) {
  return <span data-testid='probe'>{useUploadLimit(groupIds)}</span>
}

function stateWithGroups () {
  const session = orm.mutableSession(orm.getEmptyState())
  session.Group.create({ id: '1', name: 'Pro', proFeatures: { largerUploads: true, higherUploadLimits: false } })
  session.Group.create({ id: '2', name: 'Free', proFeatures: { largerUploads: false } })
  session.Group.create({ id: '3', name: 'Not fetched in detail' })
  session.Group.create({ id: '4', name: 'Pro Plus', proFeatures: { largerUploads: true, higherUploadLimits: true } })
  return { orm: session.state }
}

describe('useUploadLimit', () => {
  const renderProbe = groupIds => render(<Probe groupIds={groupIds} />, {}, AllTheProviders(stateWithGroups()))

  it('gives the Pro limit to a group with largerUploads', () => {
    renderProbe(['1'])
    expect(screen.getByTestId('probe')).toHaveTextContent(String(PRO_UPLOAD_LIMIT_BYTES))
  })

  it('gives the Pro Plus limit to a group with higherUploadLimits', () => {
    renderProbe(['4'])
    expect(screen.getByTestId('probe')).toHaveTextContent(String(PRO_PLUS_UPLOAD_LIMIT_BYTES))
  })

  it('gives the free limit without groups or for a group without the features, and the highest limit for a mix', () => {
    renderProbe(undefined)
    expect(screen.getByTestId('probe')).toHaveTextContent(String(FREE_UPLOAD_LIMIT_BYTES))
    const state = stateWithGroups()
    expect(getUploadLimitForGroupIds(state, [])).toBe(FREE_UPLOAD_LIMIT_BYTES)
    expect(getUploadLimitForGroupIds(state, ['2'])).toBe(FREE_UPLOAD_LIMIT_BYTES)
    expect(getUploadLimitForGroupIds(state, ['3', '999'])).toBe(FREE_UPLOAD_LIMIT_BYTES)
    expect(getUploadLimitForGroupIds(state, ['2', '1'])).toBe(PRO_UPLOAD_LIMIT_BYTES)
    expect(getUploadLimitForGroupIds(state, ['1', '3'])).toBe(PRO_UPLOAD_LIMIT_BYTES)
    expect(getUploadLimitForGroupIds(state, ['1', '999'])).toBe(PRO_UPLOAD_LIMIT_BYTES)
    expect(getUploadLimitForGroupIds(state, ['2', '1', '4'])).toBe(PRO_PLUS_UPLOAD_LIMIT_BYTES)
    expect(getUploadLimitForGroupIds(state, ['4', '1'])).toBe(PRO_PLUS_UPLOAD_LIMIT_BYTES)
    expect(getUploadLimitForGroupIds(state, ['4', '4'])).toBe(PRO_PLUS_UPLOAD_LIMIT_BYTES)
  })
})
