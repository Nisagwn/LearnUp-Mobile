import type { ReactNode } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GraduationCap, Share2, KeyRound } from 'lucide-react-native';

type Props = {
  name: string;
  branch?: string | null;
  classCode: string | null;
  codeLoading?: boolean;
  onShareCode: () => void;
  /** Sağ üst köşe slot'u — bildirim çanı gibi global ikonlar için. */
  rightSlot?: ReactNode;
};

export function TeacherHero({
  name,
  branch,
  classCode,
  codeLoading,
  onShareCode,
  rightSlot,
}: Props) {
  return (
    <View className="overflow-hidden rounded-3xl">
      <LinearGradient
        colors={['#16A34A', '#15803D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 24 }}
        className="p-4"
      >
        <View className="flex-row items-center">
          <View className="h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
            <GraduationCap color="white" size={22} />
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-[11px] text-white/80">Hoş geldin,</Text>
            <Text className="text-lg font-bold text-white" numberOfLines={1}>
              {name}
            </Text>
            {branch ? (
              <Text className="text-[11px] text-white/75" numberOfLines={1}>
                {branch}
              </Text>
            ) : null}
          </View>
          {rightSlot ? <View className="ml-2">{rightSlot}</View> : null}
        </View>

        <View className="mt-3 flex-row items-center rounded-2xl bg-white/15 p-2.5">
          <KeyRound color="white" size={18} />
          <View className="ml-2.5 flex-1">
            <Text className="text-[10px] uppercase tracking-wide text-white/70">Sınıf Kodu</Text>
            {codeLoading ? (
              <ActivityIndicator color="white" size="small" style={{ alignSelf: 'flex-start' }} />
            ) : (
              <Text className="text-lg font-bold tracking-[3px] text-white">{classCode ?? '—'}</Text>
            )}
          </View>
          <Pressable
            onPress={onShareCode}
            disabled={!classCode}
            className={`flex-row items-center rounded-full bg-white px-3 py-1.5 active:opacity-80 ${
              !classCode ? 'opacity-50' : ''
            }`}
          >
            <Share2 color="#15803D" size={13} />
            <Text className="ml-1 text-[11px] font-bold text-accent-fg">Paylaş</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </View>
  );
}
