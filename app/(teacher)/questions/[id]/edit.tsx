import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { QuestionForm } from '@/components/teacher/QuestionForm';
import {
  getManualQuestion,
  updateManualQuestion,
  type ManualQuestionDoc,
  type ManualQuestionInput,
} from '@/services/teacherQuestionsApi';

export default function EditQuestionScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [doc, setDoc] = useState<ManualQuestionDoc | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) return;
      try {
        const data = await getManualQuestion(id);
        if (cancelled) return;
        if (!data) setNotFound(true);
        else setDoc(data);
      } catch (err) {
        if (!cancelled) {
          Alert.alert('Hata', (err as Error).message);
          setNotFound(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSubmit = async (data: ManualQuestionInput) => {
    if (saving || !id) return;
    setSaving(true);
    try {
      await updateManualQuestion(id, data);
      Alert.alert('Güncellendi', 'Soru kaydedildi.', [
        { text: 'Tamam', onPress: () => router.back() },
      ]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
      <View className="flex-row items-center px-3 pt-1">
        <Pressable onPress={() => router.back()} className="p-2 active:opacity-60" hitSlop={6}>
          <ChevronLeft color="#0F172A" size={24} />
        </Pressable>
        <Text className="ml-1 text-xl font-bold text-text-primary">Soruyu Düzenle</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6366F1" />
        </View>
      ) : notFound || !doc ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-base text-text-muted">Soru bulunamadı.</Text>
        </View>
      ) : (
        <QuestionForm
          initial={{
            subject: doc.subject,
            topic: doc.topic,
            sub_topic: doc.sub_topic,
            grade: doc.grade ?? '10',
            difficulty: doc.difficulty ?? 'medium',
            question: doc.question,
            choices: doc.choices,
            correctIndex: doc.correctIndex,
            explanation: doc.explanation,
          }}
          submitLabel="Değişiklikleri Kaydet"
          loading={saving}
          onSubmit={handleSubmit}
        />
      )}
    </SafeAreaView>
  );
}
