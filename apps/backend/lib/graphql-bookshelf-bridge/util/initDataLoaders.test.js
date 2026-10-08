import DataLoader from 'dataloader'
import { clearDataLoaderCaches, makeModelLoader } from './initDataLoaders'

const makeMockModel = () => ({
  collection: () => ({
    tableName: () => 'mock_models'
  }),
  where: spy(function () {
    return {
      fetchAll: () => Promise.resolve(this.mockData)
    }
  })
})

describe('makeModelLoader', () => {
  var loader, model

  beforeEach(() => {
    model = makeMockModel()
    loader = makeModelLoader(model)
  })

  it('works with database tables with integer ids', () => {
    model.mockData = [{id: 1}, {id: 2}, {id: 3}]

    return loader.loadMany(['3', '1', '2']).then(results => {
      expect(results).to.deep.equal([{id: 3}, {id: 1}, {id: 2}])
    })
  })

  it('works with database tables with bigint ids', () => {
    model.mockData = [{id: '1'}, {id: '2'}, {id: '3'}]

    return loader.loadMany(['3', '1', '2']).then(results => {
      expect(results).to.deep.equal([{id: '3'}, {id: '1'}, {id: '2'}])
    })
  })

  it('clearDataLoaderCaches drops rows so the next load hits the batch function', async () => {
    let calls = 0
    const loader = new DataLoader(async ids => {
      calls += 1
      return ids.map(id => ({ id, n: calls }))
    })
    const first = await loader.load(1)
    expect(first).to.deep.equal({ id: 1, n: 1 })
    const cached = await loader.load(1)
    expect(cached).to.deep.equal({ id: 1, n: 1 })
    expect(calls).to.equal(1)

    clearDataLoaderCaches({ Group: loader })

    const fresh = await loader.load(1)
    expect(fresh).to.deep.equal({ id: 1, n: 2 })
    expect(calls).to.equal(2)
  })

  it('uses the correct table name', () => {
    model.mockData = []
    return loader.loadMany(['1']).then(() => {
      expect(model.where).to.have.been.called.with('mock_models.id', 'in', ['1'])
    })
  })
})
