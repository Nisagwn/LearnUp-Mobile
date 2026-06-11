import { memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  Sparkles,
  Check,
  AlertTriangle,
} from 'lucide-react-native';
import { MathRenderer } from '@/components/quiz/MathRenderer';
import { useThemeColors } from '@/hooks/useThemeColors';
import { latexToPlainText } from '@/utils/latex';
import type { QuestionRow } from '@/components/teacher/QuestionPickerSheet';

type Props = {
  row: QuestionRow;
  index: number;
  expanded: boolean;
  approved: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onApprove: () => void;
};

/**
 * Ödev inceleme kartı. Kapalıyken hızlı düz-metin önizleme (WebView yok);
 * açılınca tam soru (MathRenderer) + seçenekler (doğru cevap vurgulu) + açıklama.
 * Onaysız (verified:false) sorular için "Onayla" aksiyonu içerir.
 */
function QuestionReviewCardBase({
  row,
  index,
  expanded,
  approved,
  onToggle,
  onRemove,
  onApprove,
}: Props) {
  const { colors } = useThemeColors();
  const needsApproval = row.verified === false && !approved;
  const options = row.options ?? [];
  const correctIdx = typeof row.answer === 'number' ? row.answer : -1;

  const meta = [row.subject];
  if (row.grade) meta.push(`${row.grade}. sınıf`);
  if (row.difficulty) meta.push(row.difficulty);

  return (
    <View
      className={`rounded-2xl border bg-bg-surface ${
        needsApproval ? 'border-warning/50' : 'border-border-soft'
      }`}
    >
      {/* Başlık — tıklayınca aç/kapa */}
      <Pressable onPress={onToggle} className="flex-row items-start p-3 active:opacity-80">
        <View className="mr-2 mt-0.5 h-6 w-6 items-center justify-center rounded-md bg-accent">
          <Text className="text-[11px] font-bold text-white">{index + 1}</Text>
        </View>
        <View className="flex-1">
          <View className="flex-row flex-wrap items-center" style={{ gap: 6 }}>
            <Text className="text-[10px] uppercase tracking-wide text-accent-fg">
              {meta.join(' · ')}
            </Text>
            {row.isAI ? (
              <View className="flex-row items-center rounded-full bg-accent-soft px-1.5 py-0.5">
                <Sparkles color={colors.accent} size={9} />
                <Text className="ml-0.5 text-[9px] font-semibold text-accent-fg">AI</Text>
              </View>
            ) : null}
            {row.verified === false ? (
              approved ? (
                <View className="flex-row items-center rounded-full bg-success-soft px-1.5 py-0.5">
                  <Check color={colors.success} size={9} />
                  <Text className="ml-0.5 text-[9px] font-semibold text-success">Onaylandı</Text>
                </View>
              ) : (
                <View className="rounded-full bg-warning-soft px-1.5 py-0.5">
                  <Text className="text-[9px] font-semibold text-warning">Onay bekliyor</Text>
                </View>
              )
            ) : null}
          </View>
          <Text className="mt-1 text-sm leading-5 text-text-primary" numberOfLines={expanded ? undefined : 2}>
            {latexToPlainText(row.text)}
          </Text>
        </View>
        <View className="ml-2 items-center" style={{ gap: 8 }}>
          <Pressable onPress={onRemove} hitSlop={8} className="active:opacity-60">
            <X color={colors.danger} size={16} />
          </Pressable>
          {expanded ? (
            <ChevronUp color={colors.textMuted} size={16} />
          ) : (
            <ChevronDown color={colors.textMuted} size={16} />
          )}
        </View>
      </Pressable>

      {/* Açık içerik */}
      {expanded ? (
        <View className="px-3 pb-3">
          <View className="h-px bg-border-soft" />
          {/* Tam soru — yalnız açık kartta WebView render edilir */}
          <View className="mt-3 rounded-xl border border-border-soft bg-bg-base p-3">
            <MathRenderer content={row.text} fontSize={14} color={colors.textPrimary} />
          </View>

          {/* Seçenekler */}
          {options.length > 0 ? (
            <View className="mt-3" style={{ gap: 6 }}>
              {options.map((opt, i) => {
                const isCorrect = i === correctIdx;
                return (
                  <View
                    key={i}
                    className={`flex-row items-start rounded-xl border p-2.5 ${
                      isCorrect ? 'border-success bg-success-soft' : 'border-border-soft bg-bg-base'
                    }`}
                  >
                    <View
                      className={`mr-2.5 h-6 w-6 items-center justify-center rounded-full ${
                        isCorrect ? 'bg-success' : 'bg-bg-elevated'
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-bold ${isCorrect ? 'text-white' : 'text-text-muted'}`}
                      >
                        {String.fromCharCode(65 + i)}
                      </Text>
                    </View>
                    <View className="flex-1 pt-0.5">
                      <MathRenderer content={opt} fontSize={13} color={colors.textPrimary} />
                    </View>
                    {isCorrect ? (
                      <CheckCircle2 color={colors.success} size={15} style={{ marginLeft: 4, marginTop: 3 }} />
                    ) : null}
                  </View>
                );
              })}
              {correctIdx < 0 ? (
                <View className="mt-1 flex-row items-center">
                  <AlertTriangle color={colors.warning} size={12} />
                  <Text className="ml-1 text-[11px] italic text-warning">
                    Doğru cevap işaretli değil — soruyu düzenleyip ayarla.
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <View className="mt-3 rounded-xl border border-warning/30 bg-warning-soft p-3">
              <Text className="text-xs text-text-secondary">
                Bu sorunun seçenekleri yüklenemedi — eski formatta olabilir.
              </Text>
            </View>
          )}

          {/* Açıklama */}
          {row.explanation ? (
            <View className="mt-3 rounded-xl border border-border-soft bg-bg-base p-3">
              <Text className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Açıklama
              </Text>
              <MathRenderer content={row.explanation} fontSize={12} color={colors.textSecondary} />
            </View>
          ) : null}

          {/* Onay aksiyonu (yalnız onaysız sorularda) */}
          {row.verified === false ? (
            approved ? (
              <View className="mt-3 flex-row items-center justify-center rounded-xl bg-success-soft py-2.5">
                <CheckCircle2 color={colors.success} size={15} />
                <Text className="ml-1.5 text-sm font-bold text-success">Onaylandı</Text>
              </View>
            ) : (
              <Pressable
                onPress={onApprove}
                className="mt-3 flex-row items-center justify-center rounded-xl bg-success py-2.5 active:opacity-80"
              >
                <Check color={colors.white} size={16} />
                <Text className="ml-1.5 text-sm font-bold text-white">Bu soruyu onayla</Text>
              </Pressable>
            )
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export const QuestionReviewCard = memo(QuestionReviewCardBase);
