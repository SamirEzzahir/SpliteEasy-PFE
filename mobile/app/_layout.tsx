import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, View } from 'react-native'
import { useAuthStore } from '../src/store/authStore'
import { useWsStore } from '../src/store/wsStore'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

function AuthGuard() {
  const { isAuthenticated, isLoading, token, user } = useAuthStore()
  const { connect } = useWsStore()
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    if (isLoading) return
    const inAuth = segments[0] === '(auth)'
    if (!isAuthenticated && !inAuth) {
      router.replace('/(auth)/login')
    } else if (isAuthenticated && inAuth) {
      router.replace('/(tabs)')
    }
  }, [isAuthenticated, isLoading, segments])

  useEffect(() => {
    if (isAuthenticated && token && user) {
      connect(user.id, token)
    }
  }, [isAuthenticated, token, user])

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9ff' }}>
        <ActivityIndicator size="large" color="#4a5cff" />
      </View>
    )
  }

  return null
}

export default function RootLayout() {
  const { loadToken } = useAuthStore()

  useEffect(() => {
    loadToken()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="group/[id]" options={{ headerShown: true, title: 'Group' }} />
        <Stack.Screen name="settle/[groupId]" options={{ headerShown: true, title: 'Settle Up' }} />
      </Stack>
    </QueryClientProvider>
  )
}
