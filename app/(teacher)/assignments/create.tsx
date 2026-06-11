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
import { ChevronLeft, Check, ListChecks, Eye, CheckCheck, ShieldAlert } from 'lucide-react-native';
import { auth } from '@/services/firebase';
import { createAssignment } from '@/services/assignmentsApi';
import { approveQuestions } from '@/services/questionPoolApi';
import type { QuestionRow } from '@/components/teacher/QuestionPickerSheet';
import { SmartQuestionWizard } from '@/components/teacher/SmartQuestionWizard';
import { QuestionReviewCard } from '@/components/teacher/QuestionReviewCard';

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

  const pendingCount = picked.filter(
    (q) => q.verified === false && !approvedIds.has(q.id),
  ).length;

  const removeQuestion = (id: string) => {
    setPicked((prev) => prev.filter((q) => q.id !== id));
    setApprovedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (expandedId === id) setExpandedId(null);
  };

  const approveOne = (id: string) =>
    setApprovedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });

  const approveAll = () =>
    setApprovedIds(() => {
      const next = new Set<string>();
      for (const q of picked) if (q.verified === false) next.add(q.id);
      return next;
    });

  const doPublish = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setSaving(true);
    try {
      // Öğretmenin incelediği onaysız soruları kalıcı onayla → öğrenciye yalnız
      // verified:true sorular gider.
      const unverifiedIds = picked.filter((p) => p.verified === false).map((p) => p.id);
      if (unverifiedIds.length > 0) await approveQuestions(unverifiedIds);

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
  };

  const handleSave = () => {
    if (!auth.currentUser?.uid) return;
    if (title.trim().length < 2) {
      Alert.alert('Eksik bilgi', 'Ödev başlığı en az 2 karakter olmalı.');
      return;
    }
    if (pendingCount > 0) {
      Alert.alert(
        'Onay gerekli',
        `${pendingCount} soru henüz onaylanmadı. Her birini inceleyip onayla ya da listeden çıkar.`,
      );
      return;
    }
    Alert.alert(
      'Ödevi yayınla',
      picked.length > 0
        ? `${picked.length} soru öğrencilere gönderilecek. Onaylıyor musun?`
        : 'Soru eklemeden boş bir ödev yayınlanacak. Devam edilsin mi?',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: picked.length > 0 ? 'Onayla & Yayınla' : 'Yayınla', onPress: doPublish },
      ],
    );
  };

  const canPublish = !saving && pendingCount === 0;

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
          {/* Ödev bilgileri */}
          <Text className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Başlık
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Örn. Türev Problemleri"
            placeholderTextColor="#94A3B8"
            maxLength={80}
            className="mt-1.5 rounded-xl border border-border-soft bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary"
          />

          <Text className="mt-4 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Ders
          </Text>
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

          {/* Soru kaynağı */}
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
                {picked.length === 0 ? 'Soru seç / üret' : 'Soruları değiştir / ekle'}
              </Text>
              <Text className="text-[11px] text-text-muted">
                {picked.length === 0
                  ? 'Müfredattan filtrele, havuzdan seç veya AI ile üret'
                  : 'Yeni set hazırla veya mevcut seçimi değiştir'}
              </Text>
            </View>
          </Pressable>

          {/* İnceleme + onay */}
          {picked.length > 0 ? (
            <View className="mt-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center" style={{ gap: 6 }}>
                  <Eye color="#4F46E5" size={14} />
                  <Text className="text-xs font-semibold uppercase tracking-wide text-accent-fg">
                    İnceleme ({picked.length} soru)
                  </Text>
                </View>
                {pendingCount > 0 ? (
                  <Pressable
                    onPress={approveAll}
                    className="flex-row items-center rounded-full bg-success px-2.5 py-1 active:opacity-80"
                  >
                    <CheckCheck color="white" size={12} />
                    <Text className="ml-1 text-[11px] font-bold text-white">Tümünü onayla</Text>
                  </Pressable>
                ) : null}
              </View>

              {pendingCount > 0 ? (
                <View className="mt-2 flex-row items-center rounded-xl border border-warning/40 bg-warning-soft p-2.5">
                  <ShieldAlert color="#D97706" size={14} />
                  <Text className="ml-2 flex-1 text-[11px] text-text-secondary">
                    {pendingCount} soru onay bekliyor. Karta dokunup inceleyebilir, onaylayabilir
                    veya çıkarabilirsin. Onaylanmadan yayınlanamaz.
                  </Text>
                </View>
              ) : (
                <Text className="mt-1 text-[11px] text-text-muted">
                  Tüm sorular onaylı. Öğrenciye gitmeden son bir kez göz at.
                </Text>
              )}

              <View className="mt-3" style={{ gap: 8 }}>
                {picked.map((q, idx) => (
                  <QuestionReviewCard
                    key={q.id}
                    row={q}
                    index={idx}
                    expanded={expandedId === q.id}
                    approved={approvedIds.has(q.id)}
                    onToggle={() => setExpandedId((cur) => (cur === q.id ? null : q.id))}
                    onRemove={() => removeQuestion(q.id)}
                    onApprove={() => approveOne(q.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/* Son Tarih */}
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
            disabled={!canPublish}
            className={`mt-6 flex-row items-center justify-center rounded-xl py-3 active:opacity-80 ${
              canPublish ? 'bg-accent' : 'bg-bg-elevated'
            }`}
          >
            {saving ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Check color={canPublish ? 'white' : '#94A3B8'} size={16} />
            )}
            <Text
              className={`ml-1.5 text-sm font-bold ${canPublish ? 'text-white' : 'text-text-muted'}`}
            >
              {pendingCount > 0
                ? `${pendingCount} soruyu onayla`
                : picked.length > 0
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
            // Yeni set → onay durumunu sıfırla
            setApprovedIds(new Set());
            setExpandedId(null);
            setPickerOpen(false);
          }}
        />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}
