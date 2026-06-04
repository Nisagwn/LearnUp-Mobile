import { Pressable, View, Text } from 'react-native';

export type SegmentedTab<T extends string> = {
  id: T;
  label: string;
  count?: number;
  accent?: string; // active state badge background
};

type Props<T extends string> = {
  tabs: ReadonlyArray<SegmentedTab<T>>;
  active: T;
  onChange: (id: T) => void;
  className?: string;
};

export function SegmentedTabs<T extends string>({ tabs, active, onChange, className = '' }: Props<T>) {
  return (
    <View
      className={`flex-row items-center rounded-2xl bg-bg-elevated p-1 ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            // NOT: Aktif sekmede dinamik gölge/elevation (shadow-sm + style={elevation})
            // EKLENMEZ. NativeWind (css-interop) bunu re-render'da "yükseltilmeli"
            // sayıp dev-only uyarı basıyor; uyarı serileştirmesi React fiber'ı
            // dolaşırken navigation context getter'ına çarpıp çöküyordu. Aktiflik
            // yalnız arka plan + yazı rengiyle gösteriliyor (renk toggle güvenli).
            className={`flex-1 flex-row items-center justify-center rounded-xl px-2 py-2 ${
              isActive ? 'bg-bg-base' : ''
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                isActive ? 'text-text-primary' : 'text-text-muted'
              }`}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
            {typeof tab.count === 'number' && tab.count > 0 ? (
              <View
                className={`ml-1.5 min-w-[18px] items-center justify-center rounded-full px-1.5 py-0.5 ${
                  isActive ? 'bg-accent-soft' : 'bg-bg-base'
                }`}
              >
                <Text
                  className={`text-[10px] font-bold ${
                    isActive ? 'text-accent-fg' : 'text-text-muted'
                  }`}
                >
                  {tab.count > 99 ? '99+' : tab.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
