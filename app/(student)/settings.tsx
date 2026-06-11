import { useContext, useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch, Alert, Linking, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettingsBackground } from '@/components/settings/SettingsBackground';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import {
  ChevronLeft,
  UserCog,
  KeyRound,
  Bell,
  Sun,
  Moon,
  SmartphoneNfc,
  Info,
  Shield,
  FileText,
  LifeBuoy,
  LogOut,
  Trash2,
  Check,
} from 'lucide-react-native';
import { signOut } from 'firebase/auth';
import { auth } from '@/services/firebase';
import { UserStatsContext } from '@/contexts/UserStatsContext';
import { useTheme, type ThemeMode } from '@/contexts/ThemeContext';
import { setPushEnabled } from '@/services/pushService';
import { deleteAccount } from '@/services/accountApi';
import { PRIVACY_URL, TERMS_URL, SUPPORT_EMAIL } from '@/constants/links';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { EditProfileSheet } from '@/components/settings/EditProfileSheet';
import { ChangePasswordSheet } from '@/components/settings/ChangePasswordSheet';
import { ReauthSheet } from '@/components/settings/ReauthSheet';

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: 'light', label: 'Açık', icon: Sun },
  { mode: 'dark', label: 'Koyu', icon: Moon },
  { mode: 'system', label: 'Sistem', icon: SmartphoneNfc },
];

export default function StudentSettings() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const ctx = useContext(UserStatsContext);
  const profile = ctx?.userProfile;
  const { mode, setMode } = useTheme();

  const [notif, setNotif] = useState(profile?.notificationsEnabled !== false);
  const [editOpen, setEditOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const onToggleNotif = async (val: boolean) => {
    setNotif(val);
    try {
      await setPushEnabled(val);
    } catch (err) {
      setNotif(!val);
      Alert.alert('Hata', (err as Error).message);
    }
  };

  const onLogout = () => {
    Alert.alert('Çıkış Yap', 'Hesabından çıkmak istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Çıkış',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut(auth);
            router.replace('/(auth)/login');
          } catch (err) {
            Alert.alert('Hata', (err as Error).message);
          }
        },
      },
    ]);
  };

  const onConfirmDelete = async () => {
    await deleteAccount();
    await signOut(auth).catch(() => {});
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-surface" edges={['top']}>
      <SettingsBackground width={width} height={height} />
      <View className="flex-row items-center px-5 pt-2">
        <Pressable onPress={() => router.back()} hitSlop={8} className="mr-3 active:opacity-60">
          <ChevronLeft color="#94A3B8" size={26} />
        </Pressable>
        <Text className="text-2xl font-bold text-text-primary">Ayarlar</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <SettingsSection title="Hesap">
          <SettingsRow icon={UserCog} label="Profili Düzenle" sublabel="Ad, fotoğraf, sınıf" first showChevron onPress={() => setEditOpen(true)} />
          <SettingsRow icon={KeyRound} label="Şifre Değiştir" showChevron onPress={() => setPwOpen(true)} />
        </SettingsSection>

        <SettingsSection title="Bildirimler">
          <SettingsRow
            icon={Bell}
            label="Öğrenme bildirimleri"
            sublabel="Seri ve günlük görev hatırlatmaları"
            first
            right={<Switch value={notif} onValueChange={onToggleNotif} />}
          />
        </SettingsSection>

        <SettingsSection title="Görünüm">
          {THEME_OPTIONS.map((opt, i) => (
            <SettingsRow
              key={opt.mode}
              icon={opt.icon}
              label={opt.label}
              first={i === 0}
              onPress={() => setMode(opt.mode)}
              right={mode === opt.mode ? <Check color="#6366F1" size={18} /> : undefined}
            />
          ))}
        </SettingsSection>

        <SettingsSection title="Hakkında & Yasal">
          <SettingsRow icon={Info} label="Uygulama Sürümü" rightText={appVersion} first />
          <SettingsRow icon={Shield} label="Gizlilik Politikası" showChevron onPress={() => Linking.openURL(PRIVACY_URL)} />
          <SettingsRow icon={FileText} label="Kullanım Şartları" showChevron onPress={() => Linking.openURL(TERMS_URL)} />
          <SettingsRow icon={LifeBuoy} label="İletişim / Destek" showChevron onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
        </SettingsSection>

        <SettingsSection>
          <SettingsRow icon={LogOut} label="Çıkış Yap" destructive first onPress={onLogout} />
          <SettingsRow icon={Trash2} label="Hesabı Sil" destructive onPress={() => setDelOpen(true)} />
        </SettingsSection>
      </ScrollView>

      <EditProfileSheet
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        role="student"
        initialName={profile?.name ?? auth.currentUser?.displayName ?? ''}
        initialPhoto={profile?.photoURL ?? auth.currentUser?.photoURL ?? null}
        initialAvatarId={(profile?.avatarId as string | undefined) ?? null}
        initialGrade={(profile?.grade as string | undefined) ?? null}
      />
      <ChangePasswordSheet visible={pwOpen} onClose={() => setPwOpen(false)} />
      <ReauthSheet
        visible={delOpen}
        onClose={() => setDelOpen(false)}
        onConfirmed={onConfirmDelete}
        title="Hesabı Sil"
        description="Bu işlem geri alınamaz. Tüm verilerin kalıcı olarak silinecek. Onaylamak için şifreni gir."
        confirmLabel="Hesabı Kalıcı Sil"
        destructive
      />
    </SafeAreaView>
  );
}
