import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';

type Target = '/(auth)/login' | '/(teacher)' | '/(student)';

export default function BootGuard() {
  const [target, setTarget] = useState<Target | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setTarget('/(auth)/login');
        return;
      }
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const role = userSnap.exists() ? (userSnap.data().role as string | undefined) : undefined;
        setTarget(role === 'teacher' ? '/(teacher)' : '/(student)');
      } catch (err) {
        setError((err as Error).message);
        setTarget('/(auth)/login');
      }
    });
    return unsub;
  }, []);

  if (target) {
    return <Redirect href={target as never} />;
  }

  return (
    <View className="flex-1 items-center justify-center bg-bg-base">
      <ActivityIndicator color="#6366F1" size="large" />
      <Text className="mt-4 text-sm text-text-muted">LearnUp yükleniyor…</Text>
      {error ? <Text className="mt-2 text-xs text-danger">{error}</Text> : null}
    </View>
  );
}
