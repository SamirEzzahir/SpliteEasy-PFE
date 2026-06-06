import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native'

export function Skeleton({ style }: { style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ]),
    ).start()
  }, [])

  return <Animated.View style={[styles.skeleton, { opacity }, style]} />
}

export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton style={{ height: 16, width: '60%', borderRadius: 8, marginBottom: 8 }} />
      <Skeleton style={{ height: 12, width: '40%', borderRadius: 6 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  skeleton: { backgroundColor: '#e0e4ff', borderRadius: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
})
