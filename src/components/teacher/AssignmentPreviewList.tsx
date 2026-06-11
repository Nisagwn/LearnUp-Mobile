import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Info, X, Sparkles, RefreshCw, Plus } from 'lucide-react-native';
import { Card } from '@/components/common/Card';
import { latexToPlainText } from '@/utils/latex';
import type { QuestionRow } from '@/components/teacher/QuestionPickerSheet';

type Props = {
  filterSummary: string;
  rows: QuestionRow[];
  busy?: 'regenerate' | 'add' | 'ai' | null;
  onBack: () => void;
  onOpenDetail: (id: string) => void;
  onRemove: (id: string) => void;
  onRegenerate: () => void;
  onAddOne: () => void;
  onAddAI: () => void;
  onConfirm: () => void;
};

export function AssignmentPreviewList({
  filterSummary,
  rows,
  busy,
  onBack,
  onOpenDetail,
  onRemove,
  onRegenerate,
  onAddOne,
  onAddAI,
  onConfirm,
}: Props) {
  return (
    <View>
      <Pressable
        onPress={onBack}
        className="mb-3 flex-row items-center rounded-xl border border-border-soft bg-bg-surface p-3 active:bg-bg-elevated"
      >
        <Text className="flex-1 text-xs text-text-secondary">◀ {filterSummary}</Text>
        <Text className="text-[11px] font-semibold text-accent-fg">Filtreyi düzenle</Text>
      </Pressable>

      <View style={{ gap: 8 }}>
        {rows.map((q, idx) => {
          const meta = [q.subject];
          if (q.grade) meta.push(`${q.grade}. sınıf`);
          if (q.difficulty) meta.push(q.difficulty);
          return (
            <Card key={q.id}>
              <View className="flex-row items-start">
                <View className="mr-2 mt-0.5 h-6 w-6 items-center justify-center rounded-md bg-accent">
                  <Text className="text-[11px] font-bold text-white">{idx + 1}</Text>
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="flex-1 text-[10px] uppercase tracking-wide text-accent-fg">
                      {meta.join(' · ')}
                    </Text>
                    {q.isAI ? (
                      <View className="ml-1.5 rounded-full bg-accent-soft px-1.5 py-0.5">
                        <Text className="text-[9px] font-semibold text-accent-fg">AI</Text>
                      </View>
                    ) : null}
                    {q.verified === false ? (
                      <View className="ml-1.5 rounded-full bg-warning-soft px-1.5 py-0.5">
                        <Text className="text-[9px] font-semibold text-warning">Onay bekliyor</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text className="mt-1.5 text-sm leading-5 text-text-primary" numberOfLines={3}>
                    {latexToPlainText(q.text)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => onOpenDetail(q.id)}
                  hitSlop={6}
                  className="ml-2 p-1 active:opacity-60"
                >
                  <Info color="#15803D" size={15} />
                </Pressable>
                <Pressable
                  onPress={() => onRemove(q.id)}
                  hitSlop={6}
                  className="ml-1 p-1 active:opacity-60"
                >
                  <X color="#DC2626" size={15} />
                </Pressable>
              </View>
            </Card>
          );
        })}
      </View>

      {rows.length === 0 ? (
        <View className="mt-2 items-center rounded-xl border border-border-soft bg-bg-surface p-5">
          <Text className="text-xs text-text-muted">Hiç soru kalmadı.</Text>
        </View>
      ) : null}

      <View className="mt-4 flex-row" style={{ gap: 8 }}>
        <ActionPill
          icon={<RefreshCw color="#475569" size={14} />}
          label="Yeniden Öner"
          onPress={onRegenerate}
          busy={busy === 'regenerate'}
        />
        <ActionPill
          icon={<Plus color="#475569" size={14} />}
          label="+1 Soru"
          onPress={onAddOne}
          busy={busy === 'add'}
        />
        <ActionPill
          icon={<Sparkles color="#15803D" size={14} />}
          label="+5 AI Üret"
          onPress={onAddAI}
          busy={busy === 'ai'}
          accent
        />
      </View>

      <Pressable
        onPress={onConfirm}
        disabled={rows.length === 0}
        className={`mt-4 items-center rounded-xl py-3.5 active:opacity-80 ${
          rows.length === 0 ? 'bg-bg-elevated' : 'bg-accent'
        }`}
      >
        <Text
          className={`text-sm font-bold ${
            rows.length === 0 ? 'text-text-muted' : 'text-white'
          }`}
        >
          Bu Seti Kullan ({rows.length} soru)
        </Text>
      </Pressable>
    </View>
  );
}

function ActionPill({
  icon,
  label,
  onPress,
  busy,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  busy?: boolean;
  accent?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      className={`flex-1 flex-row items-center justify-center rounded-xl border py-2 active:opacity-80 ${
        accent ? 'border-accent bg-accent-soft' : 'border-border-soft bg-bg-surface'
      } ${busy ? 'opacity-60' : ''}`}
    >
      {busy ? (
        <ActivityIndicator color={accent ? '#15803D' : '#475569'} size="small" />
      ) : (
        icon
      )}
      <Text
        className={`ml-1.5 text-[11px] font-semibold ${
          accent ? 'text-accent-fg' : 'text-text-secondary'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
