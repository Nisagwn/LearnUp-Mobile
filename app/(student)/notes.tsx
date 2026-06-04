import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Trash2, StickyNote, ChevronLeft } from 'lucide-react-native';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '@/services/firebase';
import { useSafeBack } from '@/hooks/useSafeBack';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { lottie } from '@/constants/lottie';

interface Note {
  id: string;
  text?: string;
  studentId?: string;
  createdAt?: { toMillis?: () => number };
}

export default function Notes() {
  const safeBack = useSafeBack('/(student)/profile');
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState('');

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'notes'), where('studentId', '==', uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: Note[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() } as Note));
        arr.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
        setNotes(arr);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  const addNote = async () => {
    const text = newText.trim();
    if (!text) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
      await addDoc(collection(db, 'notes'), {
        studentId: uid,
        text,
        createdAt: serverTimestamp(),
      });
      setNewText('');
      setAdding(false);
    } catch (err) {
      Alert.alert('Hata', (err as Error).message);
    }
  };

  const deleteNote = (id: string) => {
    Alert.alert('Notu Sil', 'Bu notu silmek istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'notes', id));
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
        <Pressable onPress={safeBack} className="p-2 active:opacity-60">
          <ChevronLeft color="#475569" size={22} />
        </Pressable>
        <Pressable
          onPress={() => setAdding(true)}
          className="h-10 w-10 items-center justify-center rounded-full bg-accent active:opacity-80"
        >
          <Plus color="white" size={20} />
        </Pressable>
      </View>

      <View className="px-5 pt-2">
        <Text className="text-3xl font-bold text-text-primary">Notlarım</Text>
        <Text className="mt-1 text-sm text-text-muted">{notes.length} not</Text>
      </View>

      {adding ? (
        <View className="mx-5 mt-4 rounded-2xl border border-border-soft bg-bg-surface p-4">
          <TextInput
            value={newText}
            onChangeText={setNewText}
            placeholder="Notunu yaz..."
            placeholderTextColor="#94A3B8"
            multiline
            className="text-base text-text-primary"
            style={{ minHeight: 80 }}
          />
          <View className="mt-3 flex-row gap-2">
            <Pressable
              onPress={() => {
                setAdding(false);
                setNewText('');
              }}
              className="flex-1 items-center rounded-xl border border-border-soft py-2 active:opacity-80"
            >
              <Text className="text-sm text-text-secondary">Vazgeç</Text>
            </Pressable>
            <Pressable
              onPress={addNote}
              className="flex-1 items-center rounded-xl bg-accent py-2 active:opacity-80"
            >
              <Text className="text-sm font-semibold text-white">Kaydet</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6366F1" />
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 8 }}
          ListEmptyComponent={
            <EmptyState
              lottieSource={lottie.empty}
              icon={StickyNote}
              title="Henüz not yok"
              subtitle="Sağ üstteki + butonu ile not ekle"
            />
          }
          renderItem={({ item }) => (
            <Card>
              <Text className="text-sm leading-5 text-text-primary">{item.text}</Text>
              <Pressable
                onPress={() => deleteNote(item.id)}
                className="mt-2 self-end p-1 active:opacity-60"
              >
                <Trash2 color="#DC2626" size={16} />
              </Pressable>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}
