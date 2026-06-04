import { Tabs } from 'expo-router';
import { Home, BookOpen, TrendingUp, User } from 'lucide-react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { TabBarIcon } from '@/components/common/TabBarIcon';

export default function StudentLayout() {
  const { colors } = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgBase,
          borderTopColor: colors.borderSoft,
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accentFg,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon icon={Home} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: 'Öğren',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon icon={BookOpen} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'İlerleme',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon icon={TrendingUp} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon icon={User} color={color} focused={focused} />
          ),
        }}
      />

      <Tabs.Screen name="chatbot" options={{ href: null }} />
      <Tabs.Screen name="quiz" options={{ href: null }} />
      <Tabs.Screen name="notes" options={{ href: null }} />
      <Tabs.Screen name="assignments" options={{ href: null }} />
      <Tabs.Screen name="daily-quests" options={{ href: null }} />
      <Tabs.Screen name="league" options={{ href: null }} />
      <Tabs.Screen name="badges" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="targeted" options={{ href: null }} />
    </Tabs>
  );
}
