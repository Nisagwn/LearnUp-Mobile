import { useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { QuestionForm } from '@/components/teacher/QuestionForm';
import { createManualQuestion } from '@/services/teacherQuestionsApi';

export default function CreateQuestionScreen() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (data: Parameters<typeof createManualQuestion>[0]) => {
    if (saving) return;
    setSaving(true);
    try {
      await createManualQuestion(data);
      Alert.alert('Eklendi', 'Soru havuzuna eklendi.', [
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
        <Text className="ml-1 text-xl font-bold text-text-primary">Yeni Soru</Text>
      </View>
      <QuestionForm submitLabel="Soruyu Kaydet" loading={saving} onSubmit={handleSubmit} />
    </SafeAreaView>
  );
}
