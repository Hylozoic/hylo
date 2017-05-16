import FullPageModal from './FullPageModal'
import { shallow } from 'enzyme'
import React from 'react'

describe.skip('FullPageModal', () => {
  it('renders correctly', () => {
    const history = {length: 2}
    const wrapper = shallow(<FullPageModal history={history} />)
    expect(wrapper.find('NavLink').length).toEqual(2)
    expect(wrapper.find('NavLink').at(0).prop('to')).toEqual('/settings')
    expect(wrapper.find('NavLink').at(1).prop('to')).toEqual('/settings/communities')
    expect(wrapper.find('Route').length).toEqual(2)
    expect(wrapper.find('Route').at(0).prop('path')).toEqual('/settings')
    expect(wrapper.find('Route').at(1).prop('path')).toEqual('/settings/communities')
    expect(wrapper.find('CloseButton').length).toEqual(1)
  })
})
