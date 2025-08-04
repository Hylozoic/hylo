import { StatusBar } from 'expo-status-bar'
import { Text, View, ScrollView, TouchableOpacity } from 'react-native'
import './src/style/global.css'

export default function App() {
  return (
    <View className="flex-1 bg-background">
      <StatusBar style="auto" />
      
      {/* Header */}
      <View className="bg-primary p-6 pt-12">
        <Text className="text-primary-foreground text-2xl font-bold text-center">
          Hylo Expo Test
        </Text>
        <Text className="text-primary-foreground/80 text-center mt-2">
          NativeWind Styling Test
        </Text>
      </View>

      <ScrollView className="flex-1 p-6">
        {/* Basic styling test */}
        <View className="bg-card rounded-lg p-4 mb-4 shadow-sm">
          <Text className="text-card-foreground text-lg font-semibold mb-2">
            Basic Styling
          </Text>
          <Text className="text-muted-foreground">
            This card uses NativeWind classes for background, padding, and text colors.
          </Text>
        </View>

        {/* Color palette test */}
        <View className="mb-6">
          <Text className="text-foreground text-lg font-semibold mb-3">
            Color Palette Test
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <View className="bg-primary w-16 h-16 rounded-lg items-center justify-center">
              <Text className="text-primary-foreground text-xs">Primary</Text>
            </View>
            <View className="bg-secondary w-16 h-16 rounded-lg items-center justify-center">
              <Text className="text-secondary-foreground text-xs">Secondary</Text>
            </View>
            <View className="bg-accent w-16 h-16 rounded-lg items-center justify-center">
              <Text className="text-accent-foreground text-xs">Accent</Text>
            </View>
            <View className="bg-destructive w-16 h-16 rounded-lg items-center justify-center">
              <Text className="text-destructive-foreground text-xs">Destructive</Text>
            </View>
            <View className="bg-muted w-16 h-16 rounded-lg items-center justify-center">
              <Text className="text-muted-foreground text-xs">Muted</Text>
            </View>
          </View>
        </View>

        {/* Interactive elements test */}
        <View className="mb-6">
          <Text className="text-foreground text-lg font-semibold mb-3">
            Interactive Elements
          </Text>
          <TouchableOpacity className="bg-primary rounded-lg p-4 mb-3 active:opacity-80">
            <Text className="text-primary-foreground text-center font-semibold">
              Primary Button
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity className="bg-secondary rounded-lg p-4 mb-3 active:opacity-80">
            <Text className="text-secondary-foreground text-center font-semibold">
              Secondary Button
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity className="border border-border rounded-lg p-4 active:opacity-80">
            <Text className="text-foreground text-center font-semibold">
              Outline Button
            </Text>
          </TouchableOpacity>
        </View>

        {/* Spacing and layout test */}
        <View className="mb-6">
          <Text className="text-foreground text-lg font-semibold mb-3">
            Spacing & Layout
          </Text>
          <View className="space-y-2">
            <View className="bg-muted h-8 rounded" />
            <View className="bg-muted h-8 rounded ml-4" />
            <View className="bg-muted h-8 rounded ml-8" />
            <View className="bg-muted h-8 rounded ml-12" />
          </View>
        </View>

        {/* Custom spacing test */}
        <View className="mb-6">
          <Text className="text-foreground text-lg font-semibold mb-3">
            Custom Spacing
          </Text>
          <View className="space-y-4">
            <View className="bg-primary/20 h-12 rounded-lg" />
            <View className="bg-primary/20 h-12 rounded-lg" />
            <View className="bg-primary/20 h-12 rounded-lg" />
          </View>
        </View>

        {/* Chart colors test */}
        <View className="mb-6">
          <Text className="text-foreground text-lg font-semibold mb-3">
            Chart Colors
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <View className="bg-chart-1 w-12 h-12 rounded-lg items-center justify-center">
              <Text className="text-white text-xs">1</Text>
            </View>
            <View className="bg-chart-2 w-12 h-12 rounded-lg items-center justify-center">
              <Text className="text-white text-xs">2</Text>
            </View>
            <View className="bg-chart-3 w-12 h-12 rounded-lg items-center justify-center">
              <Text className="text-white text-xs">3</Text>
            </View>
            <View className="bg-chart-4 w-12 h-12 rounded-lg items-center justify-center">
              <Text className="text-white text-xs">4</Text>
            </View>
            <View className="bg-chart-5 w-12 h-12 rounded-lg items-center justify-center">
              <Text className="text-white text-xs">5</Text>
            </View>
          </View>
        </View>

        {/* Theme colors test */}
        <View className="mb-6">
          <Text className="text-foreground text-lg font-semibold mb-3">
            Theme Colors
          </Text>
          <View className="space-y-2">
            <View className="bg-theme-background border border-border rounded-lg p-3">
              <Text className="text-theme-foreground text-sm">Theme Background</Text>
            </View>
            <View className="bg-midground border border-border rounded-lg p-3">
              <Text className="text-foreground text-sm">Midground</Text>
            </View>
            <View className="bg-selected border border-border rounded-lg p-3">
              <Text className="text-foreground text-sm">Selected</Text>
            </View>
          </View>
        </View>

        {/* Error colors test */}
        <View className="mb-6">
          <Text className="text-foreground text-lg font-semibold mb-3">
            Error Colors
          </Text>
          <View className="bg-error rounded-lg p-4">
            <Text className="text-error-foreground text-sm font-semibold">
              Error Message Example
            </Text>
            <Text className="text-error-foreground/80 text-xs mt-1">
              This shows how error states would look
            </Text>
          </View>
        </View>

        {/* Popover test */}
        <View className="mb-6">
          <Text className="text-foreground text-lg font-semibold mb-3">
            Popover Colors
          </Text>
          <View className="bg-popover border border-border rounded-lg p-4">
            <Text className="text-popover-foreground text-sm font-semibold">
              Popover Content
            </Text>
            <Text className="text-popover-foreground/80 text-xs mt-1">
              This shows popover styling
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
