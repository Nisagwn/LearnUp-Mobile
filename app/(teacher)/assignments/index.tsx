import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ClipboardList, Plus, Calendar, Trash2 } from 'lucide-react-native';
import { auth } from '@/services/firebase';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import {
  subscribeTeacherAssignments,
  deleteAssignment,
  type TeacherAssignment,
} from '@/services/assignmentsApi';

function formatDue(ms: number | null): string | null {
  if (!ms) return null;
  return new Date(ms).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

export default function TeacherAssignments() {
  const router = useRouter();
  const [items, setItems] = useState<TeacherAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }
    const unsub = subscribeTeacherAssignments(uid, (arr) => {
      setItems(arr);
      setLoading(false);
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  const handleDelete = (id: string) => {
    Alert.alert('Ödevi sil', 'Bu ödev silinecek. Emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAssignment(id);
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
          onPress={() => router.push('/(teacher)/assignments/create' as never)}
          className="mr-2 flex-row items-center rounded-full bg-accent px-3.5 py-2 active:opacity-80"
        >
          <Plus color="white" size={14} />
          <Text className="ml-1 text-xs font-bold text-white">Yeni Ödev</Text>
        </Pressable>
      </View>
      <View className="px-5 pt-1">
        <Text className="text-3xl font-bold text-text-primary">Ödevler</Text>
        <Text className="mt-1 text-sm text-text-muted">{items.length} ödev</Text>
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
              icon={ClipboardList}
              title="Henüz ödev yok"
              subtitle="Yeni Ödev ile sınıfına ilk ödevini ver"
            />
          }
          renderItem={({ item }) => {
            const due = formatDue(item.dueDateMs);
            return (
              <Card
                onPress={() =>
                  router.push(`/(teacher)/assignments/${item.id}/submissions` as never)
                }
              >
                <View className="flex-row items-center">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-text-primary" numberOfLines={1}>
                      {item.title || 'Başlıksız'}
                    </Text>
                    <View className="mt-1 flex-row items-center">
                      {item.subject ? (
                        <Text className="text-[10px] uppercase tracking-wide text-accent-fg">
                          {item.subject}
                        </Text>
                      ) : null}
                      {item.questionIds.length > 0 ? (
                        <Text className="ml-2 text-[10px] text-text-muted">
                          {item.questionIds.length} soru
                        </Text>
                      ) : null}
                    </View>
                    {due ? (
                      <View className="mt-2 flex-row items-center">
                        <Calendar color="#94A3B8" size={11} />
                        <Text className="ml-1 text-xs text-text-muted">Son: {due}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Pressable onPress={() => handleDelete(item.id)} className="p-1 active:opacity-60">
                    <Trash2 color="#DC2626" size={16} />
                  </Pressable>
                </View>
              </Card>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
