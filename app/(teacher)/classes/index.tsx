import { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, Pressable, Share, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { User, ChevronRight, Share2, RefreshCw, KeyRound } from 'lucide-react-native';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { ensureTeacherClassCode, regenerateClassCode } from '@/services/classApi';

interface StudentDoc {
  id: string;
  name?: string;
  email?: string;
  fullName?: string;
}

export default function ClassesList() {
  const router = useRouter();
  const [students, setStudents] = useState<StudentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [classCode, setClassCode] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(true);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'users'),
      where('teacherId', '==', uid),
      where('role', '==', 'student'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr: StudentDoc[] = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() } as StudentDoc));
        setStudents(arr);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setCodeLoading(false);
      return;
    }
    ensureTeacherClassCode(uid)
      .then((code) => setClassCode(code))
      .catch(() => setClassCode(null))
      .finally(() => setCodeLoading(false));
  }, []);

  const handleShareCode = async () => {
    if (!classCode) return;
    try {
      await Share.share({
        message: `LearnUp sınıfıma katıl! Sınıf kodum: ${classCode}\n\nÖğren sekmesinde Profil → Sınıfım → Sınıfa Katıl'dan bu kodu gir.`,
      });
    } catch {
      /* paylaşım iptal edildi */
    }
  };

  const handleRegenerate = () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    Alert.alert(
      'Kodu yenile',
      'Yeni bir kod oluşturulacak. Eski kod artık çalışmaz, ama sınıfındaki öğrenciler kalır. Devam edilsin mi?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Yenile',
          onPress: async () => {
            setCodeLoading(true);
            try {
              const code = await regenerateClassCode(uid);
              setClassCode(code);
            } catch (err) {
              Alert.alert('Hata', (err as Error).message);
            } finally {
              setCodeLoading(false);
            }
          },
        },
      ],
    );
  };

  const renderHeader = () => (
    <View className="rounded-2xl border border-accent/30 bg-accent-soft p-4">
      <View className="flex-row items-center">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent">
          <KeyRound color="white" size={18} />
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-xs text-text-muted">Sınıf Kodu</Text>
          {codeLoading ? (
            <ActivityIndicator color="#6366F1" size="small" style={{ alignSelf: 'flex-start' }} />
          ) : (
            <Text className="text-2xl font-bold tracking-[3px] text-text-primary">
              {classCode ?? '—'}
            </Text>
          )}
        </View>
      </View>
      <Text className="mt-2 text-[11px] text-text-muted">
        Öğrencilerin bu kodu Profil → Sınıfım'dan girerek sınıfına katılır.
      </Text>
      <View className="mt-3 flex-row" style={{ gap: 8 }}>
        <Pressable
          onPress={handleShareCode}
          disabled={!classCode}
          className={`flex-1 flex-row items-center justify-center rounded-xl bg-accent py-2.5 active:opacity-80 ${
            !classCode ? 'opacity-50' : ''
          }`}
        >
          <Share2 color="white" size={14} />
          <Text className="ml-1.5 text-xs font-bold text-white">Kodu Paylaş</Text>
        </Pressable>
        <Pressable
          onPress={handleRegenerate}
          className="flex-row items-center justify-center rounded-xl border border-border-soft bg-bg-base px-3.5 py-2.5 active:bg-bg-elevated"
        >
          <RefreshCw color="#475569" size={14} />
          <Text className="ml-1.5 text-xs font-semibold text-text-secondary">Yenile</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
      <View className="px-5 pt-2">
        <Text className="text-3xl font-bold text-text-primary">Öğrencilerim</Text>
        <Text className="mt-1 text-sm text-text-muted">{students.length} öğrenci</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6366F1" />
        </View>
      ) : (
        <FlatList
          data={students}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 24,
            gap: 8,
          }}
          ListHeaderComponent={<View className="mb-2">{renderHeader()}</View>}
          ListEmptyComponent={
            <EmptyState
              icon={User}
              title="Henüz öğrencin yok"
              subtitle="Sınıf kodunu paylaş — öğrenciler katıldıkça burada görünür"
            />
          }
          renderItem={({ item }) => {
            const name = item.name ?? item.fullName ?? item.email?.split('@')[0] ?? 'Öğrenci';
            return (
              <Card onPress={() => router.push(`/(teacher)/classes/${item.id}` as never)}>
                <View className="flex-row items-center">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-accent-soft">
                    <User color="#6366F1" size={18} />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-base font-semibold text-text-primary" numberOfLines={1}>
                      {name}
                    </Text>
                    {item.email ? (
                      <Text className="text-xs text-text-muted" numberOfLines={1}>
                        {item.email}
                      </Text>
                    ) : null}
                  </View>
                  <ChevronRight color="#94A3B8" size={20} />
                </View>
              </Card>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
