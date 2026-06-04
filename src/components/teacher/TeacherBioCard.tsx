import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Pencil, Building2, Check, X } from 'lucide-react-native';
import { updateTeacherBio } from '@/services/teacherProfileApi';
import { auth } from '@/services/firebase';

type Props = {
  bio: string;
  school: string;
  /** Kaydet sonrası UI'yi tazelemek için (optimistik). */
  onSaved: (next: { bio: string; school: string }) => void;
};

const BIO_MAX = 200;
const SCHOOL_MAX = 80;

export function TeacherBioCard({ bio, school, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [bioDraft, setBioDraft] = useState(bio);
  const [schoolDraft, setSchoolDraft] = useState(school);
  const [saving, setSaving] = useState(false);

  const handleEdit = () => {
    setBioDraft(bio);
    setSchoolDraft(school);
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setBioDraft(bio);
    setSchoolDraft(school);
  };

  const handleSave = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const cleanBio = bioDraft.trim();
    const cleanSchool = schoolDraft.trim();
    setSaving(true);
    try {
      await updateTeacherBio(uid, { bio: cleanBio, school: cleanSchool });
      onSaved({ bio: cleanBio, school: cleanSchool });
      setEditing(false);
    } catch (err) {
      Alert.alert('Hata', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const hasContent = bio.trim().length > 0 || school.trim().length > 0;

  return (
    <View className="rounded-2xl border border-border-soft bg-bg-surface p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-text-primary">Hakkımda</Text>
        {!editing ? (
          <Pressable
            onPress={handleEdit}
            hitSlop={8}
            className="flex-row items-center rounded-full bg-accent-soft px-2.5 py-1 active:opacity-70"
          >
            <Pencil color="#6366F1" size={11} />
            <Text className="ml-1 text-[11px] font-semibold text-accent-fg">
              {hasContent ? 'Düzenle' : 'Ekle'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {editing ? (
        <View className="mt-3" style={{ gap: 10 }}>
          <View>
            <Text className="mb-1 text-[11px] font-medium text-text-muted">
              Kısa biyografi ({bioDraft.length}/{BIO_MAX})
            </Text>
            <TextInput
              value={bioDraft}
              onChangeText={(t) => setBioDraft(t.slice(0, BIO_MAX))}
              placeholder="Öğrencilerinle paylaşmak istediğin kısa bir not..."
              placeholderTextColor="#94A3B8"
              multiline
              maxLength={BIO_MAX}
              className="rounded-xl border border-border-soft bg-bg-base px-3 py-2.5 text-sm text-text-primary"
              style={{ minHeight: 80, textAlignVertical: 'top' }}
            />
          </View>
          <View>
            <Text className="mb-1 text-[11px] font-medium text-text-muted">
              Okul adı ({schoolDraft.length}/{SCHOOL_MAX})
            </Text>
            <TextInput
              value={schoolDraft}
              onChangeText={(t) => setSchoolDraft(t.slice(0, SCHOOL_MAX))}
              placeholder="Örn. Atatürk Anadolu Lisesi"
              placeholderTextColor="#94A3B8"
              maxLength={SCHOOL_MAX}
              className="rounded-xl border border-border-soft bg-bg-base px-3 py-2.5 text-sm text-text-primary"
            />
          </View>
          <View className="flex-row" style={{ gap: 8 }}>
            <Pressable
              onPress={handleCancel}
              className="flex-1 flex-row items-center justify-center rounded-xl border border-border-soft bg-bg-base py-2.5 active:opacity-70"
            >
              <X color="#475569" size={14} />
              <Text className="ml-1.5 text-sm font-semibold text-text-secondary">Vazgeç</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              className={`flex-1 flex-row items-center justify-center rounded-xl bg-accent py-2.5 active:opacity-80 ${
                saving ? 'opacity-60' : ''
              }`}
            >
              {saving ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Check color="white" size={14} />
              )}
              <Text className="ml-1.5 text-sm font-bold text-white">Kaydet</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="mt-3" style={{ gap: 10 }}>
          {bio.trim().length > 0 ? (
            <Text className="text-sm leading-5 text-text-secondary">{bio}</Text>
          ) : (
            <Text className="text-sm italic text-text-muted">
              Henüz bir biyografi eklemedin.
            </Text>
          )}
          {school.trim().length > 0 ? (
            <View className="flex-row items-center">
              <Building2 color="#94A3B8" size={13} />
              <Text className="ml-1.5 text-xs font-medium text-text-secondary">{school}</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}
