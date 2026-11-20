import React from 'react'
import { PRO_PLUS_UPLOAD_LIMIT_BYTES, PRO_UPLOAD_LIMIT_BYTES } from '@hylo/shared'
import { filestackPicker } from 'client/filestack'
import orm from 'store/models'
import { AllTheProviders, fireEvent, render, screen } from 'util/testing/reactTestingLibraryExtended'
import UploadAttachmentButton from './UploadAttachmentButton'

jest.mock('client/filestack', () => ({
  ...jest.requireActual('client/filestack'),
  filestackPicker: jest.fn(() => ({ open: jest.fn() }))
}))

function stateWithGroups () {
  const session = orm.mutableSession(orm.getEmptyState())
  session.Group.create({ id: '1', name: 'Pro', proFeatures: { largerUploads: true } })
  session.Group.create({ id: '2', name: 'Free', proFeatures: { largerUploads: false } })
  session.Group.create({ id: '3', name: 'Pro Plus', proFeatures: { largerUploads: true, higherUploadLimits: true } })
  return { orm: session.state }
}

describe('UploadAttachmentButton', () => {
  beforeEach(() => filestackPicker.mockClear())

  const renderButton = props => render(
    <UploadAttachmentButton type='post' id='new' attachmentType='file' onSuccess={() => {}} {...props} />,
    {},
    AllTheProviders(stateWithGroups())
  )

  it('opens the picker with the free limit for a group without Hylo Pro', () => {
    renderButton({ groupIds: ['2'] })
    fireEvent.click(screen.getByTestId('upload-attachment-button'))
    expect(filestackPicker).toHaveBeenCalledWith(expect.objectContaining({ attachmentType: 'file', maxSize: 52428800 }))
  })

  it('opens the picker with the Pro limit for a group with largerUploads', () => {
    renderButton({ groupIds: ['1'] })
    fireEvent.click(screen.getByTestId('upload-attachment-button'))
    expect(filestackPicker).toHaveBeenCalledWith(expect.objectContaining({ maxSize: PRO_UPLOAD_LIMIT_BYTES }))
  })

  it('opens the picker with the Pro Plus limit for a group with higherUploadLimits', () => {
    renderButton({ groupIds: ['3'] })
    fireEvent.click(screen.getByTestId('upload-attachment-button'))
    expect(filestackPicker).toHaveBeenCalledWith(expect.objectContaining({ maxSize: PRO_PLUS_UPLOAD_LIMIT_BYTES }))
  })

  it('uses the free limit with no groups (a direct message)', () => {
    renderButton()
    fireEvent.click(screen.getByTestId('upload-attachment-button'))
    expect(filestackPicker).toHaveBeenCalledWith(expect.objectContaining({ maxSize: 52428800 }))
  })
})
