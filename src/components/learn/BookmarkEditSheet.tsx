import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  X,
  Folder,
  FolderInput,
  Tag,
  Trash2,
  Check,
} from 'lucide-react-native';
import type { BookmarkDoc, BookmarkFolder } from '@/services/bookmarksApi';

type Props = {
  visible: boolean;
  bookmark: BookmarkDoc | null;
  customFolders: BookmarkFolder[];
  autoFolderOptions: { id: string; label: string }[];
  onClose: () => void;
  onSave: (patch: { folderId: string | null; tags: string[]; note: string }) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
};

export function BookmarkEditSheet({
  visible,
  bookmark,
  customFolders,
  autoFolderOptions,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [folderId, setFolderId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && bookmark) {
      setFolderId(bookmark.folderId);
      setTags(bookmark.tags);
      setTagDraft('');
      setNote(bookmark.note);
    }
  }, [visible, bookmark]);

  if (!bookmark) return null;

  const commitTagDraft = () => {
    const t = tagDraft.trim();
    if (!t) return;
    if (tags.includes(t)) {
      setTagDraft('');
      return;
    }
    setTags((prev) => [...prev, t].slice(0, 12));
    setTagDraft('');
  };

  const removeTag = (t: string) => {
    setTags((prev) => prev.filter((x) => x !== t));
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave({ folderId, tags, note });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 bg-black/50">
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="mt-auto rounded-t-3xl bg-bg-base"
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
          >
            <View className="px-5 pb-6 pt-3">
              <View className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border-soft" />
              <View className="flex-row items-start">
                <View className="flex-1">
                  <Text className="text-xs uppercase tracking-wide text-text-muted">
                    Kaydedilen soru
                  </Text>
                  <Text
                    className="mt-1 text-sm font-semibold text-text-primary"
                    numberOfLines={3}
                  >
                    {bookmark.questionText || 'Soru metni yok'}
                  </Text>
                </View>
                <Pressable
                  onPress={onClose}
                  hitSlop={10}
                  className="ml-2 h-8 w-8 items-center justify-center rounded-full bg-bg-elevated active:opacity-70"
                >
                  <X color="#475569" size={14} />
                </Pressable>
              </View>

              <ScrollView
                contentContainerStyle={{ paddingBottom: 12 }}
                showsVerticalScrollIndicator={false}
                className="mt-4"
                style={{ maxHeight: 420 }}
              >
                {/* KLASÖR */}
                <View className="flex-row items-center">
                  <FolderInput color="#15803D" size={14} />
                  <Text className="ml-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Klasör
                  </Text>
                </View>
                <View className="mt-2" style={{ gap: 6 }}>
                  <FolderOption
                    label="Klasörsüz (root)"
                    selected={folderId === null}
                    onPress={() => setFolderId(null)}
                  />
                  {autoFolderOptions.map((f) => (
                    <FolderOption
                      key={f.id}
                      label={`${f.label} · otomatik`}
                      selected={folderId === f.id}
                      onPress={() => setFolderId(f.id)}
                    />
                  ))}
                  {customFolders.map((f) => (
                    <FolderOption
                      key={f.id}
                      label={f.name}
                      selected={folderId === f.id}
                      onPress={() => setFolderId(f.id)}
                    />
                  ))}
                </View>

                {/* ETİKETLER */}
                <View className="mt-5 flex-row items-center">
                  <Tag color="#15803D" size={14} />
                  <Text className="ml-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Etiketler ({tags.length}/12)
                  </Text>
                </View>
                {tags.length > 0 ? (
                  <View className="mt-2 flex-row flex-wrap" style={{ gap: 6 }}>
                    {tags.map((t) => (
                      <Pressable
                        key={t}
                        onPress={() => removeTag(t)}
                        className="flex-row items-center rounded-full bg-accent-soft px-2.5 py-1 active:opacity-70"
                      >
                        <Text className="text-[11px] font-semibold text-accent-fg">#{t}</Text>
                        <X color="#15803D" size={10} style={{ marginLeft: 4 }} />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <View className="mt-2 flex-row items-center">
                  <TextInput
                    value={tagDraft}
                    onChangeText={setTagDraft}
                    onSubmitEditing={commitTagDraft}
                    placeholder="Yeni etiket ekle (örn. TYT)"
                    placeholderTextColor="#94A3B8"
                    returnKeyType="done"
                    maxLength={24}
                    className="flex-1 rounded-xl border border-border-soft bg-bg-surface px-3 py-2 text-sm text-text-primary"
                  />
                  <Pressable
                    onPress={commitTagDraft}
                    disabled={!tagDraft.trim() || tags.length >= 12}
                    className={`ml-2 rounded-xl bg-accent px-3 py-2 active:opacity-80 ${
                      !tagDraft.trim() || tags.length >= 12 ? 'opacity-40' : ''
                    }`}
                  >
                    <Text className="text-xs font-bold text-white">Ekle</Text>
                  </Pressable>
                </View>

                {/* NOT */}
                <View className="mt-5 flex-row items-center">
                  <Text className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Not ({note.length}/500)
                  </Text>
                </View>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Bu soruyla ilgili kişisel not (opsiyonel)"
                  placeholderTextColor="#94A3B8"
                  multiline
                  maxLength={500}
                  className="mt-2 rounded-xl border border-border-soft bg-bg-surface px-3 py-2.5 text-sm text-text-primary"
                  style={{ minHeight: 80, textAlignVertical: 'top' }}
                />
              </ScrollView>

              <View className="mt-4 flex-row" style={{ gap: 8 }}>
                <Pressable
                  onPress={onDelete}
                  className="flex-row items-center justify-center rounded-xl border border-danger-soft bg-danger-soft px-3 py-3 active:opacity-80"
                >
                  <Trash2 color="#DC2626" size={14} />
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  disabled={saving}
                  className={`flex-1 flex-row items-center justify-center rounded-xl bg-accent py-3 active:opacity-80 ${
                    saving ? 'opacity-60' : ''
                  }`}
                >
                  <Check color="white" size={14} />
                  <Text className="ml-1.5 text-sm font-bold text-white">
                    {saving ? 'Kaydediliyor...' : 'Kaydet'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function FolderOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center rounded-xl border px-3 py-2.5 active:opacity-80 ${
        selected ? 'border-accent bg-accent-soft' : 'border-border-soft bg-bg-surface'
      }`}
    >
      <Folder color={selected ? '#15803D' : '#94A3B8'} size={14} />
      <Text
        className={`ml-2 flex-1 text-sm ${
          selected ? 'font-semibold text-text-primary' : 'text-text-secondary'
        }`}
        numberOfLines={1}
      >
        {label}
      </Text>
      {selected ? (
        <View className="h-4 w-4 items-center justify-center rounded-full bg-accent">
          <Check color="white" size={10} />
        </View>
      ) : null}
    </Pressable>
  );
}
