import { useContext, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Trophy } from 'lucide-react-native';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import { UserStatsContext } from '@/contexts/UserStatsContext';
import { getTierMeta, PROMOTE_COUNT, RELEGATE_COUNT } from '@/utils/league';
import { LeagueCard } from '@/components/home/LeagueCard';
import { EmptyState } from '@/components/common/EmptyState';
import { lottie } from '@/constants/lottie';

type Entry = {
  uid: string;
  name?: string;
  weeklyXP?: number;
  tier?: string;
};

export default function LeagueScreen() {
  const router = useRouter();
  const ctx = useContext(UserStatsContext);
  const league = ctx?.gamification?.league;
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!league?.tier || !league?.weekId) return;
    setLoading(true);
    (async () => {
      try {
        const q = query(
          collection(db, 'league_entries'),
          where('weekId', '==', league.weekId),
          where('tier', '==', league.tier),
          orderBy('weeklyXP', 'desc'),
          limit(30),
        );
        const snap = await getDocs(q);
        const arr: Entry[] = [];
        snap.forEach((d) => arr.push(d.data() as Entry));
        setEntries(arr);
      } catch {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [league?.tier, league?.weekId]);

  const meta = getTierMeta(league?.tier ?? 'bronze');
  const myUid = auth.currentUser?.uid;

  const myRank = useMemo(() => {
    if (!entries || !myUid) return null;
    const idx = entries.findIndex((e) => e.uid === myUid);
    return idx >= 0 ? idx + 1 : null;
  }, [entries, myUid]);

  return (
    <SafeAreaView className="flex-1 bg-bg-base" edges={['top']}>
      <View className="flex-row items-center px-3 py-2">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-bg-elevated"
          hitSlop={6}
        >
          <ChevronLeft color="#0F172A" size={22} />
        </Pressable>
        <Text className="ml-1 text-lg font-bold text-text-primary">{meta.label}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        {league?.tier ? (
          <LeagueCard tier={league.tier} weeklyXP={league.weeklyXP ?? 0} />
        ) : null}

        {myRank ? (
          <Text className="mt-4 text-sm text-text-secondary">
            Bu hafta lig içindeki yerin: <Text className="font-bold">{myRank}.</Text>
          </Text>
        ) : null}

        <View className="mt-4 rounded-2xl border border-border-soft bg-bg-surface p-4">
          <View className="flex-row items-center">
            <Trophy color="#6366F1" size={16} />
            <Text className="ml-2 text-xs text-text-muted">
              İlk {PROMOTE_COUNT} terfi · Son {RELEGATE_COUNT} kümede düşer
            </Text>
          </View>
        </View>

        {loading ? (
          <View className="mt-8 items-center">
            <ActivityIndicator color="#6366F1" />
          </View>
        ) : !entries || entries.length === 0 ? (
          <View className="mt-6">
            <EmptyState
              lottieSource={lottie.empty}
              icon={Trophy}
              title="Henüz sıralama yok"
              subtitle="Soru çöz, ilk sırayı sen kap"
            />
          </View>
        ) : (
          <View className="mt-4 gap-2">
            {entries.map((e, i) => {
              const rank = i + 1;
              const mine = e.uid === myUid;
              const promote = rank <= PROMOTE_COUNT;
              const relegate = rank > entries.length - RELEGATE_COUNT;
              const dotColor = promote ? '#16A34A' : relegate ? '#DC2626' : '#CBD5E1';
              return (
                <View
                  key={e.uid}
                  className={`flex-row items-center rounded-2xl border p-3 ${
                    mine
                      ? 'border-accent bg-accent-soft'
                      : 'border-border-soft bg-bg-surface'
                  }`}
                >
                  <View
                    className="h-7 w-7 items-center justify-center rounded-full"
                    style={{ backgroundColor: '#EEF2FF' }}
                  >
                    <Text className="text-xs font-bold text-accent-fg">{rank}</Text>
                  </View>
                  <Text
                    className="ml-3 flex-1 text-sm font-medium text-text-primary"
                    numberOfLines={1}
                  >
                    {e.name ?? 'Öğrenci'}
                    {mine ? ' · sen' : ''}
                  </Text>
                  <Text className="text-sm font-semibold text-text-primary">
                    {e.weeklyXP ?? 0} XP
                  </Text>
                  <View
                    className="ml-2"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: dotColor,
                    }}
                  />
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
