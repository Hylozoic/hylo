import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import updatePost, { afterUpdatingPost, getEventChanges } from './updatePost'

describe('updatePost', () => {
  let user, post

  before(() => {
    user = factories.user()
    return user.save()
    .then(() => {
      post = factories.post({type: Post.Type.THREAD, user_id: user.id})
      return post.save()
    })
  })

  it('fails without ID', () => {
    try {
      return updatePost(user.id, null, {name: 'foo'})
      .then(() => {
        expect.fail('should reject')
      })
      .catch(err => {
        expect(err.message).to.equal('updatePost called with no ID')
      })
    } catch(err) {
      expect(err.message).to.equal('updatePost called with no ID')
    }
  })

  it('prevents updating non-existent posts', () => {
    const id = `${post.id}0`
    return updatePost(user.id, id, {name: 'foo'})
    .then(() => {
      expect.fail('should reject')
    })
    .catch(err => {
      expect(err.message).to.equal('Post not found')
    })
  })

  it('prevents updating of certain post types', () => {
    return updatePost(user.id, post.id, {name: 'foo'})
    .then(() => {
      expect.fail('should reject')
    })
    .catch(err => {
      expect(err.message).to.equal("This post can't be modified")
    })
  })

  it('does not set edited_at field if name or description does not change', async () => {
    const location_id = '12345'
    updatePost(user.id, post.id, {location_id})
    .then(async () => {
      post = await Post.find(post.id)
      expect(post.get('edited_at')).to.equal(undefined)
    })
  })

  it('sets edited_at field when name changes', async () => {
    const name = `${post.name}, what ho, Bertie.`
    updatePost(user.id, post.id, {name})
    .then(async () => {
      post = await Post.find(post.id)
      expect(post.get('edited_at').getTime()).to.be.closeTo(new Date().getTime(), 2000)
    })
  })

  it('sets edited_at field when description changes', async () => {
    const description = `${post.description}, I say, Jeeves!`
    updatePost(user.id, post.id, {description})
    .then(async () => {
      post = await Post.find(post.id)
      expect(post.get('edited_at').getTime()).to.be.closeTo(new Date().getTime(), 2000)
    })
  })
})

describe('afterUpdatingPost', () => {
  let u1, u2, post

  before(() => {
    u1 = factories.user()
    u2 = factories.user()
    post = factories.post()
    return setup.clearDb()
      .then(() => Tag.findOrCreate('request'))
      .then(() => Promise.join(u1.save(), u2.save()))
      .then(() => post.save())
      .then(() => post.addFollowers([u1.id]))
  })

  it('adds new followers if there are new mentions', async () => {
    const description = `hello <span class="mention" data-type="mention" data-id="${u2.id}" data-label="person">person</span>`
    await post.save({description}, {patch: true})
    await afterUpdatingPost(post, {params: {}})

    const followers = await post.followers().fetch()

    expect(followers.pluck('id').sort()).to.deep.equal([u1.id, u2.id].sort())
  })

  it('does not remove existing images if the imageUrls param is absent')
  it('removes existing images if the imageUrls param is empty')
})

describe('getEventChanges', () => {
  let baseStartTime, baseEndTime, baseLocation, post, params

  before(() => {
    baseStartTime = new Date('2024-01-01T10:00:00Z')
    baseEndTime = new Date('2024-01-01T12:00:00Z')
    baseLocation = 'Original Location'
    post = {
      get: (key) => {
        if (key === 'start_time') return baseStartTime
        if (key === 'end_time') return baseEndTime
        if (key === 'location') return baseLocation
      }
    }
    params = {
      startTime: baseStartTime,
      endTime: baseEndTime,
      location: baseLocation
    }
  })

  it('returns false when no changes', () => {
    const result = getEventChanges({ post, params })

    expect(result.start_time).to.equal(false)
    expect(result.end_time).to.equal(false)
    expect(result.location).to.equal(false)
  })

  it('returns new value for start_time when it has changed', () => {
    const newStartTime = new Date('2024-01-01T11:00:00Z')
    params.startTime = newStartTime

    const result = getEventChanges({ post, params })

    expect(result.start_time).to.equal(newStartTime)
  })

  it('returns new value for end_time when it has changed', () => {
    const newEndTime = new Date('2024-01-01T14:00:00Z')
    params.endTime = newEndTime

    const result = getEventChanges({ post, params })

    expect(result.end_time).to.equal(newEndTime)
  })

  it('returns new value for location when it has changed', () => {
    const newLocation = 'New Location'
    params.location = newLocation

    const result = getEventChanges({ post, params })

    expect(result.location).to.equal(newLocation)
  })

  describe('edge cases', () => {
    beforeEach(() => {
      // Reset params to base values before each test
      params.startTime = baseStartTime
      params.endTime = baseEndTime
      params.location = baseLocation
    })

    it('handles empty string location change', () => {
      params.location = ''

      const result = getEventChanges({ post, params })

      expect(result.start_time).to.equal(false)
      expect(result.end_time).to.equal(false)
      expect(result.location).to.equal('')
    })

    it('handles null location change', () => {
      params.location = null

      const result = getEventChanges({ post, params })

      expect(result.start_time).to.equal(false)
      expect(result.end_time).to.equal(false)
      expect(result.location).to.equal(null)
    })

    it('handles same time value but different Date objects', () => {
      // Create new Date objects with same time value
      const sameStartTime = new Date(baseStartTime.getTime())
      const sameEndTime = new Date(baseEndTime.getTime())
      params.startTime = sameStartTime
      params.endTime = sameEndTime

      const result = getEventChanges({ post, params })

      // Should return false because times are equal
      expect(result.start_time).to.equal(false)
      expect(result.end_time).to.equal(false)
      expect(result.location).to.equal(false)
    })

    it('handles location change from null to string', () => {
      const postWithNullLocation = {
        get: (key) => {
          if (key === 'start_time') return baseStartTime
          if (key === 'end_time') return baseEndTime
          if (key === 'location') return null
        }
      }
      params.location = 'New Location'

      const result = getEventChanges({ post: postWithNullLocation, params })

      expect(result.start_time).to.equal(false)
      expect(result.end_time).to.equal(false)
      expect(result.location).to.equal('New Location')
    })

    it('handles location change from string to null', () => {
      params.location = null

      const result = getEventChanges({ post, params })

      expect(result.start_time).to.equal(false)
      expect(result.end_time).to.equal(false)
      expect(result.location).to.equal(null)
    })

    it('handles location change from empty string to non-empty', () => {
      const postWithEmptyLocation = {
        get: (key) => {
          if (key === 'start_time') return baseStartTime
          if (key === 'end_time') return baseEndTime
          if (key === 'location') return ''
        }
      }
      params.location = 'New Location'

      const result = getEventChanges({ post: postWithEmptyLocation, params })

      expect(result.start_time).to.equal(false)
      expect(result.end_time).to.equal(false)
      expect(result.location).to.equal('New Location')
    })

    it('handles very small time differences (milliseconds)', () => {
      const slightlyDifferentStartTime = new Date(baseStartTime.getTime() + 1) // 1ms difference
      params.startTime = slightlyDifferentStartTime

      const result = getEventChanges({ post, params })

      expect(result.start_time).to.equal(slightlyDifferentStartTime)
      expect(result.end_time).to.equal(false)
      expect(result.location).to.equal(false)
    })
  })
})
