import { View, Text } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useNetwork } from '@/hooks/useNetwork';

export function OfflineBanner() {
  const { isConnected } = useNetwork();
  if (isConnected !== false) return null;

  return (
    <View className="flex-row items-center justify-center bg-amber-500/90 px-4 py-1.5">
      <WifiOff color="#1f2937" size={14} />
      <Text className="ml-2 text-xs font-semibold text-slate-900">Çevrimdışısın</Text>
    </View>
  );
}
