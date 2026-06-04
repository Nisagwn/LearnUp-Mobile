import { useEffect, useRef } from 'react';
import { Modal, Pressable, View, Text, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ConfettiCannon from 'react-native-confetti-cannon';
import * as Haptics from 'expo-haptics';
import { AppLottie } from '@/components/common/AppLottie';
import { lottie } from '@/constants/lottie';
import { gradients } from '@/constants/theme';

type Props = {
  visible: boolean;
  level: number;
  title?: string;
  onClose: () => void;
};

export function LevelUpModal({ visible, level, title, onClose }: Props) {
  const { width } = useWindowDimensions();
  const confettiRef = useRef<ConfettiCannon>(null);

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const t = setTimeout(() => confettiRef.current?.start(), 150);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/60 px-6">
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 28, width: '100%', maxWidth: 360 }}
          className="overflow-hidden p-8"
        >
          <View className="items-center">
            <AppLottie
              source={lottie.trophy}
              loop={false}
              autoPlay
              style={{ width: 120, height: 120 }}
            />
            <Text className="mt-2 text-xs uppercase tracking-widest text-white/80">
              Seviye Atladın
            </Text>
            <Text className="mt-1 text-5xl font-extrabold text-white">
              Seviye {level}
            </Text>
            {title ? (
              <Text className="mt-1 text-base font-semibold text-white/90">{title}</Text>
            ) : null}
            <Text className="mt-3 text-center text-sm text-white/80">
              Yolun açık olsun — bir sonraki seviye için XP toplamaya devam et.
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            className="mt-6 items-center rounded-2xl bg-white py-3.5 active:opacity-80"
          >
            <Text className="text-base font-bold text-accent-fg">Devam</Text>
          </Pressable>
        </LinearGradient>

        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        >
          <AppLottie source={lottie.celebrate} autoPlay loop style={{ flex: 1 }} />
        </View>

        <ConfettiCannon
          ref={confettiRef}
          count={120}
          origin={{ x: width / 2, y: -10 }}
          autoStart={false}
          fadeOut
          explosionSpeed={400}
          fallSpeed={2500}
        />
      </View>
    </Modal>
  );
}
