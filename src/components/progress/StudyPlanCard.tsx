import { Pressable, View, Text } from 'react-native';
import { Repeat, Target, TrendingUp, Sparkles, Play, ChevronRight } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { StudyTask, StudyTaskKind } from '@/utils/studyPlan';

type Props = {
  tasks: StudyTask[];
  onTaskPress: (task: StudyTask) => void;
};

const KIND_META: Record<StudyTaskKind, { icon: LucideIcon; color: string; soft: string }> = {
  srs: { icon: Repeat, color: '#F59E0B', soft: '#FEF3C7' },
  weak: { icon: Target, color: '#DC2626', soft: '#FEE2E2' },
  momentum: { icon: TrendingUp, color: '#16A34A', soft: '#DCFCE7' },
  start: { icon: Sparkles, color: '#16A34A', soft: '#DCFCE7' },
};

export function StudyPlanCard({ tasks, onTaskPress }: Props) {
  if (tasks.length === 0) return null;
  const primary = tasks[0];

  return (
    <View className="rounded-2xl border border-border-soft bg-bg-surface p-4">
      <View className="gap-2">
        {tasks.map((task, i) => {
          const meta = KIND_META[task.kind];
          const Icon = meta.icon;
          return (
            <Pressable
              key={`${task.kind}-${task.subject}-${i}`}
              onPress={() => onTaskPress(task)}
              className="flex-row items-center rounded-xl bg-bg-base p-3 active:bg-bg-elevated"
            >
              <View
                className="h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: meta.soft }}
              >
                <Icon color={meta.color} size={18} />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-text-primary" numberOfLines={1}>
                  {task.title}
                </Text>
                <Text className="text-xs text-text-muted" numberOfLines={1}>
                  {task.reason}
                </Text>
              </View>
              <Text className="ml-2 text-[10px] font-medium text-text-muted">
                ~{task.estimatedMin} dk
              </Text>
              <ChevronRight color="#94A3B8" size={16} />
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => onTaskPress(primary)}
        className="mt-3 flex-row items-center justify-center rounded-xl bg-accent py-3 active:opacity-90"
      >
        <Play color="white" size={16} />
        <Text className="ml-2 text-sm font-semibold text-white">Çalışmaya Başla</Text>
      </Pressable>
    </View>
  );
}
