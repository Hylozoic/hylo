import { draftAsHtml, stewardNamesLine } from './util'

const t = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replace(`{{${name}}}`, value), key)

describe('draftAsHtml', () => {
  it('makes paragraphs and escapes everything', () => {
    expect(draftAsHtml(' Thanks both.\nSee you Thursday.\n\n<script>x</script> & more ')).toEqual(
      '<p>Thanks both.<br>See you Thursday.</p><p>&lt;script&gt;x&lt;/script&gt; &amp; more</p>'
    )
    expect(draftAsHtml('')).toEqual('')
  })
})

describe('stewardNamesLine', () => {
  const stewards = [{ id: '1', name: 'Maria Alcantara' }, { id: '2', name: 'Priya Nadar' }, { id: '3', name: 'Alex Rivera' }]

  it('names the other stewards by first name and the viewer as you', () => {
    expect(stewardNamesLine(stewards, '3', t)).toEqual('Only stewards see this: Maria, Priya, and you')
    expect(stewardNamesLine(stewards.slice(2), 3, t)).toEqual('Only stewards see this: you')
    expect(stewardNamesLine(stewards.slice(0, 1), '3', t)).toEqual('Only stewards see this: Maria')
  })

  it('counts stewards past three names', () => {
    const many = [...stewards, { id: '4', name: 'Sam' }, { id: '5', name: 'Lena' }, { id: '6', name: 'Devin' }]
    expect(stewardNamesLine(many, '6', t)).toEqual('Only stewards see this: Maria, Priya, Alex, 2 more, and you')
    expect(stewardNamesLine([], '1', t)).toEqual('Only stewards see this')
  })
})
