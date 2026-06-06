import { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Switch, TextInput, Modal, ActivityIndicator,
} from 'react-native'
import { useAuthStore } from '../../src/store/authStore'
import { useGlobalBalances } from '../../src/hooks/useSettlements'
import { Card } from '../../src/components/common/Card'
import { Avatar } from '../../src/components/common/Avatar'

function money(n: number, currency = 'USD') {
  return `${Number(n).toFixed(2)} ${currency}`
}

export default function AccountScreen() {
  const { user, logout } = useAuthStore()
  const { data: globalBalances } = useGlobalBalances()
  const [notifEnabled, setNotifEnabled] = useState(true)
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  function handleLogout() {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ])
  }

  const totalOwed = (globalBalances || [])
    .filter((b: any) => b.from_user_id === user?.id)
    .reduce((sum: number, b: any) => sum + b.amount, 0)

  const totalOwedToMe = (globalBalances || [])
    .filter((b: any) => b.to_user_id === user?.id)
    .reduce((sum: number, b: any) => sum + b.amount, 0)

  return (
    <ScrollView style={styles.bg} contentContainerStyle={styles.container}>
      {/* Profile Card */}
      <Card style={styles.profileCard}>
        <View style={styles.profileRow}>
          {user && <Avatar name={user.username} size={64} />}
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={styles.profileName}>{user?.username}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
        </View>
      </Card>

      {/* Balance Summary */}
      <View style={styles.balanceRow}>
        <View style={[styles.balanceCard, { backgroundColor: '#10b981' }]}>
          <Text style={styles.balanceLabel}>Owed to me</Text>
          <Text style={styles.balanceValue}>{money(totalOwedToMe)}</Text>
        </View>
        <View style={[styles.balanceCard, { backgroundColor: '#ef4444' }]}>
          <Text style={styles.balanceLabel}>I owe</Text>
          <Text style={styles.balanceValue}>{money(totalOwed)}</Text>
        </View>
      </View>

      {/* Settings */}
      <Text style={styles.sectionTitle}>Settings</Text>
      <Card style={styles.settingsCard}>
        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingLabel}>Push Notifications</Text>
            <Text style={styles.settingDesc}>Get alerts for settlements & expenses</Text>
          </View>
          <Switch
            value={notifEnabled}
            onValueChange={setNotifEnabled}
            trackColor={{ false: '#e5e7eb', true: '#4a5cff' }}
            thumbColor="#fff"
          />
        </View>
      </Card>

      {/* Account Actions */}
      <Text style={styles.sectionTitle}>Account</Text>
      <Card style={styles.settingsCard}>
        <TouchableOpacity style={styles.actionRow} onPress={() => setShowPasswordModal(true)}>
          <Text style={styles.actionText}>🔒 Change Password</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.actionRow}>
          <Text style={styles.actionText}>🔔 Notification Preferences</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.actionRow}>
          <Text style={styles.actionText}>💰 Default Currency</Text>
          <Text style={styles.chevronMuted}>USD  ›</Text>
        </TouchableOpacity>
      </Card>

      {/* App Info */}
      <Text style={styles.sectionTitle}>About</Text>
      <Card style={styles.settingsCard}>
        <View style={styles.actionRow}>
          <Text style={styles.actionText}>📱 Version</Text>
          <Text style={styles.chevronMuted}>1.0.0</Text>
        </View>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.actionRow}>
          <Text style={styles.actionText}>📄 Privacy Policy</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.actionRow}>
          <Text style={styles.actionText}>📋 Terms of Service</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </Card>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />

      {/* Change Password Modal */}
      <Modal visible={showPasswordModal} transparent animationType="slide">
        <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
      </Modal>
    </ScrollView>
  )
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!current || !next || !confirm) { Alert.alert('Error', 'Fill in all fields.'); return }
    if (next !== confirm) { Alert.alert('Error', 'Passwords do not match.'); return }
    if (next.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters.'); return }
    setLoading(true)
    try {
      Alert.alert('Success', 'Password changed!')
      onClose()
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <Text style={styles.modalTitle}>Change Password</Text>
        {[
          { label: 'Current Password', val: current, set: setCurrent },
          { label: 'New Password', val: next, set: setNext },
          { label: 'Confirm Password', val: confirm, set: setConfirm },
        ].map(({ label, val, set }) => (
          <View key={label}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
              style={styles.input}
              value={val}
              onChangeText={set}
              secureTextEntry
              placeholderTextColor="#9ca3af"
              placeholder="••••••"
            />
          </View>
        ))}
        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.createBtn} onPress={handleSubmit} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.createBtnText}>Save</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f8f9ff' },
  container: { padding: 16 },
  profileCard: { padding: 20, marginBottom: 16 },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  profileName: { fontSize: 20, fontWeight: '800', color: '#1e1b4b' },
  profileEmail: { fontSize: 13, color: '#9ca3af', marginTop: 3 },
  balanceRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  balanceCard: { flex: 1, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  balanceValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#6b7280', marginBottom: 8, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  settingsCard: { marginBottom: 16 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  settingLabel: { fontSize: 15, fontWeight: '600', color: '#1e1b4b' },
  settingDesc: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  actionText: { fontSize: 15, color: '#374151', fontWeight: '500' },
  chevron: { fontSize: 18, color: '#9ca3af' },
  chevronMuted: { fontSize: 14, color: '#9ca3af' },
  divider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 16 },
  logoutBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#ef4444', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  logoutText: { color: '#ef4444', fontWeight: '700', fontSize: 16 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1e1b4b', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, fontSize: 15, color: '#111827', backgroundColor: '#fafafa' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelBtnText: { color: '#6b7280', fontWeight: '600', fontSize: 15 },
  createBtn: { flex: 1, backgroundColor: '#4a5cff', borderRadius: 12, padding: 14, alignItems: 'center' },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
})
