import React from 'react'
import ShadcnTest from './ShadcnTest'

export default {
  title: 'Components/ShadcnTest',
  component: ShadcnTest,
  argTypes: {
    // Add any props you want to control in Storybook here
  }
}

const Template = (args) => (<ShadcnTest {...args} />)

export const Default = Template.bind({})
Default.args = {
  yay: false
}

export const CustomExample = Template.bind({})
CustomExample.args = {
  yay: true
}
