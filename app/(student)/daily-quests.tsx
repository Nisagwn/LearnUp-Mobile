import { useContext } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Target } from 'lucide-react-native';
import { UserStatsContext } from '@/contexts/UserStatsContext';
import { DailyQuestsHero } from '@/components/home/DailyQuestsHero';
import { EmptyState } from '@/components/common/EmptyState';

export default function DailyQuestsScreen() {
  const router = useRouter();
  const ctx = useContext(UserStatsContext);
  const quests = ctx?.gamification?.dailyQuests?.quests ?? [];

  return (
    <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
      <View className="flex-row items-center px-3 py-2">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-bg-elevated"
          hitSlop={6}
        >
          <ChevronLeft color="#0F172A" size={22} />
        </Pressable>
        <Text className="ml-1 text-lg font-bold text-text-primary">Günlük Görevler</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        {quests.length === 0 ? (
          <EmptyState
            icon={Target}
            title="Bugün için görev hazırlanıyor"
            subtitle="Ana sayfayı yenile ya da bir soru çöz"
          />
        ) : (
          <DailyQuestsHero quests={quests} />
        )}

        <Text className="mt-6 text-xs text-text-muted">
          Görevler her gün 00:00&apos;da yenilenir. Tamamladıkça ödüllerini topla, haftalık lig
          puanına katkı sağlar.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
