import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, CheckCheck, X } from 'lucide-react-native';
import { EmptyState } from '@/components/common/EmptyState';
import { lottie } from '@/constants/lottie';
import { NotificationRow } from './NotificationRow';
import {
  subscribeNotifications,
  markRead,
  markAllRead,
  type AppNotification,
} from '@/services/notificationsApi';

type Props = {
  visible: boolean;
  uid: string | null;
  onClose: () => void;
};

/**
 * Slide-up modal — kullanıcı bildirim geçmişini görür, tek tek (tıklayarak)
 * veya "Tümünü okundu" ile bildirimleri okundu yapar. Tıklanan satır
 * `deepLink` varsa o rotaya gider ve sheet kapanır.
 */
export function NotificationSheet({ visible, uid, onClose }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!visible || !uid) {
      if (!visible) setItems(null);
      return;
    }
    const unsub = subscribeNotifications(uid, (arr) => setItems(arr));
    return () => {
      if (unsub) unsub();
    };
  }, [visible, uid]);

  const hasUnread = useMemo(
    () => (items ?? []).some((n) => !n.readAtMs),
    [items],
  );

  const handlePressItem = useCallback(
    (n: AppNotification) => {
      if (uid && !n.readAtMs) {
        void markRead(uid, n.id);
      }
      if (n.deepLink) {
        onClose();
        // Modal kapanışından sonra route geçişi sıkıntısız olsun
        setTimeout(() => {
          try {
            router.push(n.deepLink as never);
          } catch (err) {
            console.warn('Bildirim deep-link açılamadı:', err);
          }
        }, 220);
      }
    },
    [uid, onClose, router],
  );

  const handleMarkAll = useCallback(() => {
    if (!uid || !items) return;
    void markAllRead(uid, items);
  }, [uid, items]);

  const handleRefresh = useCallback(() => {
    // Real-time listener zaten güncel — kullanıcıya geri-bildirim için yine de fake spin
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 bg-black/50">
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="mt-auto rounded-t-3xl bg-bg-base"
          style={{ height: '85%' }}
        >
          {/* Drag handle */}
          <View className="self-center mt-2 mb-1 h-1 w-10 rounded-full bg-bg-elevated" />

          {/* Header */}
          <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
            <View className="flex-row items-center flex-1">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-accent-soft">
                <Bell color="#16A34A" size={18} />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-base font-bold text-text-primary">Bildirimler</Text>
                <Text className="text-[11px] text-text-muted">
                  {items === null
                    ? 'Yükleniyor…'
                    : items.length === 0
                      ? 'Henüz bildirim yok'
                      : hasUnread
                        ? `${items.filter((n) => !n.readAtMs).length} okunmamış`
                        : 'Tümü okundu ✓'}
                </Text>
              </View>
            </View>
            {hasUnread ? (
              <Pressable
                onPress={handleMarkAll}
                className="mr-2 flex-row items-center rounded-full bg-accent-soft px-3 py-1.5 active:opacity-80"
              >
                <CheckCheck color="#15803D" size={13} />
                <Text className="ml-1 text-[11px] font-bold text-accent-fg">
                  Tümünü okundu
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onClose}
              hitSlop={10}
              className="h-8 w-8 items-center justify-center rounded-full bg-bg-elevated active:opacity-70"
              accessibilityLabel="Kapat"
            >
              <X color="#94A3B8" size={16} />
            </Pressable>
          </View>

          {/* Body */}
          {items === null ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#16A34A" />
            </View>
          ) : items.length === 0 ? (
            <View className="flex-1 items-center justify-center px-5">
              <EmptyState
                lottieSource={lottie.empty}
                title="Hiç bildirim yok ✨"
                subtitle="Yeni ödevler, başarılar ve hatırlatmalar burada görünecek."
                lottieSize={140}
              />
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(n) => n.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 28, gap: 8 }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor="#16A34A"
                />
              }
              renderItem={({ item }) => (
                <NotificationRow item={item} onPress={handlePressItem} />
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
