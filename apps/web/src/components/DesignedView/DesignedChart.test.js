import React from 'react'
import { render, screen, fireEvent, within } from 'util/testing/reactTestingLibraryExtended'
import DesignedView from './DesignedView'

jest.mock('./useDesignedViewBlockData', () => ({
  __esModule: true,
  default: () => ({ items: [], loading: false, error: null })
}))

const harvest = [
  { label: 'June', value: 120 },
  { label: 'July', value: 310 },
  { label: 'August', value: 455 },
  { label: 'September', value: 290 }
]

const chart = extra => ({ type: 'chart', kind: 'bar', title: 'Harvest by month (lbs)', points: harvest, ...extra })
const renderBlocks = blocks => render(<DesignedView groupSlug='garden' design={{ blocks }} />)

describe('DesignedChart', () => {
  it('draws one bar per point, with a summary for screen readers and the figures in a table', () => {
    renderBlocks([chart({ source: 'From the harvest log' })])

    expect(screen.getAllByTestId('designed-chart-bar')).toHaveLength(4)
    const svg = screen.getByRole('img', { name: /Harvest by month/ })
    expect(svg.getAttribute('aria-label')).toEqual('Bar chart, Harvest by month (lbs): June 120, July 310, August 455, September 290')
    expect(screen.getByText('Harvest by month (lbs)')).toBeInTheDocument()
    expect(screen.getByText('Source: From the harvest log')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Show the figures'))
    const rows = within(screen.getByRole('table')).getAllByRole('row')
    expect(rows).toHaveLength(5)
    expect(rows[3]).toHaveTextContent('August455')
  })

  it('lays bars out in rows when their labels would not fit side by side', () => {
    const long = Array.from({ length: 12 }, (_, i) => ({ label: `Community plot ${i + 1}`, value: i * 10 }))
    renderBlocks([chart({ points: long })])
    expect(screen.getAllByTestId('designed-chart-bar')).toHaveLength(12)
    expect(screen.getByTestId('designed-chart-svg').getAttribute('height')).toEqual(String(12 * 40))
  })

  it('draws a line with a point per figure', () => {
    renderBlocks([chart({ kind: 'line', title: 'Members', points: [{ label: '2022', value: 31 }, { label: '2023', value: 40 }, { label: '2024', value: 52.5 }] })])
    expect(screen.getAllByTestId('designed-chart-point')).toHaveLength(3)
    expect(document.querySelector('[data-block="chart"] path').getAttribute('d')).toMatch(/^M/)
    expect(screen.getByRole('img', { name: 'Line chart, Members: 2022 31, 2023 40, 2024 52.5' })).toBeInTheDocument()
  })

  it('draws a pie with a slice per part and each part\'s share', () => {
    renderBlocks([chart({ kind: 'pie', title: 'Beds', points: [{ label: 'Beans', value: 3 }, { label: 'Kale', value: 1 }] })])
    expect(screen.getAllByTestId('designed-chart-slice')).toHaveLength(2)
    expect(screen.getByText('Share of total')).toBeInTheDocument()
    expect(screen.getAllByText('75%').length).toBeGreaterThan(0)
  })

  it('works inside columns and canvas regions', () => {
    renderBlocks([
      { type: 'columns', columns: [[chart({ title: 'Left' })], [{ type: 'divider' }]] },
      { type: 'canvas', regions: [{ title: 'Figures', col: 0, row: 0, blocks: [chart({ title: 'In a region', kind: 'pie' })] }, { title: 'Other', col: 1, row: 0, blocks: [{ type: 'divider' }] }] }
    ])
    expect(screen.getByText('Left')).toBeInTheDocument()
    expect(screen.getByText('In a region')).toBeInTheDocument()
  })

  it('drops a chart with bad figures and keeps the rest of the page', () => {
    renderBlocks([
      chart({ title: 'Broken', points: [{ label: 'June', value: 'lots' }, { label: 'July', value: 2 }] }),
      chart({ title: 'Not finite', points: [{ label: 'June', value: Infinity }, { label: 'July', value: 2 }] }),
      chart({ title: 'Code', points: harvest, svg: '<script>alert(1)</script>' }),
      { type: 'text', text: 'Still here' }
    ])
    expect(screen.queryByText('Broken')).toBeNull()
    expect(screen.queryByText('Not finite')).toBeNull()
    expect(screen.queryByText('Code')).toBeNull()
    expect(document.querySelector('[data-block="chart"]')).toBeNull()
    expect(screen.getByText('Still here')).toBeInTheDocument()
  })
})
