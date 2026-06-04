import { Pressable } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ChatFAB() {
  const router = useRouter();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withSpring(0.92, { damping: 12 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12 });
      }}
      onPress={() => router.push('/(student)/chatbot')}
      style={[
        animatedStyle,
        {
          position: 'absolute',
          right: 20,
          bottom: 88,
          height: 56,
          width: 56,
          borderRadius: 28,
          backgroundColor: '#6366F1',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#6366F1',
          shadowOpacity: 0.35,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 12,
          elevation: 8,
        },
      ]}
    >
      <Sparkles color="white" size={24} />
    </AnimatedPressable>
  );
}
