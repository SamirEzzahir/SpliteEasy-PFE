import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native'
import { Link } from 'expo-router'
import { useAuthStore } from '../../src/store/authStore'

export default function LoginScreen() {
  const { login } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields.')
      return
    }
    setLoading(true)
    try {
      await login(username.trim(), password)
    } catch (e: any) {
      Alert.alert('Login failed', e?.response?.data?.detail || 'Invalid credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoBox}>
          <Text style={styles.logoIcon}>💸</Text>
          <Text style={styles.logoTitle}>SplitEasy</Text>
          <Text style={styles.logoSub}>Split expenses, simply.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Welcome back</Text>

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="your_username"
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            placeholderTextColor="#9ca3af"
          />

          <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Log In</Text>}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/register">
              <Text style={styles.link}>Sign up</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f0f2ff' },
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logoBox: { alignItems: 'center', marginBottom: 32 },
  logoIcon: { fontSize: 56 },
  logoTitle: { fontSize: 32, fontWeight: '800', color: '#1e1b4b', marginTop: 8 },
  logoSub: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  card: {
    width: '100%', maxWidth: 400, backgroundColor: '#fff',
    borderRadius: 24, padding: 28,
    shadowColor: '#4a5cff', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12, shadowRadius: 24, elevation: 8,
  },
  heading: { fontSize: 22, fontWeight: '700', color: '#1e1b4b', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12,
    padding: 14, fontSize: 15, color: '#111827', marginBottom: 16,
    backgroundColor: '#fafafa',
  },
  btn: {
    backgroundColor: '#4a5cff', borderRadius: 14, padding: 16,
    alignItems: 'center', marginTop: 8,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { color: '#6b7280', fontSize: 14 },
  link: { color: '#4a5cff', fontWeight: '700', fontSize: 14 },
})
