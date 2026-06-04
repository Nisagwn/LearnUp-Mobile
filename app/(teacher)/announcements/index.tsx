import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Megaphone, Plus, Trash2, X, Check } from 'lucide-react-native';
import { auth } from '@/services/firebase';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import {
  subscribeTeacherAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  type Announcement,
} from '@/services/announcementsApi';

function formatDate(ms: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

export default function TeacherAnnouncements() {
  const router = useRouter();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }
    const unsub = subscribeTeacherAnnouncements(uid, (arr) => {
      setItems(arr);
      setLoading(false);
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  const openCompose = () => {
    setTitle('');
    setContent('');
    setComposeOpen(true);
  };

  const handlePublish = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    if (title.trim().length < 2) {
      Alert.alert('Eksik bilgi', 'Duyuru başlığı en az 2 karakter olmalı.');
      return;
    }
    setSaving(true);
    try {
      await createAnnouncement(uid, { title, content });
      setComposeOpen(false);
    } catch (err) {
      Alert.alert('Hata', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Duyuruyu sil', 'Bu duyuru silinecek. Emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAnnouncement(id);
          } catch (err) {
            Alert.alert('Hata', (err as Error).message);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
      <View className="flex-row items-center justify-between px-3 pt-2">
        <Pressable onPress={() => router.back()} className="p-2 active:opacity-60">
          <ChevronLeft color="#475569" size={22} />
        </Pressable>
        <Pressable
          onPress={openCompose}
          className="mr-2 flex-row items-center rounded-full bg-accent px-3.5 py-2 active:opacity-80"
        >
          <Plus color="white" size={14} />
          <Text className="ml-1 text-xs font-bold text-white">Yeni Duyuru</Text>
        </Pressable>
      </View>
      <View className="px-5 pt-1">
        <Text className="text-3xl font-bold text-text-primary">Duyurular</Text>
        <Text className="mt-1 text-sm text-text-muted">{items.length} duyuru</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6366F1" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 8 }}
          ListEmptyComponent={
            <EmptyState
              icon={Megaphone}
              title="Henüz duyuru yok"
              subtitle="Yeni Duyuru ile sınıfını bilgilendir"
            />
          }
          renderItem={({ item }) => (
            <Card>
              <View className="flex-row items-start">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-text-primary">{item.title}</Text>
                  {item.content ? (
                    <Text className="mt-1 text-sm leading-5 text-text-secondary">{item.content}</Text>
                  ) : null}
                  <Text className="mt-2 text-[10px] text-text-muted">{formatDate(item.createdAtMs)}</Text>
                </View>
                <Pressable onPress={() => handleDelete(item.id)} className="ml-2 p-1 active:opacity-60">
                  <Trash2 color="#DC2626" size={16} />
                </Pressable>
              </View>
            </Card>
          )}
        />
      )}

      <Modal visible={composeOpen} transparent animationType="slide" onRequestClose={() => setComposeOpen(false)}>
        <Pressable onPress={() => setComposeOpen(false)} className="flex-1 bg-black/50">
          <Pressable onPress={(e) => e.stopPropagation()} className="mt-auto rounded-t-3xl bg-bg-base">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View className="px-5 pb-8 pt-3">
                <View className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border-soft" />
                <View className="flex-row items-center">
                  <View className="h-10 w-10 items-center justify-center rounded-2xl bg-accent-soft">
                    <Megaphone color="#4F46E5" size={18} />
                  </View>
                  <Text className="ml-3 flex-1 text-base font-semibold text-text-primary">
                    Yeni Duyuru
                  </Text>
                  <Pressable
                    onPress={() => setComposeOpen(false)}
                    hitSlop={10}
                    className="h-8 w-8 items-center justify-center rounded-full bg-bg-elevated active:opacity-70"
                  >
                    <X color="#475569" size={14} />
                  </Pressable>
                </View>

                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Başlık (örn. Salı mock sınavı)"
                  placeholderTextColor="#94A3B8"
                  maxLength={80}
                  className="mt-4 rounded-xl border border-border-soft bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary"
                />
                <TextInput
                  value={content}
                  onChangeText={setContent}
                  placeholder="Duyuru metni..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  maxLength={500}
                  className="mt-3 rounded-xl border border-border-soft bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary"
                  style={{ minHeight: 100, textAlignVertical: 'top' }}
                />

                <Pressable
                  onPress={handlePublish}
                  disabled={saving}
                  className={`mt-4 flex-row items-center justify-center rounded-xl bg-accent py-3 active:opacity-80 ${
                    saving ? 'opacity-60' : ''
                  }`}
                >
                  {saving ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Check color="white" size={16} />
                  )}
                  <Text className="ml-1.5 text-sm font-bold text-white">Yayınla</Text>
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
