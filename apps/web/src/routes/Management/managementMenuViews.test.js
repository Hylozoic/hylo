import { displayNameForView, getStaticMenuViews } from '@hylo/presenters/GroupViewPresenter'

const labels = {
  'view-management-platform-health': 'Platform Health Metrics',
  'view-management-site-banners': 'Site Banners',
  'view-management-commons-requests': 'Commons Requests',
  'view-management-email-testers': 'Email Testers',
  'view-management-paid-content': 'Paid Content',
  'view-management-disputes-refunds': 'Disputes & Refunds'
}

const t = key => labels[key] || key

describe('management menu views', () => {
  it('uses the static menu list, with health first and Paid Content as a text section', () => {
    const views = getStaticMenuViews({ isManagementContext: true })

    expect(views.map(view => displayNameForView(view, t))).toEqual([
      'Platform Health Metrics',
      'Site Banners',
      'Commons Requests',
      'Email Testers',
      'Paid Content',
      'Disputes & Refunds'
    ])
    expect(views[0].link).toBe('/management/metrics')
    expect(views.find(view => view.name === 'view-management-paid-content').type).toBe('text')
    expect(views.find(view => view.name === 'view-management-disputes-refunds').link).toBe('/management/paid-content/stripe-analytics')
  })
})
