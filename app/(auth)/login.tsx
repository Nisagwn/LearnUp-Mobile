import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { AppLottie } from '@/components/common/AppLottie';
import { JumpGame } from '@/components/auth/JumpGame';
import { lottie } from '@/constants/lottie';
import { warning as hapticWarning } from '@/utils/haptics';

const schema = z.object({
  email: z.string().email('Geçerli bir e-posta giriniz'),
  password: z.string().min(6, 'En az 6 karakter'),
});

type FormData = z.infer<typeof schema>;

export default function Login() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Maskot tepkisi — hata olduğunda sallanır (etkileşimli, statik değil)
  const shake = useSharedValue(0);
  const mascotStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));
  const triggerShake = () => {
    shake.value = withSequence(
      withTiming(-10, { duration: 60 }),
      withTiming(10, { duration: 60 }),
      withTiming(-6, { duration: 60 }),
      withTiming(0, { duration: 60 }),
    );
  };

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      router.replace('/');
    } catch (err) {
      const msg = (err as Error).message.replace('Firebase:', '').trim();
      hapticWarning();
      triggerShake();
      Alert.alert('Giriş Hatası', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-bg-base"
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-12">
          <Animated.View entering={FadeInDown.duration(450)} style={mascotStyle} className="items-center">
            <AppLottie source={lottie.learning} style={{ width: 170, height: 150 }} loop autoPlay />
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(80).duration(400)}>
            <Text className="text-center text-3xl font-bold text-text-primary">Hoş Geldin 👋</Text>
            <Text className="mt-2 text-center text-base text-text-muted">
              LearnUp hesabına giriş yap
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(140).duration(400)} className="mt-8 gap-4">
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value } }) => (
                <View>
                  <Text className="mb-1 text-sm font-medium text-text-secondary">E-posta</Text>
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="ornek@email.com"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                    className="rounded-xl border border-border-soft bg-bg-surface px-4 py-3 text-base text-text-primary"
                  />
                  {errors.email && (
                    <Text className="mt-1 text-xs text-danger">{errors.email.message}</Text>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value } }) => (
                <View>
                  <Text className="mb-1 text-sm font-medium text-text-secondary">Şifre</Text>
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="••••••••"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry
                    autoComplete="password"
                    className="rounded-xl border border-border-soft bg-bg-surface px-4 py-3 text-base text-text-primary"
                  />
                  {errors.password && (
                    <Text className="mt-1 text-xs text-danger">{errors.password.message}</Text>
                  )}
                </View>
              )}
            />
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(200).duration(400)}>
            <Pressable
              onPress={handleSubmit(onSubmit)}
              disabled={loading}
              className="mt-8 items-center rounded-xl bg-accent py-4 active:opacity-80"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-base font-semibold text-white">Giriş Yap</Text>
              )}
            </Pressable>

            <View className="mt-6 flex-row justify-center">
              <Text className="text-sm text-text-muted">Hesabın yok mu? </Text>
              <Link href="/(auth)/signup" className="text-sm font-semibold text-accent-fg">
                Kayıt Ol
              </Link>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(280).duration(400)} className="mt-8">
            <JumpGame />
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
