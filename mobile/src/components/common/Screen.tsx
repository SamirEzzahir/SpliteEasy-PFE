import { SafeAreaView, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native'

interface ScreenProps {
  children: React.ReactNode
  scroll?: boolean
  style?: ViewStyle
  padded?: boolean
}

export function Screen({ children, scroll = false, style, padded = true }: ScreenProps) {
  const inner = (
    <View style={[styles.inner, padded && styles.padded, style]}>
      {children}
    </View>
  )
  return (
    <SafeAreaView style={styles.safe}>
      {scroll ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {inner}
        </ScrollView>
      ) : inner}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f9ff' },
  inner: { flex: 1 },
  padded: { padding: 16 },
  scrollContent: { flexGrow: 1 },
})
