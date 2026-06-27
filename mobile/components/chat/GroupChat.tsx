// components/chat/GroupChat.tsx — floating group chat bubble + modal panel.
// RN rewrite of the web GroupChat: same shared-WS subscription model, FlatList
// message list, typing indicator, optimistic send. No Web Audio / DOM refs.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { chatApi, type ChatMessage } from "@/lib/api/chat";
import { useAuth } from "@/lib/auth/AuthContext";
import { useWS } from "@/lib/ws-context";
import { RADIUS, useTheme } from "@/lib/theme";

function msgTime(iso: string) {
  const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function GroupChat({ groupId, groupName }: { groupId: number; groupName: string }) {
  const { user } = useAuth();
  const { subscribe } = useWS();
  const { t } = useTheme();
  const insets = useSafeAreaInsets();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [typingUsers, setTypingUsers] = useState<Record<number, string>>({});

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const typingTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const typingSendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      setMessages(await chatApi.fetchMessages(groupId));
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => { void loadMessages(); }, [loadMessages]);
  useEffect(() => { if (open) setUnread(0); }, [open]);

  // Subscribe to the shared WebSocket for this group's chat events.
  useEffect(() => {
    const unsubTyping = subscribe("typing", (raw) => {
      const data = raw as { group_id: number; user_id: number; username: string };
      if (data.group_id !== groupId || data.user_id === user?.id) return;
      const uid = data.user_id;
      setTypingUsers((prev) => ({ ...prev, [uid]: data.username }));
      if (typingTimers.current[uid]) clearTimeout(typingTimers.current[uid]);
      typingTimers.current[uid] = setTimeout(() => {
        setTypingUsers((prev) => { const n = { ...prev }; delete n[uid]; return n; });
      }, 3000);
    });

    const unsubMsg = subscribe("new_chat_message", (raw) => {
      const { message: msg } = raw as { message: ChatMessage };
      if (msg.group_id !== groupId) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setTypingUsers((prev) => { const n = { ...prev }; delete n[msg.user_id]; return n; });
      if (!openRef.current && msg.user_id !== user?.id) setUnread((u) => u + 1);
    });

    return () => { unsubTyping(); unsubMsg(); };
  }, [subscribe, groupId, user?.id]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !user) return;
    setSending(true);
    setInput("");
    try {
      const msg = await chatApi.sendMessage(groupId, text);
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    } catch {
      setInput(text); // restore on failure
    } finally {
      setSending(false);
    }
  };

  const onChangeInput = (v: string) => {
    setInput(v);
    if (typingSendTimer.current) return;
    typingSendTimer.current = setTimeout(() => {
      typingSendTimer.current = null;
      chatApi.sendTyping(groupId).catch(() => {});
    }, 400);
  };

  const typingLabel = Object.values(typingUsers);

  return (
    <>
      {/* Floating bubble */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.bubble, { backgroundColor: t.primary, bottom: insets.bottom + 24 }]}
        onPress={() => setOpen(true)}
      >
        <Text style={styles.bubbleIcon}>💬</Text>
        {unread > 0 && (
          <View style={[styles.badge, { backgroundColor: t.rose }]}>
            <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: t.bg }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: t.primary }]}>
            <TouchableOpacity onPress={() => setOpen(false)} hitSlop={12}>
              <Text style={styles.headerBtn}>‹</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>{groupName}</Text>
              <Text style={styles.headerSub}>Group Chat</Text>
            </View>
            <TouchableOpacity onPress={() => setOpen(false)} hitSlop={12}>
              <Text style={styles.headerBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Messages */}
          {loading ? (
            <View style={styles.center}><ActivityIndicator color={t.primary} /></View>
          ) : messages.length === 0 ? (
            <View style={styles.center}>
              <Text style={{ fontSize: 32 }}>💬</Text>
              <Text style={{ color: t.ink2, fontWeight: "700", marginTop: 8 }}>No messages yet.</Text>
              <Text style={{ color: t.ink4, marginTop: 2 }}>Say hi to the group!</Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(m) => String(m.id)}
              contentContainerStyle={{ padding: 12, gap: 8 }}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item: msg }) => {
                const isMe = msg.user_id === user?.id;
                return (
                  <View style={[styles.msgRow, { justifyContent: isMe ? "flex-end" : "flex-start" }]}>
                    <View
                      style={[
                        styles.bubbleMsg,
                        isMe
                          ? { backgroundColor: t.primary, borderBottomRightRadius: 4 }
                          : { backgroundColor: t.surface, borderColor: t.line, borderWidth: 1, borderBottomLeftRadius: 4 },
                      ]}
                    >
                      {!isMe && <Text style={[styles.msgAuthor, { color: t.primary }]}>{msg.username}</Text>}
                      <Text style={{ color: isMe ? "#fff" : t.ink, fontSize: 15 }}>{msg.content}</Text>
                      <Text style={[styles.msgTime, { color: isMe ? "rgba(255,255,255,0.7)" : t.ink4 }]}>
                        {msgTime(msg.created_at)}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />
          )}

          {typingLabel.length > 0 && (
            <Text style={[styles.typing, { color: t.ink3 }]}>
              {typingLabel.join(", ")} {typingLabel.length === 1 ? "is" : "are"} typing…
            </Text>
          )}

          {/* Input */}
          <View style={[styles.inputRow, { backgroundColor: t.surface, borderTopColor: t.line, paddingBottom: insets.bottom + 8 }]}>
            <TextInput
              style={[styles.input, { backgroundColor: t.bg, color: t.ink, borderColor: t.line }]}
              placeholder="Type a message…"
              placeholderTextColor={t.ink4}
              value={input}
              onChangeText={onChangeInput}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: input.trim() ? t.primary : t.line }]}
              onPress={send}
              disabled={sending || !input.trim()}
            >
              <Text style={styles.sendIcon}>➤</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  bubbleIcon: { fontSize: 24 },
  badge: { position: "absolute", top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  headerBtn: { color: "#fff", fontSize: 22, fontWeight: "700" },
  headerTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  msgRow: { flexDirection: "row" },
  bubbleMsg: { maxWidth: "80%", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  msgAuthor: { fontSize: 12, fontWeight: "800", marginBottom: 2 },
  msgTime: { fontSize: 10, marginTop: 4, alignSelf: "flex-end" },
  typing: { paddingHorizontal: 16, paddingVertical: 4, fontSize: 12, fontStyle: "italic" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1 },
  input: { flex: 1, borderWidth: 1, borderRadius: RADIUS, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, maxHeight: 120 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  sendIcon: { color: "#fff", fontSize: 18 },
});
