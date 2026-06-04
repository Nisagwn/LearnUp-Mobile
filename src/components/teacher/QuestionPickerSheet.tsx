import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  FlatList,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Check, Search, X } from 'lucide-react-native';
import {
  collection,
  query,
  where,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '@/services/firebase';

export interface QuestionRow {
  id: string;
  text: string;
  subject: string;
  grade?: string;
  difficulty?: string;
  isAI: boolean;
}

interface RawDoc {
  question?: string;
  question_text?: string;
  text?: string;
  category?: string;
  subject?: string;
  grade?: string;
  difficulty?: string;
  is_ai_generated?: boolean;
  isAI?: boolean;
}

function getText(d: RawDoc): string {
  return d.text || d.question_text || d.question || 'Metinsiz soru';
}

type Props = {
  visible: boolean;
  initialSelected?: string[];
  onClose: () => void;
  onConfirm: (rows: QuestionRow[]) => void;
};

/**
 * Soru havuzundan multi-select.
 * Kaynak: öğretmenin "Benim" + "Onaylı" havuzunun birleşimi (basit MVP).
 */
export function QuestionPickerSheet({ visible, initialSelected, onClose, onConfirm }: Props) {
  const [mine, setMine] = useState<QuestionRow[]>([]);
  const [approved, setApproved] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState('');
  const [tab, setTab] = useState<'mine' | 'approved'>('mine');

  // Aç-kapa sıfırla
  useEffect(() => {
    if (visible) {
      setSelected(new Set(initialSelected ?? []));
      setSearchText('');
      setTab('mine');
    }
  }, [visible, initialSelected]);

  // Listener — sadece açıkken bağlan
  useEffect(() => {
    if (!visible) return;
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let pendingMine = true;
    let pendingApproved = true;
    const checkDone = () => {
      if (!pendingMine && !pendingApproved) setLoading(false);
    };

    const subscribers: Unsubscribe[] = [];
    subscribers.push(
      onSnapshot(
        query(collection(db, 'questions'), where('teacherId', '==', uid)),
        (snap) => {
          const arr: QuestionRow[] = [];
          snap.forEach((d) => {
            const raw = d.data() as RawDoc;
            arr.push({
              id: d.id,
              text: getText(raw),
              subject: String(raw.subject ?? raw.category ?? 'Genel'),
              grade: typeof raw.grade === 'string' ? raw.grade : undefined,
              difficulty: typeof raw.difficulty === 'string' ? raw.difficulty : undefined,
              isAI: raw.is_ai_generated === true || raw.isAI === true,
            });
          });
          setMine(arr);
          pendingMine = false;
          checkDone();
        },
        () => {
          pendingMine = false;
          checkDone();
        },
      ),
    );
    subscribers.push(
      onSnapshot(
        query(collection(db, 'questions'), where('verified', '==', true)),
        (snap) => {
          const arr: QuestionRow[] = [];
          snap.forEach((d) => {
            const raw = d.data() as RawDoc;
            arr.push({
              id: d.id,
              text: getText(raw),
              subject: String(raw.subject ?? raw.category ?? 'Genel'),
              grade: typeof raw.grade === 'string' ? raw.grade : undefined,
              difficulty: typeof raw.difficulty === 'string' ? raw.difficulty : undefined,
              isAI: raw.is_ai_generated === true || raw.isAI === true,
            });
          });
          setApproved(arr);
          pendingApproved = false;
          checkDone();
        },
        () => {
          pendingApproved = false;
          checkDone();
        },
      ),
    );

    return () => subscribers.forEach((u) => u());
  }, [visible]);

  const items = useMemo(() => {
    const list = tab === 'mine' ? mine : approved;
    const q = searchText.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) => r.text.toLowerCase().includes(q) || r.subject.toLowerCase().includes(q),
    );
  }, [tab, mine, approved, searchText]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <Pressable className="flex-1 bg-black/50" onPress={onClose}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="mt-auto rounded-t-3xl bg-bg-base"
            style={{ maxHeight: '90%' }}
          >
            <View className="self-center mt-2 mb-1 h-1 w-10 rounded-full bg-bg-elevated" />
            <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
              <Text className="text-base font-bold text-text-primary">
                Soru Seç ({selected.size} seçili)
              </Text>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                className="h-8 w-8 items-center justify-center rounded-full active:bg-bg-elevated"
              >
                <X color="#94A3B8" size={18} />
              </Pressable>
            </View>

            <View className="h-px bg-border-soft" />

            {/* Tab bar */}
            <View className="flex-row gap-2 px-5 pt-3">
              {(['mine', 'approved'] as const).map((id) => {
                const active = id === tab;
                const label = id === 'mine' ? 'Benim' : 'Onaylı Havuz';
                const count = id === 'mine' ? mine.length : approved.length;
                return (
                  <Pressable
                    key={id}
                    onPress={() => setTab(id)}
                    className={`flex-1 items-center rounded-xl border py-2 ${
                      active ? 'border-accent bg-accent-soft' : 'border-border-soft bg-bg-surface'
                    }`}
                  >
                    <Text
                      className={`text-xs font-semibold ${
                        active ? 'text-accent-fg' : 'text-text-muted'
                      }`}
                    >
                      {label} ({count})
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Arama */}
            <View className="mx-5 mt-3 flex-row items-center rounded-xl border border-border-soft bg-bg-surface px-3">
              <Search color="#94A3B8" size={14} />
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder="Soru metninde ara"
                placeholderTextColor="#94A3B8"
                className="ml-2 flex-1 py-2.5 text-sm text-text-primary"
              />
            </View>

            {loading ? (
              <View className="h-40 items-center justify-center">
                <ActivityIndicator color="#6366F1" />
              </View>
            ) : (
              <FlatList
                data={items}
                keyExtractor={(it) => it.id}
                contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                ListEmptyComponent={
                  <Text className="text-center text-sm text-text-muted">
                    Bu sekmede soru yok
                  </Text>
                }
                renderItem={({ item }) => {
                  const isSel = selected.has(item.id);
                  return (
                    <Pressable
                      onPress={() => toggle(item.id)}
                      className={`mb-2 flex-row items-start rounded-xl border p-3 ${
                        isSel ? 'border-accent bg-accent-soft' : 'border-border-soft bg-bg-surface'
                      }`}
                    >
                      <View
                        className={`mr-3 mt-0.5 h-6 w-6 items-center justify-center rounded-md border ${
                          isSel ? 'border-accent bg-accent' : 'border-border-soft bg-bg-base'
                        }`}
                      >
                        {isSel ? <Check color="white" size={14} /> : null}
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center">
                          <Text className="text-[10px] uppercase tracking-wide text-accent-fg">
                            {item.subject}
                            {item.grade ? ` · ${item.grade}. sınıf` : ''}
                            {item.difficulty ? ` · ${item.difficulty}` : ''}
                          </Text>
                          {item.isAI ? (
                            <View className="ml-1.5 rounded-full bg-bg-elevated px-1.5 py-0.5">
                              <Text className="text-[9px] font-semibold text-text-muted">AI</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text
                          className="mt-1 text-sm leading-5 text-text-primary"
                          numberOfLines={3}
                        >
                          {item.text}
                        </Text>
                      </View>
                    </Pressable>
                  );
                }}
              />
            )}

            <View className="border-t border-border-soft px-5 pb-8 pt-3">
              <Pressable
                onPress={() => {
                  const all = [...mine, ...approved];
                  const seenIds = new Set<string>();
                  const rows: QuestionRow[] = [];
                  for (const r of all) {
                    if (!selected.has(r.id) || seenIds.has(r.id)) continue;
                    seenIds.add(r.id);
                    rows.push(r);
                  }
                  onConfirm(rows);
                }}
                disabled={selected.size === 0}
                className={`items-center rounded-xl py-3.5 active:opacity-80 ${
                  selected.size === 0 ? 'bg-bg-elevated' : 'bg-accent'
                }`}
              >
                <Text
                  className={`text-base font-semibold ${
                    selected.size === 0 ? 'text-text-muted' : 'text-white'
                  }`}
                >
                  {selected.size === 0
                    ? 'Soru seç'
                    : `${selected.size} soruyu ödeve ekle`}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
