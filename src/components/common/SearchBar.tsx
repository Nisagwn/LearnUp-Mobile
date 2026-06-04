import { useEffect, useState } from 'react';
import { Pressable, View, TextInput } from 'react-native';
import { Search, X } from 'lucide-react-native';

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  autoFocus?: boolean;
};

/**
 * Debounce'lu arama kutusu. `value` her tuş vuruşunda iç state'e yazılır,
 * `onChange` `debounceMs` sonra çağrılır. Temizleme butonu hep gerçek state'i
 * temizler.
 */
export function SearchBar({
  value,
  onChange,
  placeholder = 'Ara...',
  debounceMs = 200,
  autoFocus = false,
}: Props) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    if (local === value) return;
    const t = setTimeout(() => onChange(local), debounceMs);
    return () => clearTimeout(t);
  }, [local, value, onChange, debounceMs]);

  return (
    <View className="flex-row items-center rounded-2xl border border-border-soft bg-bg-surface px-3.5 py-2">
      <Search color="#94A3B8" size={16} />
      <TextInput
        value={local}
        onChangeText={setLocal}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        autoFocus={autoFocus}
        returnKeyType="search"
        className="ml-2 flex-1 text-sm text-text-primary"
        style={{ paddingVertical: 4 }}
      />
      {local.length > 0 ? (
        <Pressable
          onPress={() => {
            setLocal('');
            onChange('');
          }}
          hitSlop={10}
          accessibilityLabel="Aramayı temizle"
          className="ml-1 h-6 w-6 items-center justify-center rounded-full bg-bg-elevated active:opacity-70"
        >
          <X color="#475569" size={12} />
        </Pressable>
      ) : null}
    </View>
  );
}
