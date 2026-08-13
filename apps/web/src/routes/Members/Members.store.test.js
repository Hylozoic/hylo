import { buildKey } from 'store/reducers/queryResults'
import { FETCH_MEMBERS, getMemberQueryProps } from './Members.store'

describe('getMemberQueryProps', () => {
  it('builds the same cache key params used when storing fetch results', () => {
    const variables = {
      slug: 'building-hylo',
      groupId: '20866',
      first: 20,
      offset: 0,
      sortBy: 'name',
      order: 'asc',
      search: undefined,
      groupRoleId: null
    }

    const lookupProps = getMemberQueryProps({
      slug: 'building-hylo',
      sortBy: 'name',
      search: undefined,
      groupRoleId: null
    })

    const storeParams = getMemberQueryProps(variables)

    expect(lookupProps).toEqual({
      slug: 'building-hylo',
      sortBy: 'name',
      groupRoleId: null,
      order: 'asc'
    })
    expect(storeParams).toEqual(lookupProps)
    expect(buildKey(FETCH_MEMBERS, lookupProps)).toEqual(buildKey(FETCH_MEMBERS, storeParams))
  })

  it('uses desc order for join date sort', () => {
    expect(getMemberQueryProps({ slug: 'foo', sortBy: 'join' }).order).toBe('desc')
  })
})
