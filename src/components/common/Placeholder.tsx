import { View, Text } from 'react-native';
import { Construction } from 'lucide-react-native';

interface PlaceholderProps {
  title: string;
  subtitle?: string;
}

export function Placeholder({ title, subtitle = 'Yapım aşamasında' }: PlaceholderProps) {
  return (
    <View className="flex-1 items-center justify-center bg-bg-base px-6">
      <Construction color="#16A34A" size={48} />
      <Text className="mt-6 text-2xl font-bold text-text-primary">{title}</Text>
      <Text className="mt-2 text-sm text-text-muted">{subtitle}</Text>
    </View>
  );
}
