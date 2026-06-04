import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MessageSquare, Plus, Trash2, X } from 'lucide-react-native';
import { auth } from '@/services/firebase';
import {
  subscribeUserChats,
  deleteChat,
  type ChatSummary,
} from '@/services/chatHistoryApi';

type Props = {
  visible: boolean;
  currentChatId: string | null;
  onClose: () => void;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
};

function timeAgo(ms: number): string {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'az önce';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} dk`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} gün`;
  return new Date(ms).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

export function ChatHistorySheet({
  visible,
  currentChatId,
  onClose,
  onSelectChat,
  onNewChat,
}: Props) {
  const [items, setItems] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeUserChats(uid, (arr) => {
      setItems(arr);
      setLoading(false);
    });
    return () => {
      if (unsub) unsub();
    };
  }, [visible]);

  const handleDelete = (chatId: string) => {
    Alert.alert('Sohbeti sil', 'Bu sohbet kalıcı olarak silinecek. Emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const uid = auth.currentUser?.uid;
          if (!uid) return;
          try {
            await deleteChat(uid, chatId);
          } catch (err) {
            Alert.alert('Hata', (err as Error).message);
          }
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 bg-black/50">
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="mt-auto rounded-t-3xl bg-bg-base"
          style={{ maxHeight: '85%' }}
        >
          <View className="px-5 pb-5 pt-3">
            <View className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border-soft" />
            <View className="flex-row items-center">
              <View className="h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft">
                <MessageSquare color="#4F46E5" size={18} />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-base font-semibold text-text-primary">Sohbetlerim</Text>
                <Text className="text-xs text-text-muted">
                  {items.length} kayıtlı sohbet
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                className="h-8 w-8 items-center justify-center rounded-full bg-bg-elevated active:opacity-70"
              >
                <X color="#475569" size={14} />
              </Pressable>
            </View>

            <Pressable
              onPress={() => {
                onNewChat();
                onClose();
              }}
              className="mt-4 flex-row items-center justify-center rounded-xl bg-accent py-3 active:opacity-80"
            >
              <Plus color="white" size={16} />
              <Text className="ml-1.5 text-sm font-bold text-white">Yeni Sohbet</Text>
            </Pressable>

            {loading ? (
              <View className="items-center py-10">
                <ActivityIndicator color="#6366F1" />
              </View>
            ) : items.length === 0 ? (
              <View className="items-center py-10">
                <MessageSquare color="#94A3B8" size={32} />
                <Text className="mt-3 text-sm font-medium text-text-muted">
                  Henüz sohbet yok
                </Text>
                <Text className="mt-1 text-xs text-text-muted">
                  Yeni Sohbet ile başla
                </Text>
              </View>
            ) : (
              <FlatList
                data={items}
                keyExtractor={(c) => c.id}
                showsVerticalScrollIndicator={false}
                style={{ marginTop: 12, maxHeight: 420 }}
                contentContainerStyle={{ paddingBottom: 8, gap: 6 }}
                renderItem={({ item }) => {
                  const isActive = item.id === currentChatId;
                  return (
                    <Pressable
                      onPress={() => {
                        onSelectChat(item.id);
                        onClose();
                      }}
                      className={`flex-row items-center rounded-2xl border p-3 active:opacity-70 ${
                        isActive
                          ? 'border-accent bg-accent-soft'
                          : 'border-border-soft bg-bg-surface'
                      }`}
                    >
                      <View className="flex-1">
                        <Text
                          className="text-sm font-semibold text-text-primary"
                          numberOfLines={1}
                        >
                          {item.topic}
                        </Text>
                        <View className="mt-1 flex-row items-center">
                          <Text className="text-[11px] text-text-muted">
                            {item.messageCount} mesaj
                          </Text>
                          {item.lastMessageAt ? (
                            <>
                              <Text className="mx-1.5 text-[11px] text-text-muted">·</Text>
                              <Text className="text-[11px] text-text-muted">
                                {timeAgo(item.lastMessageAt)}
                              </Text>
                            </>
                          ) : null}
                          {isActive ? (
                            <View className="ml-2 rounded-full bg-accent px-1.5 py-0.5">
                              <Text className="text-[9px] font-bold text-white">AKTİF</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <Pressable
                        onPress={() => handleDelete(item.id)}
                        hitSlop={10}
                        className="ml-2 p-1.5 active:opacity-60"
                      >
                        <Trash2 color="#DC2626" size={15} />
                      </Pressable>
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
