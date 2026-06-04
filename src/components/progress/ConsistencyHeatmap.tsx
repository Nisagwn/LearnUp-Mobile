import { useMemo } from 'react';
import { View, Text } from 'react-native';

type DayActivity = { date: string; count: number };

type Props = {
  data: DayActivity[]; // en eski gün başta, bugün sonda
};

const CELL = 13;
const GAP = 3;
const DAY_LABELS = ['Pzt', '', 'Çar', '', 'Cum', '', 'Paz'];

function intensityColor(count: number): string {
  if (count <= 0) return '#F1F5F9';
  if (count < 3) return '#C7D2FE';
  if (count < 6) return '#818CF8';
  if (count < 10) return '#6366F1';
  return '#4338CA';
}

// Pazartesi-başlangıçlı satır indeksi (0=Pzt .. 6=Paz)
function mondayRow(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00`);
  return (d.getDay() + 6) % 7;
}

export function ConsistencyHeatmap({ data }: Props) {
  const { columns, total } = useMemo(() => {
    const cells: (DayActivity | null)[] = [];
    if (data.length > 0) {
      const pad = mondayRow(data[0].date);
      for (let i = 0; i < pad; i++) cells.push(null);
    }
    let sum = 0;
    data.forEach((d) => {
      cells.push(d);
      sum += d.count;
    });
    while (cells.length % 7 !== 0) cells.push(null);

    const cols: (DayActivity | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) cols.push(cells.slice(i, i + 7));
    return { columns: cols, total: sum };
  }, [data]);

  if (total === 0) {
    return (
      <View className="rounded-2xl border border-border-soft bg-bg-surface p-4">
        <Text className="text-sm font-semibold text-text-secondary">Çalışma Tutarlılığı</Text>
        <Text className="mt-2 text-xs text-text-muted">
          Henüz aktivite yok — bugün bir soru çözünce buradaki kareler dolmaya başlayacak.
        </Text>
      </View>
    );
  }

  return (
    <View className="rounded-2xl border border-border-soft bg-bg-surface p-4">
      <Text className="text-sm font-semibold text-text-secondary">Çalışma Tutarlılığı</Text>
      <Text className="mt-0.5 text-xs text-text-muted">Son 12 hafta</Text>

      <View className="mt-3 flex-row">
        <View style={{ marginRight: GAP }}>
          {DAY_LABELS.map((label, i) => (
            <View key={i} style={{ height: CELL, marginBottom: GAP, justifyContent: 'center' }}>
              <Text className="text-[9px] text-text-muted">{label}</Text>
            </View>
          ))}
        </View>

        <View className="flex-1 flex-row flex-wrap">
          {columns.map((col, ci) => (
            <View key={ci} style={{ marginRight: GAP }}>
              {col.map((cell, ri) => (
                <View
                  key={ri}
                  style={{
                    width: CELL,
                    height: CELL,
                    marginBottom: GAP,
                    borderRadius: 3,
                    backgroundColor: cell ? intensityColor(cell.count) : 'transparent',
                  }}
                />
              ))}
            </View>
          ))}
        </View>
      </View>

      <View className="mt-2 flex-row items-center justify-end gap-1">
        <Text className="mr-1 text-[9px] text-text-muted">Az</Text>
        {['#F1F5F9', '#C7D2FE', '#818CF8', '#6366F1', '#4338CA'].map((c) => (
          <View key={c} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c }} />
        ))}
        <Text className="ml-1 text-[9px] text-text-muted">Çok</Text>
      </View>
    </View>
  );
}
