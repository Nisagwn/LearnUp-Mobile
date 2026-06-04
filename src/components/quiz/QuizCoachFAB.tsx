import { Pressable, Text, View } from 'react-native';
import { Lightbulb } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  subject?: string;
  questionText?: string;
  options?: string[];
  grade?: string;
};

export function QuizCoachFAB({ subject, questionText, options, grade }: Props) {
  const router = useRouter();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    const ctx = JSON.stringify({ subject, questionText, options, grade });
    router.push(`/(student)/chatbot?ctx=${encodeURIComponent(ctx)}` as never);
  };

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withSpring(0.92, { damping: 12 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12 });
      }}
      onPress={handlePress}
      style={[
        animatedStyle,
        {
          position: 'absolute',
          right: 16,
          bottom: 96,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 24,
          backgroundColor: '#D97706',
          flexDirection: 'row',
          alignItems: 'center',
          shadowColor: '#D97706',
          shadowOpacity: 0.35,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 12,
          elevation: 8,
        },
      ]}
    >
      <Lightbulb color="white" size={18} />
      <View style={{ width: 6 }} />
      <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>Koç</Text>
    </AnimatedPressable>
  );
}
