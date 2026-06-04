import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Users,
  FileQuestion,
  ListTodo,
  Megaphone,
  ChevronRight,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

type Link = {
  label: string;
  icon: LucideIcon;
  iconColor: string;
  bgColor: string;
  route: string;
};

const LINKS: Link[] = [
  {
    label: 'Sınıfım',
    icon: Users,
    iconColor: '#6366F1',
    bgColor: '#EEF2FF',
    route: '/(teacher)/classes',
  },
  {
    label: 'Soru Havuzu',
    icon: FileQuestion,
    iconColor: '#16A34A',
    bgColor: '#DCFCE7',
    route: '/(teacher)/questions',
  },
  {
    label: 'Ödevler',
    icon: ListTodo,
    iconColor: '#D97706',
    bgColor: '#FEF3C7',
    route: '/(teacher)/assignments',
  },
  {
    label: 'Duyurular',
    icon: Megaphone,
    iconColor: '#DC2626',
    bgColor: '#FEE2E2',
    route: '/(teacher)/announcements',
  },
];

/** Öğretmenin sık eriştiği sayfalara 2×2 navigasyon kart grid'i. */
export function TeacherQuickLinks() {
  const router = useRouter();

  return (
    <View className="flex-row flex-wrap" style={{ gap: 10 }}>
      {LINKS.map((link) => {
        const Icon = link.icon;
        return (
          <Pressable
            key={link.route}
            onPress={() => router.push(link.route as never)}
            className="flex-row items-center rounded-2xl border border-border-soft bg-bg-surface p-3.5 active:opacity-70"
            style={{ width: '48.5%' }}
          >
            <View
              className="h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: link.bgColor }}
            >
              <Icon color={link.iconColor} size={18} />
            </View>
            <Text
              className="ml-2.5 flex-1 text-sm font-semibold text-text-primary"
              numberOfLines={1}
            >
              {link.label}
            </Text>
            <ChevronRight color="#94A3B8" size={14} />
          </Pressable>
        );
      })}
    </View>
  );
}
