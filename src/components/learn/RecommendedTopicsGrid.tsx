import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Sparkles, ChevronRight } from 'lucide-react-native';
import { SectionHeader } from '@/components/common/SectionHeader';

export interface WeakTopicEntry {
  subTopic: string;
  wrongCount?: number;
  lastWrongAt?: string;
}

type Props = {
  topics: WeakTopicEntry[];
  loadingId?: string | null;
  onTopicPress?: (subTopic: string) => void;
};

export function RecommendedTopicsGrid({ topics, loadingId, onTopicPress }: Props) {
  if (topics.length === 0) {
    return (
      <View>
        <SectionHeader title="Önerilen Alt Konular" />
        <View className="mt-3 rounded-2xl border border-border-soft bg-bg-surface p-5">
          <Text className="text-center text-sm text-text-muted">
            Soru çözdükçe burada zayıf konuların görünecek
          </Text>
        </View>
      </View>
    );
  }

  const top6 = topics.slice(0, 6);

  return (
    <View>
      <SectionHeader title="Önerilen Alt Konular" />
      <View className="mt-3 flex-row flex-wrap" style={{ gap: 10 }}>
        {top6.map((t) => {
          const isLoading = loadingId === t.subTopic;
          return (
            <Pressable
              key={t.subTopic}
              onPress={() => !isLoading && onTopicPress?.(t.subTopic)}
              disabled={isLoading}
              className="rounded-2xl border border-border-soft bg-bg-surface p-3 active:bg-bg-elevated"
              style={{ width: '48%' }}
            >
              <View className="flex-row items-center">
                <View
                  className="h-7 w-7 items-center justify-center rounded-xl"
                  style={{ backgroundColor: '#EEF2FF' }}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#6366F1" />
                  ) : (
                    <Sparkles color="#6366F1" size={14} />
                  )}
                </View>
                <ChevronRight color="#94A3B8" size={14} style={{ marginLeft: 'auto' }} />
              </View>
              <Text
                className="mt-2 text-sm font-semibold text-text-primary"
                numberOfLines={2}
              >
                {t.subTopic}
              </Text>
              {typeof t.wrongCount === 'number' && t.wrongCount > 0 ? (
                <Text className="mt-0.5 text-[10px] text-danger">{t.wrongCount} yanlış</Text>
              ) : (
                <Text className="mt-0.5 text-[10px] text-text-muted">Tekrar zamanı</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
