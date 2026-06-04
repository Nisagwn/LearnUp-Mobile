import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { AppLottie } from '@/components/common/AppLottie';
import { JumpGame } from '@/components/auth/JumpGame';
import { lottie } from '@/constants/lottie';
import { TEACHER_BRANCHES } from '@/constants/teacherBranches';

const GRADE_OPTIONS = ['9', '10', '11', '12'] as const;
type GradeOption = typeof GRADE_OPTIONS[number];

const schema = z
  .object({
    fullName: z.string().min(2, 'En az 2 karakter'),
    email: z.string().email('Geçerli bir e-posta giriniz'),
    password: z.string().min(6, 'En az 6 karakter'),
    confirmPassword: z.string(),
    role: z.enum(['student', 'teacher']),
    grade: z.enum(GRADE_OPTIONS).optional(),
    branch: z.enum(TEACHER_BRANCHES).optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Şifreler eşleşmiyor',
    path: ['confirmPassword'],
  })
  .superRefine((d, ctx) => {
    if (d.role === 'student' && !d.grade) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Sınıfını seç (9/10/11/12)',
        path: ['grade'],
      });
    }
    if (d.role === 'teacher' && !d.branch) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Branşını seç',
        path: ['branch'],
      });
    }
  });

type FormData = z.infer<typeof schema>;

export default function Signup() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '', role: 'student', grade: undefined, branch: undefined },
  });

  const role = watch('role');
  const grade = watch('grade');
  const branch = watch('branch');

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, data.email, data.password);
      await updateProfile(cred.user, { displayName: data.fullName });
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: data.email,
        name: data.fullName,
        role: data.role,
        grade: data.role === 'student' ? data.grade ?? null : null,
        branch: data.role === 'teacher' ? data.branch ?? null : null,
        createdAt: serverTimestamp(),
        stats: { totalChatMessages: 0 },
      });
      router.replace('/');
    } catch (err) {
      const msg = (err as Error).message.replace('Firebase:', '').trim();
      Alert.alert('Kayıt Hatası', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-bg-base"
    >
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-6 pt-10">
          <Animated.View entering={FadeInDown.duration(450)} className="items-center">
            <AppLottie source={lottie.learning} style={{ width: 120, height: 110 }} loop autoPlay />
          </Animated.View>
          <Text className="text-3xl font-bold text-text-primary">Kayıt Ol</Text>
          <Text className="mt-2 text-base text-text-muted">Yeni LearnUp hesabı oluştur</Text>

          <View className="mt-6 flex-row gap-2">
            <Pressable
              onPress={() => setValue('role', 'student')}
              className={`flex-1 items-center rounded-xl border py-3 ${
                role === 'student'
                  ? 'border-accent bg-accent-soft'
                  : 'border-border-soft bg-bg-surface'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  role === 'student' ? 'text-accent-fg' : 'text-text-muted'
                }`}
              >
                Öğrenci
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setValue('role', 'teacher')}
              className={`flex-1 items-center rounded-xl border py-3 ${
                role === 'teacher'
                  ? 'border-accent bg-accent-soft'
                  : 'border-border-soft bg-bg-surface'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  role === 'teacher' ? 'text-accent-fg' : 'text-text-muted'
                }`}
              >
                Öğretmen
              </Text>
            </Pressable>
          </View>

          {role === 'student' && (
            <View className="mt-5">
              <Text className="mb-2 text-sm font-medium text-text-secondary">Sınıf</Text>
              <View className="flex-row gap-2">
                {GRADE_OPTIONS.map((g) => (
                  <Pressable
                    key={g}
                    onPress={() => setValue('grade', g, { shouldValidate: true })}
                    className={`flex-1 items-center rounded-xl border py-3 ${
                      grade === g
                        ? 'border-accent bg-accent-soft'
                        : 'border-border-soft bg-bg-surface'
                    }`}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        grade === g ? 'text-accent-fg' : 'text-text-muted'
                      }`}
                    >
                      {g}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {errors.grade && (
                <Text className="mt-1 text-xs text-danger">{errors.grade.message as string}</Text>
              )}
            </View>
          )}

          {role === 'teacher' && (
            <View className="mt-5">
              <Text className="mb-2 text-sm font-medium text-text-secondary">Branş</Text>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {TEACHER_BRANCHES.map((b) => (
                  <Pressable
                    key={b}
                    onPress={() => setValue('branch', b, { shouldValidate: true })}
                    className={`rounded-full border px-3.5 py-2 active:opacity-80 ${
                      branch === b
                        ? 'border-accent bg-accent-soft'
                        : 'border-border-soft bg-bg-surface'
                    }`}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        branch === b ? 'text-accent-fg' : 'text-text-muted'
                      }`}
                    >
                      {b}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {errors.branch && (
                <Text className="mt-1 text-xs text-danger">{errors.branch.message as string}</Text>
              )}
            </View>
          )}

          <View className="mt-6 gap-4">
            <Controller
              control={control}
              name="fullName"
              render={({ field: { onChange, value } }) => (
                <View>
                  <Text className="mb-1 text-sm font-medium text-text-secondary">Ad Soyad</Text>
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="Adınız Soyadınız"
                    placeholderTextColor="#94A3B8"
                    className="rounded-xl border border-border-soft bg-bg-surface px-4 py-3 text-base text-text-primary"
                  />
                  {errors.fullName && (
                    <Text className="mt-1 text-xs text-danger">{errors.fullName.message}</Text>
                  )}
                </View>
              )}
            />

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
                    placeholder="En az 6 karakter"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry
                    className="rounded-xl border border-border-soft bg-bg-surface px-4 py-3 text-base text-text-primary"
                  />
                  {errors.password && (
                    <Text className="mt-1 text-xs text-danger">{errors.password.message}</Text>
                  )}
                </View>
              )}
            />

            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, value } }) => (
                <View>
                  <Text className="mb-1 text-sm font-medium text-text-secondary">Şifre Tekrar</Text>
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    placeholder="••••••••"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry
                    className="rounded-xl border border-border-soft bg-bg-surface px-4 py-3 text-base text-text-primary"
                  />
                  {errors.confirmPassword && (
                    <Text className="mt-1 text-xs text-danger">
                      {errors.confirmPassword.message}
                    </Text>
                  )}
                </View>
              )}
            />
          </View>

          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={loading}
            className="mt-8 items-center rounded-xl bg-accent py-4 active:opacity-80"
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-base font-semibold text-white">Hesap Oluştur</Text>
            )}
          </Pressable>

          <View className="mt-6 flex-row justify-center">
            <Text className="text-sm text-text-muted">Zaten hesabın var mı? </Text>
            <Link href="/(auth)/login" className="text-sm font-semibold text-accent-fg">
              Giriş Yap
            </Link>
          </View>

          <View className="mt-8">
            <JumpGame />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
