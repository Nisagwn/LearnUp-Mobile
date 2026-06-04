import { Tabs } from 'expo-router';
import { LayoutDashboard, FileQuestion, Users, User } from 'lucide-react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { TabBarIcon } from '@/components/common/TabBarIcon';

export default function TeacherLayout() {
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
          title: 'Panel',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon icon={LayoutDashboard} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="classes"
        options={{
          title: 'Sınıflar',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon icon={Users} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="questions"
        options={{
          title: 'Sorular',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon icon={FileQuestion} color={color} focused={focused} />
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

      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="assignments" options={{ href: null }} />
      <Tabs.Screen name="announcements" options={{ href: null }} />
    </Tabs>
  );
}
