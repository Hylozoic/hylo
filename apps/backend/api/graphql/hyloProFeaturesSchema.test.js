import fs from 'fs'
import path from 'path'
import { parse } from 'graphql'
import { HYLO_PRO_FEATURE_KEYS } from '@hylo/shared'

/**
 * The GraphQL type HyloProFeatures must have exactly one Boolean field per feature registered in
 * packages/shared HyloProFeatures.js, so the registry and the API can't drift: registering a
 * feature means adding a field here too (and nothing else).
 */
describe('HyloProFeatures GraphQL type', () => {
  it('has exactly the registered feature keys as Boolean fields, in registry order', () => {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.graphql'), 'utf8')
    const type = parse(schema).definitions.find(d => d.kind === 'ObjectTypeDefinition' && d.name.value === 'HyloProFeatures')
    expect(type, 'type HyloProFeatures in schema.graphql').to.exist
    expect(type.fields.map(f => f.name.value)).to.deep.equal(HYLO_PRO_FEATURE_KEYS)
    for (const field of type.fields) {
      expect(field.type.kind === 'NamedType' && field.type.name.value, `${field.name.value} is a Boolean`).to.equal('Boolean')
    }
  })
})
