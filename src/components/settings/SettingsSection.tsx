import { View, Text } from 'react-native';
import type { ReactNode } from 'react';

type Props = {
  title?: string;
  children: ReactNode;
};

export function SettingsSection({ title, children }: Props) {
  return (
    <View className="mt-6 px-5">
      {title ? (
        <Text className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
          {title}
        </Text>
      ) : null}
      <View className="overflow-hidden rounded-2xl border border-border-soft bg-bg-surface">
        {children}
      </View>
    </View>
  );
}
