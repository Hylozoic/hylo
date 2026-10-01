import { Pressable, Text, TextInput, View, type ViewProps } from 'react-native'
import { Entypo } from '@expo/vector-icons'
import { useHeaderHeight } from '@react-navigation/elements'
import KeyboardFriendlyView from '../KeyboardFriendlyView'

type AuthBannerProps = {
  message: string
  variant?: 'error' | 'status'
  topInset?: number
}

export function AuthBanner ({ message, variant = 'status', topInset = 0 }: AuthBannerProps) {
  return (
    <View
      className={`absolute left-0 right-0 top-0 z-10 px-4 py-2 ${variant === 'error' ? 'bg-destructive' : 'bg-selected'}`}
      style={{ paddingTop: topInset + 8 }}
    >
      <Text className='text-center text-white'>{message}</Text>
    </View>
  )
}

type AuthInputProps = {
  label: string
  value?: string
  onChangeText: (value: string) => void
  valid?: boolean
  secureTextEntry?: boolean
  keyboardType?: 'default' | 'email-address'
  returnKeyType?: 'next' | 'go' | 'done'
  onSubmitEditing?: () => void
  inputRef?: React.RefObject<TextInput | null>
  rightAccessory?: React.ReactNode
  testID?: string
}

export function AuthInput ({
  label,
  value,
  onChangeText,
  valid,
  secureTextEntry,
  keyboardType = 'default',
  returnKeyType = 'done',
  onSubmitEditing,
  inputRef,
  rightAccessory,
  testID
}: AuthInputProps) {
  return (
    <View className='mb-4 px-4'>
      {label ? <Text className='mb-1 text-sm text-foreground/80'>{label}</Text> : null}
      <View className={`flex-row items-center rounded-md border px-3 ${valid ? 'border-selected' : 'border-border'}`}>
        <TextInput
          ref={inputRef}
          testID={testID}
          className='min-h-[44px] flex-1 text-base text-foreground'
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          autoCapitalize='none'
          autoCorrect={false}
        />
        {valid && !rightAccessory && <Entypo name='check' size={20} color='#33D089' />}
        {rightAccessory}
      </View>
    </View>
  )
}

type AuthPrimaryButtonProps = {
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  testID?: string
}

export function AuthPrimaryButton ({ label, onPress, disabled, loading, testID }: AuthPrimaryButtonProps) {
  return (
    <Pressable
      testID={testID}
      className={`mx-4 mb-4 items-center rounded-full py-3 ${disabled || loading ? 'bg-muted-foreground/70' : 'bg-selected'}`}
      onPress={onPress}
      disabled={disabled || loading}
    >
      <Text className='text-lg text-white'>{label}</Text>
    </Pressable>
  )
}

type SignupFlowLayoutProps = ViewProps & {
  title: string
  subtitle?: string
  footer?: React.ReactNode
  children: React.ReactNode
  topInset?: number
  bottomInset?: number
}

export function SignupFlowLayout ({
  title,
  subtitle,
  footer,
  children,
  topInset = 0,
  bottomInset = 0,
  className,
  ...rest
}: SignupFlowLayoutProps) {
  const headerHeight = useHeaderHeight()

  return (
    <KeyboardFriendlyView
      className={`flex-1 bg-selected ${className ?? ''}`}
      style={{ paddingTop: topInset, paddingBottom: bottomInset }}
      keyboardVerticalOffset={headerHeight}
      {...rest}
    >
      <View className='px-5 pt-5'>
        <Text className='mb-2 text-xl font-bold text-white'>{title}</Text>
        {subtitle && <Text className='text-sm text-white/80'>{subtitle}</Text>}
      </View>
      <View className='flex-1 px-5 pt-4'>{children}</View>
      {footer && (
        <View className='flex-row items-center bg-white/20 px-3 pb-4 pt-3'>
          {footer}
        </View>
      )}
    </KeyboardFriendlyView>
  )
}

export function SignupFlowButton ({
  label,
  onPress,
  disabled,
  variant = 'continue'
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  variant?: 'continue' | 'back'
}) {
  const isBack = variant === 'back'
  return (
    <Pressable
      className={`items-center rounded-full px-6 py-2.5 ${isBack ? 'bg-white/40' : 'ml-auto bg-white'} ${disabled ? 'opacity-50' : ''}`}
      onPress={onPress}
      disabled={disabled}
    >
      <Text className={`font-semibold ${isBack ? 'text-white' : 'text-selected'}`}>{label}</Text>
    </Pressable>
  )
}
