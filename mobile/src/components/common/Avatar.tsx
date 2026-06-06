import { View, Text, StyleSheet } from 'react-native'

const COLORS = ['#4a5cff', '#7c4dff', '#10b981', '#f59e0b', '#ef4444', '#06b6d4']

function pickColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % COLORS.length
  return COLORS[Math.abs(h) % COLORS.length]
}

interface AvatarProps { name: string; size?: number }

export function Avatar({ name, size = 40 }: AvatarProps) {
  const bg = pickColor(name)
  const letter = (name || '?')[0].toUpperCase()
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2.5, backgroundColor: bg }]}>
      <Text style={[styles.letter, { fontSize: size * 0.4 }]}>{letter}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  letter: { color: '#fff', fontWeight: '700' },
})
