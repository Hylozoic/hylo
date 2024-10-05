import 'react-native'
import React from 'react'
import TestRenderer from 'react-test-renderer'
import ReactShallowRenderer from 'react-test-renderer/shallow'
import FlagContent from './FlagContent'

describe('FlagContent', () => {
  it('matches the last snapshot', () => {
    const renderer = new ReactShallowRenderer()
    renderer.render(<FlagContent
      visible
      onClose={() => { }}
                    />
    )
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })

  it('changes title based on type', () => {
    const renderer = new ReactShallowRenderer()
    renderer.render(<FlagContent
      visible
      type='post'
      onClose={() => { }}
                    />
    )
    const actual = renderer.getRenderOutput()

    expect(actual).toMatchSnapshot()
  })

  it('calls onClose successfully', () => {
    const onClose = jest.fn()
    const instance = TestRenderer.create(<FlagContent
      visible
      type='post'
      onClose={onClose}
                                         />
    ).root.instance

    instance.closeModal()

    expect(onClose).toHaveBeenCalled()
  })

  it('calls submit successfully with category:inappropriate', () => {
    const onClose = jest.fn()
    const submitFlagContent = jest.fn()

    const linkData = { id: 33, type: 'post' }
    const instance = TestRenderer.create(<FlagContent
      visible
      type='post'
      linkData={linkData}
      submitFlagContent={submitFlagContent}
      onClose={onClose}
                                         />
    ).root.instance

    instance.setState({ selectedCategory: 'inappropriate' })

    instance.submit('  my reason  ')

    expect(instance.isOptionalExplanation()).toBeTruthy()

    expect(submitFlagContent).toHaveBeenCalledWith('inappropriate', 'my reason', linkData)
    expect(onClose).toHaveBeenCalled()
  })

  it('calls submit successfully with category:other', () => {
    const onClose = jest.fn()
    const submitFlagContent = jest.fn()

    const linkData = { id: 33, type: 'post' }
    const renderer = TestRenderer.create(<FlagContent
      visible
      type='post'
      linkData={linkData}
      submitFlagContent={submitFlagContent}
      onClose={onClose}
                                         />
    )

    expect(renderer.toJSON()).toMatchSnapshot()

    const instance = renderer.getInstance()

    instance.setState({ selectedCategory: 'other' })

    expect(instance.isOptionalExplanation()).toBeFalsy()
    expect(instance.state.highlightRequired).toBeFalsy()

    instance.submit('  ')

    expect(submitFlagContent).not.toHaveBeenCalled()
    expect(instance.state.highlightRequired).toBeTruthy()

    instance.submit('  my reason  ')

    expect(submitFlagContent).toHaveBeenCalledWith('other', 'my reason', linkData)
    expect(onClose).toHaveBeenCalled()
  })

  describe('cancel', () => {
    it('sets the state and calls closeModal', () => {
      const instance = TestRenderer.create(
        <FlagContent type='post' />).getInstance()
      instance.closeModal = jest.fn()
      instance.setState({
        highlightRequired: true
      })
      instance.cancel()
      expect(instance.state.highlightRequired).toEqual(false)
      expect(instance.closeModal).toHaveBeenCalled()
    })
  })

  describe('isOptionalExplanation', () => {
    it('works from param', () => {
      const instance = TestRenderer.create(
        <FlagContent type='post' />).getInstance()
      instance.setState({
        selectedCategory: 'Not other'
      })
      expect(instance.isOptionalExplanation('other')).toEqual(false)
      expect(instance.isOptionalExplanation('fine')).toEqual(true)
    })

    it('works from state', () => {
      const instance = TestRenderer.create(
        <FlagContent type='post' />).getInstance()
      instance.setState({
        selectedCategory: 'other'
      })
      expect(instance.isOptionalExplanation()).toEqual(false)
      instance.setState({
        selectedCategory: 'fine'
      })
      expect(instance.isOptionalExplanation()).toEqual(true)
    })
  })
})
