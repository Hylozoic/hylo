import { Pressable, Text, View } from 'react-native'

type ButtonProps = {
  text: string
  onPress: () => void
  disabled?: boolean
  className?: string
}

export default function Button ({ text, onPress, disabled, className }: ButtonProps) {
  return (
    <Pressable
      className={`items-center rounded-full border border-foreground/20 px-6 py-3 ${disabled ? 'opacity-50' : ''} ${className ?? 'bg-selected'}`}
      onPress={onPress}
      disabled={disabled}
    >
      <Text className='font-semibold text-foreground'>{text}</Text>
    </Pressable>
  )
}
