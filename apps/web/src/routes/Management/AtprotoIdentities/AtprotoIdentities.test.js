import React from 'react'
import { render, screen, fireEvent, waitFor } from 'util/testing/reactTestingLibraryExtended'
import AtprotoIdentities from './AtprotoIdentities'

const metrics = (overrides = {}) => ({
  instance: {
    enabled: true,
    sandbox: true,
    plcUrl: 'https://plc.atmosbox.test',
    productionPlc: false,
    pdsUrl: 'https://pds.hylo.atmosbox.test',
    handleDomain: 'hylo.atmosbox.test',
    allowedEmailDomains: ['hylo.com', 'terran.io'],
    allowlistSize: 0
  },
  identities: { active: 2, pending: 1, tombstoned: 0, total: 3 },
  eligibleWithoutIdentity: 97,
  foreignIdentities: 0,
  stuckPending: [],
  stuckPendingMinutes: 10,
  createdPerDay: [{ day: '2026-10-26', count: 2 }],
  tombstonedPerDay: [],
  days: 30,
  recent: [{
    user_id: 42,
    user_name: 'Tom',
    handle: 'tom.hylo.atmosbox.test',
    did: 'did:plc:rgljtthttmpthhoqtio7fig5',
    status: 'active',
    created_at: '2026-10-26T00:00:00Z'
  }],
  ...overrides
})

const jsonResponse = (body, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) })

// The test setup's MSW server wraps global.fetch, so spy on it rather than replacing it
const mockFetch = impl => jest.spyOn(global, 'fetch').mockImplementation(impl)

describe('AtprotoIdentities', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('shows the instance, counts and recent identities', async () => {
    mockFetch(() => jsonResponse(metrics()))
    render(<AtprotoIdentities />)

    expect(await screen.findByText('AT Protocol Identities')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/noo/admin/atproto-metrics', { credentials: 'include' })
    expect(screen.getByText('https://plc.atmosbox.test')).toBeInTheDocument()
    expect(screen.getByText('*.hylo.atmosbox.test')).toBeInTheDocument()
    expect(screen.getByText('97')).toBeInTheDocument()
    expect(screen.getByText('tom.hylo.atmosbox.test')).toBeInTheDocument()
    expect(screen.getByText('2026-10-26')).toBeInTheDocument()
    expect(screen.queryByText('Stuck pending')).not.toBeInTheDocument()
  })

  it('flags production PLC, foreign identities and stuck pending ones', async () => {
    mockFetch(() => jsonResponse(metrics({
      instance: { ...metrics().instance, sandbox: false, productionPlc: true, plcUrl: 'https://plc.directory' },
      foreignIdentities: 3,
      stuckPending: [{ user_id: 7, handle: 'stuck.hylo.com', did: 'did:plc:stuck', created_at: '2026-10-26T00:00:00Z' }]
    })))
    render(<AtprotoIdentities />)

    expect(await screen.findByText('Public production directory')).toBeInTheDocument()
    expect(screen.getByText('yarn atproto purge-foreign --yes')).toBeInTheDocument()
    expect(screen.getByText('Stuck pending')).toBeInTheDocument()
    expect(screen.getByText('stuck.hylo.com')).toBeInTheDocument()
  })

  it('warns when the feature is off', async () => {
    mockFetch(() => jsonResponse(metrics({ instance: { ...metrics().instance, enabled: false } })))
    render(<AtprotoIdentities />)

    expect(await screen.findByText(/turned off on this instance/)).toBeInTheDocument()
    expect(screen.getByText('Verify sample')).toBeDisabled()
  })

  it('verifies a sample and shows problems', async () => {
    mockFetch(url => url === '/noo/admin/atproto-verify-sample'
      ? jsonResponse({
        results: [
          { handle: 'tom.hylo.atmosbox.test', did: 'did:plc:good', problems: [] },
          { handle: 'drift.hylo.atmosbox.test', did: 'did:plc:bad', problems: ['handle mismatch: PLC has at://other'] }
        ]
      })
      : jsonResponse(metrics()))
    render(<AtprotoIdentities />)

    fireEvent.click(await screen.findByText('Verify sample'))
    await waitFor(() => expect(screen.getByText('handle mismatch: PLC has at://other')).toBeInTheDocument())
    expect(screen.getByText('drift.hylo.atmosbox.test')).toBeInTheDocument()
    expect(global.fetch).toHaveBeenCalledWith('/noo/admin/atproto-verify-sample', expect.objectContaining({ method: 'POST' }))
  })

  it('shows an error when metrics fail to load', async () => {
    mockFetch(() => jsonResponse({}, false))
    render(<AtprotoIdentities />)

    expect(await screen.findByText(/Server returned 500/)).toBeInTheDocument()
  })
})
