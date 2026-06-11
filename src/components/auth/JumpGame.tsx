import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Play, RotateCcw, Trophy, Gem as GemIcon } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useThemeColors } from '@/hooks/useThemeColors';
import { tapLight, tapMedium, success as hapticSuccess, warning as hapticWarning } from '@/utils/haptics';
import { AppLottie } from '@/components/common/AppLottie';
import { PressableScale } from '@/components/common/PressableScale';
import { AnimatedNumber } from '@/components/common/AnimatedNumber';
import { lottie } from '@/constants/lottie';
import { JumpCharacter } from './JumpCharacter';
import { JumpGem, type GemItem } from './JumpGem';
import { JumpObstacle, type ObsItem } from './JumpObstacle';

const BEST_KEY = '@game/jump_best';
const TIP_SEEN_KEY = '@game/jump_seenTip';

// Oyun fiziği (px ve px/sn cinsinden; dt ile ölçeklenir)
const HEIGHT = 200;
const GRAVITY = 1100;
const JUMP_V = -320;
const SPEED = 150;
const GAP = 130;
const OBS_W = 46;
const SPAWN_DX = 200;
const BIRD_X = 64;
const BIRD = 30;
const GEM_R = 8;
const GEM_PICKUP = 18;
const GEM_SPAWN_CHANCE = 0.6;

type State = 'idle' | 'playing' | 'over';
type Obstacle = { id: number; x: number; gapY: number; scored?: boolean };
type Gem = { id: number; x: number; y: number; collected: boolean; opacity: number };

// Pastel doğa paleti (tema-bağımsız, soft tonlar)
const SKY_GRADIENT = ['#BAE6FD', '#FBCFE8'] as const; // soft mavi → soft pembe (gün sonu)
const HILL_BACK = '#86EFAC'; // arka tepe (açık mint)
const HILL_FRONT = '#6EE7B7'; // ön tepe (mint)
const TREE_LIGHT = '#A7F3D0'; // açık ağaç
const TREE_DARK = '#34D399'; // koyu ağaç
const TREE_TRUNK = '#92400E'; // gövde (sıcak kahve)
const OBS_BODY = '#86EFAC'; // engel gövdesi — mint
const OBS_CAP = '#34D399'; // engel kapağı — koyu mint
const SUN_COLOR = '#FDE68A'; // pastel sarı güneş

const TREES = [
  { x: 22, scale: 0.85, shade: TREE_LIGHT },
  { x: 78, scale: 1.0, shade: TREE_DARK },
  { x: 140, scale: 0.75, shade: TREE_LIGHT },
  { x: 210, scale: 0.95, shade: TREE_DARK },
  { x: 268, scale: 0.8, shade: TREE_LIGHT },
  { x: 320, scale: 0.9, shade: TREE_DARK },
] as const;

/**
 * Giriş/kayıt sayfalarının altındaki tek-dokunuş "zıplayan kitap" mini oyunu.
 * Tema-uyumlu görsel + toplanabilir XP gem mekaniği + yeni rekorda kutlama.
 */
