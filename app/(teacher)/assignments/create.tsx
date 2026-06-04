import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Check, ListChecks, X, Eye } from 'lucide-react-native';
import { auth } from '@/services/firebase';
import { createAssignment } from '@/services/assignmentsApi';
import type { QuestionRow } from '@/components/teacher/QuestionPickerSheet';
import { SmartQuestionWizard } from '@/components/teacher/SmartQuestionWizard';
import { Card } from '@/components/common/Card';
import { MathRenderer } from '@/components/quiz/MathRenderer';

const DUE_OPTIONS: { id: string; label: string; days: number | null }[] = [
  { id: 'none', label: 'Tarihsiz', days: null },
  { id: '1', label: 'Yarın', days: 1 },
  { id: '3', label: '3 gün', days: 3 },
  { id: '7', label: '1 hafta', days: 7 },
  { id: '14', label: '2 hafta', days: 14 },
];

export default function CreateAssignment() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [dueId, setDueId] = useState<string>('7');
  const [picked, setPicked] = useState<QuestionRow[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const removeQuestion = (id: string) => {
    setPicked((prev) => prev.filter((q) => q.id !== id));
  };

  const handleSave = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    if (title.trim().length < 2) {
      Alert.alert('Eksik bilgi', 'Ödev başlığı en az 2 karakter olmalı.');
      return;
    }
    Alert.alert(
      'Ödevi yayınla',
      picked.length > 0
        ? `${picked.length} soruyu öğrencilere göndereceksin. Onaylıyor musun?`
        : 'Soru eklemeden boş bir ödev yayınlanacak. Devam edilsin mi?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Yayınla',
          onPress: async () => {
            setSaving(true);
            try {
              const opt = DUE_OPTIONS.find((o) => o.id === dueId);
              let dueDate: Date | null = null;
              if (opt?.days != null) {
                const d = new Date();
                d.setDate(d.getDate() + opt.days);
                d.setHours(23, 59, 0, 0);
                dueDate = d;
              }
              const questionIds = picked.map((p) => p.id);
              await createAssignment(uid, {
                title,
                description,
                subject,
                dueDate,
                questionIds,
                submissionType: questionIds.length > 0 ? 'quiz' : 'free',
              });
              router.back();
            } catch (err) {
              Alert.alert('Hata', (err as Error).message);
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-bg-base"
    >
      <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
        <View className="flex-row items-center px-3 pt-2">
          <Pressable onPress={() => router.back()} className="p-2 active:opacity-60">
            <ChevronLeft color="#475569" size={22} />
          </Pressable>
          <Text className="ml-1 text-2xl font-bold text-text-primary">Yeni Ödev</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <Text className="text-xs font-semibold uppercase tracking-wide text-text-muted">Başlık</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Örn. Türev Problemleri"
            placeholderTextColor="#94A3B8"
            maxLength={80}
            className="mt-1.5 rounded-xl border border-border-soft bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary"
          />

          <Text className="mt-4 text-xs font-semibold uppercase tracking-wide text-text-muted">Ders</Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder="Örn. Matematik"
            placeholderTextColor="#94A3B8"
            maxLength={40}
            className="mt-1.5 rounded-xl border border-border-soft bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary"
          />

          <Text className="mt-4 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Açıklama
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Ödev detayları, beklentiler..."
            placeholderTextColor="#94A3B8"
            multiline
            maxLength={500}
            className="mt-1.5 rounded-xl border border-border-soft bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary"
            style={{ minHeight: 90, textAlignVertical: 'top' }}
          />

          {/* Soru havuzundan seçim */}
          <Text className="mt-5 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Sorular
          </Text>
          <Pressable
            onPress={() => setPickerOpen(true)}
            className="mt-1.5 flex-row items-center rounded-xl border border-border-soft bg-bg-surface p-3.5 active:opacity-80"
          >
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-accent-soft">
              <ListChecks color="#4F46E5" size={18} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-sm font-semibold text-text-primary">
                {picked.length === 0 ? 'Soru ekle' : 'Soruları değiştir / ekle'}
              </Text>
              <Text className="text-[11px] text-text-muted">
                {picked.length === 0
                  ? 'Havuzdan seç — öğrenci çözer, otomatik puanlanır'
                  : 'Yeni ekleme yapabilir veya seçimi değiştirebilirsin'}
              </Text>
            </View>
          </Pressable>

          {/* Seçili soruların önizlemesi — öğretmen son kez kontrol eder */}
          {picked.length > 0 ? (
            <View className="mt-4">
              <View className="flex-row items-center" style={{ gap: 6 }}>
                <Eye color="#4F46E5" size={14} />
                <Text className="text-xs font-semibold uppercase tracking-wide text-accent-fg">
                  Ön İzleme ({picked.length} soru)
                </Text>
              </View>
              <Text className="mt-0.5 text-[11px] text-text-muted">
                Öğrenciye gitmeden önce gözden geçir. İstemediğini × ile çıkar.
              </Text>
              <View className="mt-3" style={{ gap: 8 }}>
                {picked.map((q, idx) => {
                  const metaParts = [q.subject];
                  if (q.grade) metaParts.push(`${q.grade}. sınıf`);
                  if (q.difficulty) metaParts.push(q.difficulty);
                  return (
                    <Card key={q.id}>
                      <View className="flex-row items-start justify-between">
                        <View className="flex-1 flex-row items-center">
                          <View className="mr-2 h-6 w-6 items-center justify-center rounded-md bg-accent">
                            <Text className="text-[11px] font-bold text-white">{idx + 1}</Text>
                          </View>
                          <Text className="flex-1 text-[10px] uppercase tracking-wide text-accent-fg">
                            {metaParts.join(' · ')}
                          </Text>
                          {q.isAI ? (
                            <View className="ml-1.5 rounded-full bg-bg-elevated px-1.5 py-0.5">
                              <Text className="text-[9px] font-semibold text-text-muted">AI</Text>
                            </View>
                          ) : null}
                        </View>
                        <Pressable
                          onPress={() => removeQuestion(q.id)}
                          hitSlop={8}
                          className="ml-2 h-7 w-7 items-center justify-center rounded-full border border-border-soft bg-bg-base active:bg-bg-elevated"
                        >
                          <X color="#DC2626" size={14} />
                        </Pressable>
                      </View>
                      <View className="mt-2">
                        <MathRenderer content={q.text} fontSize={13} color="#0F172A" />
                      </View>
                    </Card>
                  );
                })}
              </View>
            </View>
          ) : null}

          <Text className="mt-5 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Son Tarih
          </Text>
          <View className="mt-1.5 flex-row flex-wrap" style={{ gap: 8 }}>
            {DUE_OPTIONS.map((o) => (
              <Pressable
                key={o.id}
                onPress={() => setDueId(o.id)}
                className={`rounded-xl border px-3.5 py-2 ${
                  dueId === o.id ? 'border-accent bg-accent-soft' : 'border-border-soft bg-bg-surface'
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    dueId === o.id ? 'text-accent-fg' : 'text-text-muted'
                  }`}
                >
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={handleSave}
            disabled={saving}
            className={`mt-6 flex-row items-center justify-center rounded-xl bg-accent py-3 active:opacity-80 ${
              saving ? 'opacity-60' : ''
            }`}
          >
            {saving ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Check color="white" size={16} />
            )}
            <Text className="ml-1.5 text-sm font-bold text-white">
              {picked.length > 0
                ? `${picked.length} soruyu Yayınla`
                : 'Ödevi Yayınla'}
            </Text>
          </Pressable>
        </ScrollView>

        <SmartQuestionWizard
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onConfirm={(rows) => {
            setPicked(rows);
            setPickerOpen(false);
          }}
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
