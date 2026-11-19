import React from 'react'
import { FREE_UPLOAD_LIMIT_BYTES, PRO_UPLOAD_LIMIT_BYTES } from '@hylo/shared'
import orm from 'store/models'
import { AllTheProviders, render, screen } from 'util/testing/reactTestingLibraryExtended'
import useUploadLimit, { getLargerUploadsForGroupIds } from './useUploadLimit'

function Probe ({ groupIds }) {
  return <span data-testid='probe'>{useUploadLimit(groupIds)}</span>
}

function stateWithGroups () {
  const session = orm.mutableSession(orm.getEmptyState())
  session.Group.create({ id: '1', name: 'Pro', proFeatures: { largerUploads: true } })
  session.Group.create({ id: '2', name: 'Free', proFeatures: { largerUploads: false } })
  session.Group.create({ id: '3', name: 'Not fetched in detail' })
  return { orm: session.state }
}

describe('useUploadLimit', () => {
  const renderProbe = groupIds => render(<Probe groupIds={groupIds} />, {}, AllTheProviders(stateWithGroups()))

  it('gives the Pro limit when every group has largerUploads', () => {
    renderProbe(['1'])
    expect(screen.getByTestId('probe')).toHaveTextContent(String(PRO_UPLOAD_LIMIT_BYTES))
  })

  it('gives the free limit without groups, for a group without the feature, or for a mix', () => {
    renderProbe(undefined)
    expect(screen.getByTestId('probe')).toHaveTextContent(String(FREE_UPLOAD_LIMIT_BYTES))
    const state = stateWithGroups()
    expect(getLargerUploadsForGroupIds(state, [])).toBe(false)
    expect(getLargerUploadsForGroupIds(state, ['2'])).toBe(false)
    expect(getLargerUploadsForGroupIds(state, ['1', '2'])).toBe(false)
    expect(getLargerUploadsForGroupIds(state, ['1', '3'])).toBe(false)
    expect(getLargerUploadsForGroupIds(state, ['1', '999'])).toBe(false)
    expect(getLargerUploadsForGroupIds(state, ['1'])).toBe(true)
  })
})
