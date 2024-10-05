import { render } from '@testing-library/react-native'
import orm from 'store/models'
import { TestRoot } from 'util/testing'
import MockedScreen from 'util/testing/MockedScreen'
import TabStackHeader, { MenuButton, NotificationsIcon } from './TabStackHeader'

describe('TabStackHeader', () => {
  it('renders correctly', () => {
    const { toJSON } = render(
      <TestRoot>
        <MockedScreen>
          {screenProps => (
            <TabStackHeader {...screenProps} options={{ headerTitle: 'Test Screen' }} />
          )}
        </MockedScreen>
      </TestRoot>
    )

    expect(toJSON()).toMatchSnapshot()
  })
})

describe('MenuButton', () => {
  it('renders correctly', () => {
    const { toJSON } = render(
      <TestRoot>
        <MockedScreen>
          {screenProps => (
            <MenuButton {...screenProps} />
          )}
        </MockedScreen>
      </TestRoot>
    )

    expect(toJSON()).toMatchSnapshot()
  })
})

describe('NotificationsIcon', () => {
  it('matches the last snapshot', () => {
    const session = orm.session(orm.getEmptyState())
    session.Me.create({
      name: 'me',
      newNotificationCount: 12
    })
    const state = { orm: session.state }
    const { toJSON } = render(
      <TestRoot state={state}>
        <NotificationsIcon showNotifications={() => {}} />
      </TestRoot>
    )

    /*

    The `showBadge` prop on `Icon` should be set to `true`.

    Given that there is not textual content to look for,
    the RTL way to do this is to either mock the `Icon`
    component and check `toHaveBeenCalledWith` on the mock
    with the expected prop value/s...

    */

    expect(toJSON()).toMatchSnapshot()
  })
})