export function JumpGame() {
  const { colors, isDark } = useThemeColors();
  const [state, setState] = useState<State>('idle');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [width, setWidth] = useState(0);
  const [jumpTick, setJumpTick] = useState(0);
  const [showTip, setShowTip] = useState(false);
  const [newRecord, setNewRecord] = useState(false);

  // Yapısal listeler — sadece engel/gem eklenip silinince güncellenir (render tetikler).
  // Konum/opacity her karede shared value ile sürülür; React'i meşgul etmez.
  const [obsList, setObsList] = useState<{ id: number; gapY: number }[]>([]);
  const [gemList, setGemList] = useState<{ id: number; y: number }[]>([]);

  const birdYRef = useRef(HEIGHT / 2);
  const birdVRef = useRef(0);
  const obsRef = useRef<Obstacle[]>([]);
  const gemsRef = useRef<Gem[]>([]);
  const scoreRef = useRef(0);
  const widthRef = useRef(0);
  const idRef = useRef(0);
  const gemIdRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const stateRef = useRef<State>('idle');
  const confettiRef = useRef<ConfettiCannon | null>(null);
  // Yapısal değişimi (id seti) ucuzca yakalamak için imza referansları
  const obsSigRef = useRef('');
  const gemSigRef = useRef('');

  // Hareket sürücüleri — döngü JS thread'inden yazar, çocuklar UI thread'inde okur
  const birdSY = useSharedValue(HEIGHT / 2);
  const birdTilt = useSharedValue(0);
  const obsSV = useSharedValue<ObsItem[]>([]);
  const gemSV = useSharedValue<GemItem[]>([]);

  const scorePulse = useSharedValue(1);
  const cloud1X = useSharedValue(0);
  const cloud2X = useSharedValue(0);
  const cloud3X = useSharedValue(0);

  useEffect(() => {
    AsyncStorage.getItem(BEST_KEY)
      .then((v) => {
        if (v) setBest(parseInt(v, 10) || 0);
      })
      .catch(() => {});
    AsyncStorage.getItem(TIP_SEEN_KEY)
      .then((v) => {
        if (!v) setShowTip(true);
      })
      .catch(() => {});
  }, []);

  // Parallax bulutlar — yavaş yatay döngü
  useEffect(() => {
    cloud1X.value = withRepeat(
      withTiming(1, { duration: 22000, easing: Easing.linear }),
      -1,
      false,
    );
    cloud2X.value = withRepeat(
      withTiming(1, { duration: 28000, easing: Easing.linear }),
      -1,
      false,
    );
    cloud3X.value = withRepeat(
      withTiming(1, { duration: 18000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [cloud1X, cloud2X, cloud3X]);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const endGame = useCallback(() => {
    stateRef.current = 'over';
    setState('over');
    hapticWarning();
    const final = scoreRef.current;
    setBest((prev) => {
      if (final > prev) {
        AsyncStorage.setItem(BEST_KEY, String(final)).catch(() => {});
        setNewRecord(true);
        setTimeout(() => {
          hapticSuccess();
          confettiRef.current?.start();
        }, 100);
        return final;
      }
      return prev;
    });
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const randGapY = useCallback(() => {
    const margin = 44;
    return margin + Math.random() * (HEIGHT - 2 * margin);
  }, []);

  const triggerScorePulse = useCallback(() => {
    scorePulse.value = withSequence(
      withTiming(1.25, { duration: 110 }),
      withSpring(1, { damping: 8, stiffness: 240 }),
    );
  }, [scorePulse]);

  const loop = useCallback(
    (ts: number) => {
      if (stateRef.current !== 'playing') return;
      const dt = lastRef.current ? Math.min(0.05, (ts - lastRef.current) / 1000) : 0;
      lastRef.current = ts;
      const w = widthRef.current;

      birdVRef.current += GRAVITY * dt;
      birdYRef.current += birdVRef.current * dt;

      let obs = obsRef.current.map((o) => ({ ...o, x: o.x - SPEED * dt }));
      const rightMost = obs.length ? Math.max(...obs.map((o) => o.x)) : -Infinity;
      if (w > 0 && (obs.length === 0 || rightMost < w - SPAWN_DX)) {
        idRef.current += 1;
        const newGapY = randGapY();
        const newObs: Obstacle = { id: idRef.current, x: w + OBS_W, gapY: newGapY };
        obs.push(newObs);
        // Gem spawn (her engelle birlikte %60)
        if (Math.random() < GEM_SPAWN_CHANCE) {
          gemIdRef.current += 1;
          gemsRef.current.push({
            id: gemIdRef.current,
            x: w + OBS_W + OBS_W / 2,
            y: newGapY,
            collected: false,
            opacity: 1,
          });
        }
      }

      obs = obs.filter((o) => o.x + OBS_W >= 0);

      // Engel skoru
      for (const o of obs) {
        const passedNow = o.x + OBS_W < BIRD_X;
        if (passedNow && !o.scored) {
          o.scored = true;
          scoreRef.current += 1;
          setScore(scoreRef.current);
          triggerScorePulse();
          tapLight();
        }
      }

      // Gem hareketi + collision + temizlik
      let nextGems = gemsRef.current
        .map((g) => ({ ...g, x: g.x - SPEED * dt }))
        .filter((g) => g.x + GEM_R > 0 && g.opacity > 0.05);

      for (const g of nextGems) {
        if (g.collected) {
          // fade-out
          g.opacity = Math.max(0, g.opacity - dt * 4);
          continue;
        }
        const dx = g.x - BIRD_X;
        const dy = g.y - birdYRef.current;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < GEM_PICKUP) {
          g.collected = true;
          scoreRef.current += 2;
          setScore(scoreRef.current);
          triggerScorePulse();
          tapMedium();
        }
      }
      gemsRef.current = nextGems;

      // Tavan: ölüm değil, sıkıştır (kuş ekranın üstünden kaçamasın)
      if (birdYRef.current - BIRD / 2 < 0) {
        birdYRef.current = BIRD / 2;
        if (birdVRef.current < 0) birdVRef.current = 0;
      }
      // Çarpışma: sadece zemin öldürür
      let dead = false;
      if (birdYRef.current + BIRD / 2 >= HEIGHT) {
        dead = true;
      }
      // Çarpışma: engeller
      for (const o of obs) {
        const inX = BIRD_X + BIRD / 2 > o.x && BIRD_X - BIRD / 2 < o.x + OBS_W;
        if (inX) {
          const topGap = o.gapY - GAP / 2;
          const botGap = o.gapY + GAP / 2;
          if (birdYRef.current - BIRD / 2 < topGap || birdYRef.current + BIRD / 2 > botGap) {
            dead = true;
          }
        }
      }

      obsRef.current = obs;

      // Görseli shared value'lara yaz — kare-başına React render yok.
      birdSY.value = birdYRef.current;
      birdTilt.value = Math.max(-0.4, Math.min(0.6, birdVRef.current / 600));
      obsSV.value = obs.map((o) => ({ id: o.id, x: o.x, gapY: o.gapY }));
      gemSV.value = nextGems.map((g) => ({
        id: g.id,
        x: g.x,
        opacity: g.collected ? g.opacity : 1,
      }));

      // Yapısal (id seti) değişimini yakala → yalnız o an React listesini güncelle.
      const obsSig = obs.map((o) => o.id).join(',');
      if (obsSig !== obsSigRef.current) {
        obsSigRef.current = obsSig;
        setObsList(obs.map((o) => ({ id: o.id, gapY: o.gapY })));
      }
      const gemSig = nextGems.map((g) => g.id).join(',');
      if (gemSig !== gemSigRef.current) {
        gemSigRef.current = gemSig;
        setGemList(nextGems.map((g) => ({ id: g.id, y: g.y })));
      }

      if (dead) {
        endGame();
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    },
    [endGame, randGapY, triggerScorePulse, birdSY, birdTilt, obsSV, gemSV],
  );

  const start = useCallback(() => {
    birdYRef.current = HEIGHT / 2;
    birdVRef.current = JUMP_V * 0.6;
    obsRef.current = [];
    gemsRef.current = [];
    scoreRef.current = 0;
    idRef.current = 0;
    gemIdRef.current = 0;
    lastRef.current = 0;
    obsSigRef.current = '';
    gemSigRef.current = '';
    setScore(0);
    setObsList([]);
    setGemList([]);
    birdSY.value = HEIGHT / 2;
    birdTilt.value = 0;
    obsSV.value = [];
    gemSV.value = [];
    setNewRecord(false);
    stateRef.current = 'playing';
    setState('playing');
    tapLight();
    setJumpTick((t) => t + 1);
    if (showTip) {
      setShowTip(false);
      AsyncStorage.setItem(TIP_SEEN_KEY, '1').catch(() => {});
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [loop, showTip, birdSY, birdTilt, obsSV, gemSV]);

  const flap = useCallback(() => {
    if (stateRef.current !== 'playing') return;
    birdVRef.current = JUMP_V;
    setJumpTick((t) => t + 1);
    tapLight();
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const scoreAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scorePulse.value }],
  }));
  const cloud1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: -60 + cloud1X.value * (width + 120) }],
  }));
  const cloud2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: -80 + cloud2X.value * (width + 160) }],
  }));
  const cloud3Style = useAnimatedStyle(() => ({
    transform: [{ translateX: -40 + cloud3X.value * (width + 100) }],
  }));

  return (
    <View>
      <Pressable onPress={state === 'playing' ? flap : start} onLayout={onLayout}>
        <LinearGradient
          colors={SKY_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{
            height: HEIGHT,
            borderRadius: 20,
            overflow: 'hidden',
            shadowColor: '#94A3B8',
            shadowOpacity: 0.18,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
          }}
        >
          {/* Rekor rozeti — sol üst, minimal */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 10,
              left: 12,
              zIndex: 10,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.7)',
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
            }}
          >
            <Trophy color="#92400E" size={10} />
            <Text style={{ marginLeft: 4, fontSize: 10, fontWeight: '700', color: '#1E293B' }}>
              {best}
            </Text>
          </View>

          {/* Pastel güneş — sağ üst */}
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          >
            <Svg width="100%" height={HEIGHT}>
              <Circle cx={width - 36} cy={36} r={28} fill={SUN_COLOR} opacity={0.65} />
              <Circle cx={width - 36} cy={36} r={20} fill={SUN_COLOR} opacity={0.85} />
            </Svg>
          </View>

          {/* Parallax bulutlar — yumuşak beyaz */}
          <Animated.View
            pointerEvents="none"
            style={[cloud1Style, { position: 'absolute', top: 26, opacity: 0.7 }]}
          >
            <Svg width={64} height={28} viewBox="0 0 64 28">
              <Path
                d="M10 22 Q5 16 14 14 Q14 6 24 10 Q32 2 44 10 Q58 10 54 20 Q60 26 50 26 L14 26 Q6 26 10 22 Z"
                fill="white"
              />
            </Svg>
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[cloud2Style, { position: 'absolute', top: 60, opacity: 0.55 }]}
          >
            <Svg width={84} height={32} viewBox="0 0 84 32">
              <Path
                d="M14 26 Q6 20 16 16 Q18 6 30 10 Q40 2 52 10 Q72 10 68 22 Q74 28 62 28 L20 28 Q8 28 14 26 Z"
                fill="white"
              />
            </Svg>
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[cloud3Style, { position: 'absolute', top: 92, opacity: 0.6 }]}
          >
            <Svg width={54} height={24} viewBox="0 0 54 24">
              <Path
                d="M8 18 Q4 12 12 10 Q14 4 22 6 Q28 0 36 6 Q46 6 44 16 Q48 20 42 20 L14 20 Q4 20 8 18 Z"
                fill="white"
              />
            </Svg>
          </Animated.View>

          {/* Arka tepe (uzak, yumuşak) */}
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
          >
            <Svg width={width || 360} height={70} viewBox={`0 0 ${width || 360} 70`}>
              <Path
                d={`M0 40 Q${(width || 360) * 0.25} 14 ${(width || 360) * 0.5} 28 Q${(width || 360) * 0.75} 42 ${width || 360} 18 L${width || 360} 70 L0 70 Z`}
                fill={HILL_BACK}
                opacity={0.85}
              />
            </Svg>
          </View>

          {/* Ağaçlar (arka tepenin üzerinde) */}
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, bottom: 32 }}
          >
            <Svg width={width || 360} height={36} viewBox={`0 0 ${width || 360} 36`}>
              {TREES.map((t, i) => {
                const w = 18 * t.scale;
                const h = 26 * t.scale;
                const trunkW = 3 * t.scale;
                const trunkH = 5 * t.scale;
                return (
                  <Path
                    key={`tree-${i}`}
                    d={`M${t.x} ${36 - trunkH} l${trunkW / 2} 0 l0 ${trunkH} l-${trunkW} 0 l0 -${trunkH} z M${t.x + trunkW / 2 - w / 2} ${36 - trunkH} Q${t.x + trunkW / 2 - w / 2 + 2} ${36 - trunkH - h / 2} ${t.x + trunkW / 2} ${36 - trunkH - h} Q${t.x + trunkW / 2 + w / 2 - 2} ${36 - trunkH - h / 2} ${t.x + trunkW / 2 + w / 2} ${36 - trunkH} Z`}
                    fill={t.shade}
                  />
                );
              })}
              {/* Sıcak gövde rengini ayrı geç (yukarıdaki path birleşik) */}
              {TREES.map((t, i) => {
                const trunkW = 3 * t.scale;
                const trunkH = 5 * t.scale;
                return (
                  <Path
                    key={`trunk-${i}`}
                    d={`M${t.x} ${36 - trunkH} l${trunkW} 0 l0 ${trunkH} l-${trunkW} 0 z`}
                    fill={TREE_TRUNK}
                  />
                );
              })}
            </Svg>
          </View>

          {/* Ön tepe (zemin — engel oturma çizgisi hissi) */}
          <View
            pointerEvents="none"
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
          >
            <Svg width={width || 360} height={36} viewBox={`0 0 ${width || 360} 36`}>
              <Path
                d={`M0 18 Q${(width || 360) * 0.3} 6 ${(width || 360) * 0.55} 14 Q${(width || 360) * 0.8} 22 ${width || 360} 10 L${width || 360} 36 L0 36 Z`}
                fill={HILL_FRONT}
              />
            </Svg>
          </View>

          {/* Engeller — pastel mint (konum shared value'den) */}
          {obsList.map((o) => (
            <JumpObstacle
              key={o.id}
              id={o.id}
              gapY={o.gapY}
              obsSV={obsSV}
              containerHeight={HEIGHT}
              gap={GAP}
              width={OBS_W}
              bodyColor={OBS_BODY}
              capColor={OBS_CAP}
            />
          ))}

          {/* Gem'ler (konum + fade shared value'den) */}
          {gemList.map((g) => (
            <JumpGem
              key={g.id}
              id={g.id}
              y={g.y}
              gemSV={gemSV}
              fill={colors.warning}
              stroke={colors.white}
            />
          ))}

          {/* Karakter (konum + tilt shared value'den) */}
          <JumpCharacter
            x={BIRD_X}
            ySV={birdSY}
            tiltSV={birdTilt}
            size={BIRD + 4}
            jumpTick={jumpTick}
          />

          {/* Skor */}
          {state === 'playing' ? (
            <Animated.View
              pointerEvents="none"
              style={[
                scoreAnimStyle,
                {
                  position: 'absolute',
                  top: 10,
                  left: 0,
                  right: 0,
                  alignItems: 'center',
                },
              ]}
            >
              <AnimatedNumber
                value={score}
                duration={250}
                style={{
                  fontSize: 32,
                  fontWeight: '800',
                  color: '#1E293B',
                  textShadowColor: 'rgba(255,255,255,0.7)',
                  textShadowRadius: 6,
                  textShadowOffset: { width: 0, height: 1 },
                }}
              />
            </Animated.View>
          ) : null}

          {/* Yeni rekor Lottie overlay (kutlama anı) */}
          {state === 'over' && newRecord ? (
            <View
              pointerEvents="none"
              style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            >
              <AppLottie
                source={lottie.celebrate}
                autoPlay
                loop={false}
                style={{ width: '100%', height: '100%' }}
              />
            </View>
          ) : null}

          {/* Başlangıç / bitiş örtüsü */}
          {state !== 'playing' ? (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(15,23,42,0.38)',
              }}
            >
              {state === 'over' ? (
                <View
                  style={{
                    backgroundColor: colors.bgBase,
                    borderRadius: 18,
                    paddingHorizontal: 18,
                    paddingVertical: 14,
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOpacity: 0.25,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: 10,
                    maxWidth: 240,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <AppLottie
                      source={newRecord ? lottie.trophy : lottie.paperplane}
                      autoPlay
                      loop={false}
                      style={{ width: 44, height: 44 }}
                    />
                    <View style={{ marginLeft: 8 }}>
                      <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '800' }}>
                        {newRecord ? 'Yeni Rekor!' : 'İyi Denemeydi!'}
                      </Text>
                      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>
                        Skor {score} · Rekor{' '}
                        <Text style={{ color: colors.accentFg, fontWeight: '700' }}>{best}</Text>
                      </Text>
                    </View>
                  </View>
                  <PressableScale
                    onPress={start}
                    style={{
                      marginTop: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.accent,
                      paddingHorizontal: 18,
                      paddingVertical: 10,
                      borderRadius: 999,
                    }}
                  >
                    <RotateCcw color={colors.white} size={15} />
                    <Text style={{ marginLeft: 6, color: colors.white, fontWeight: '800' }}>
                      Tekrar Dene
                    </Text>
                  </PressableScale>
                </View>
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <PressableScale
                    onPress={start}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.white,
                      paddingHorizontal: 20,
                      paddingVertical: 11,
                      borderRadius: 999,
                      shadowColor: '#000',
                      shadowOpacity: 0.2,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 4 },
                      elevation: 6,
                    }}
                  >
                    <Play color={colors.accentFg} size={18} fill={colors.accentFg} />
                    <Text style={{ marginLeft: 8, color: colors.accentFg, fontWeight: '800', fontSize: 15 }}>
                      Dokun & Başla
                    </Text>
                  </PressableScale>
                  <Text
                    style={{
                      marginTop: 10,
                      color: 'rgba(255,255,255,0.95)',
                      fontSize: 11,
                      fontWeight: '600',
                      textShadowColor: 'rgba(0,0,0,0.25)',
                      textShadowRadius: 4,
                    }}
                  >
                    Karakteri zıplatmak için ekrana dokun
                  </Text>
                  {showTip ? (
                    <View
                      style={{
                        marginTop: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 999,
                      }}
                    >
                      <GemIcon color={colors.warning} size={11} />
                      <Text
                        style={{
                          marginLeft: 5,
                          color: 'white',
                          fontSize: 10,
                          fontWeight: '600',
                        }}
                      >
                        Gem topla → +2 puan
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          ) : null}
        </LinearGradient>
      </Pressable>

      {/* Konfeti — yeni rekor sırasında oyun alanı üzerinde patlar */}
      {newRecord && width > 0 ? (
        <ConfettiCannon
          ref={confettiRef as React.RefObject<ConfettiCannon>}
          count={80}
          origin={{ x: width / 2, y: 0 }}
          autoStart={false}
          fadeOut
          colors={isDark ? ['#86EFAC', '#FB923C', '#FBBF24', '#34D399'] : ['#16A34A', '#EC4899', '#F59E0B', '#10B981']}
        />
      ) : null}
    </View>
  );
}
