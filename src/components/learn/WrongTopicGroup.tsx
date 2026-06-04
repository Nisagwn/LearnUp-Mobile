import { useState } from 'react';
import { Pressable, View, Text } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import {
  ChevronDown,
  ChevronRight,
  RotateCw,
  Check,
} from 'lucide-react-native';
import type { SRSCard } from '@/utils/srs';
import { relativeReviewLabel } from '@/utils/srs';

type Props = {
  subTopic: string;
  subjectLabel: string;
  cards: SRSCard[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSolveGroup: () => void;
  onLongPressCard?: (id: string) => void;
};

export function WrongTopicGroup({
  subTopic,
  subjectLabel,
  cards,
  selectedIds,
  onToggleSelect,
  onSolveGroup,
  onLongPressCard,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const now = Date.now();
  const selectionMode = selectedIds.size > 0;

  return (
    <View className="rounded-2xl border border-border-soft bg-bg-surface">
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        className="flex-row items-center p-3 active:bg-bg-elevated"
      >
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-srs-new-soft">
          <Text className="text-base">{cards.length}</Text>
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-sm font-semibold text-text-primary" numberOfLines={1}>
            {subTopic}
          </Text>
          <Text className="text-[11px] text-text-muted" numberOfLines={1}>
            {subjectLabel} · {cards.length} kart
          </Text>
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onSolveGroup();
          }}
          className="mr-2 flex-row items-center rounded-full bg-accent px-3 py-1.5 active:opacity-80"
        >
          <RotateCw color="white" size={11} />
          <Text className="ml-1 text-[11px] font-bold text-white">Bu grubu çöz</Text>
        </Pressable>
        {expanded ? (
          <ChevronDown color="#94A3B8" size={18} />
        ) : (
          <ChevronRight color="#94A3B8" size={18} />
        )}
      </Pressable>

      {expanded ? (
        // NOT: Animated.View'a className verilmesi NativeWind cssInterop + Reanimated v4
        // layout-animation kombosunda render döngüsü tetikliyor (NavigationStateContext crash).
        // className iç View'a alınmıştır; Animated.View sadece entering/exiting taşır.
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
          <View className="border-t border-border-soft px-3 pb-3 pt-1">
            {cards.map((card) => {
            const selected = selectedIds.has(card.id);
            return (
              <Pressable
                key={card.id}
                onLongPress={() => onLongPressCard?.(card.id)}
                onPress={() => {
                  if (selectionMode) onToggleSelect(card.id);
                }}
                className={`mt-2 flex-row items-start rounded-xl border p-3 active:opacity-80 ${
                  selected
                    ? 'border-accent bg-accent-soft'
                    : 'border-border-soft bg-bg-base'
                }`}
              >
                {selectionMode ? (
                  <View
                    className={`mr-2 mt-0.5 h-4 w-4 items-center justify-center rounded-full border ${
                      selected
                        ? 'border-accent bg-accent'
                        : 'border-border-soft bg-bg-base'
                    }`}
                  >
                    {selected ? <Check color="white" size={10} /> : null}
                  </View>
                ) : null}
                <View className="flex-1">
                  <Text className="text-xs text-text-primary" numberOfLines={3}>
                    {card.snapshot?.question || '(soru metni yok — geriye dönük kayıt)'}
                  </Text>
                  <Text className="mt-1 text-[10px] text-text-muted">
                    Box {card.box} · {relativeReviewLabel(card.nextReviewAtMs, now)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}
