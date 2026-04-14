import fetchCustomView from './fetchCustomView'

describe('fetchCustomView', () => {
  it('should match latest snapshot', () => {
    expect(fetchCustomView('42')).toMatchSnapshot()
  })
})
