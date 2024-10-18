import Avatar from './Avatar'

const meta = {
  title: 'Components/Avatar',
  component: Avatar,
  parameters: {
    layout: 'centered'
  },
  tags: ['autodocs'],
  argTypes: {
    name: { control: 'text' },
    avatarUrl: { control: 'text' },
    size: { control: 'select', options: ['small', 'medium', 'large'] },
    onClick: { action: 'clicked' }
  }
}

export const Default = {
  args: {
    name: 'John Doe',
    avatarUrl: 'https://example.com/avatar.jpg',
    size: 'medium'
  }
}

export const SmallSize = {
  args: {
    ...Default.args,
    size: 'small'
  }
}

export const LargeSize = {
  args: {
    ...Default.args,
    size: 'large'
  }
}

export const NoImage = {
  args: {
    name: 'Jane Smith',
    size: 'medium'
  }
}

export const WithOnClick = {
  args: {
    ...Default.args,
    onClick: () => console.log('Avatar clicked')
  }
}

export default meta
