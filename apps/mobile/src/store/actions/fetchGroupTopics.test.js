import fetchGroupTopics from './fetchGroupTopics'

it('matches snapshot with groupId', () => {
  expect(fetchGroupTopics(765, {
    subscribed: true,
    first: 7,
    offset: 3,
    sortBy: 'name',
    autocomplete: 'a'
  })).toMatchSnapshot()
})

it('matches snapshot without groupId', () => {
  expect(fetchGroupTopics(null, {})).toMatchSnapshot()
})
