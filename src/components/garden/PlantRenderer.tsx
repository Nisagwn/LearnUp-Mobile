import { memo } from 'react';
import { View, Image } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { PlantStage, PlantStatus } from '@/utils/garden';
import { pickTreeImage, DECOR_IMAGES } from '@/constants/treeAssets';

type Props = {
  /** marketCatalog.ts içindeki plantType (örn: 'gul', 'sakura'). */
  plantType: string;
  /** Decor/special item'lar için itemId — DECOR_IMAGES lookup'ı. */
  itemId?: string;
  stage: PlantStage;
  status: PlantStatus;
  size?: number;
};

/**
 * Bitki renderer'ı:
 *   1. plantType registry'de ağaç ise PNG (stage'e göre)
 *   2. itemId DECOR_IMAGES'ta ise PNG (tek görsel)
 *   3. Aksi durumda SVG çizim (legacy çiçekler)
 */
function PlantRendererBase({ plantType, itemId, stage, status, size = 56 }: Props) {
  const { colors, gradients } = useThemeColors();

  // Stage → genel boyut oranı (göreceli)
  const stageScale = {
    seed: 0.35,
    sprout: 0.55,
    young: 0.78,
    mature: 1.0,
  }[stage];

  const isDead = status === 'dead';
  const isWilted = status === 'wilted';
  const tint = isDead ? 0.4 : isWilted ? 0.7 : 1;
  const overlayColor = isWilted ? colors.warning : null;

  // 1) Ağaç PNG (stage'e göre) → 2) Decor/Ent PNG (itemId tek görsel)
  const pngImage =
    pickTreeImage(plantType, stage) ||
    (itemId && DECOR_IMAGES[itemId] ? DECOR_IMAGES[itemId] : null);
  if (pngImage) {
    // Ağaçta stage'e göre küçült; decor item'larda her zaman tam boy (mature).
    const isDecor = !pickTreeImage(plantType, stage) && !!itemId;
    const imgSize = Math.round(size * (isDecor ? 1 : stageScale));
    return (
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'flex-end',
          opacity: tint,
        }}
      >
        {/* Toprak izi */}
        <View
          style={{
            position: 'absolute',
            bottom: 2,
            width: size * 0.5,
            height: 4,
            borderRadius: 999,
            backgroundColor: colors.warning,
            opacity: 0.3,
          }}
        />
        {/* tintColor renkli PNG'lerde Android crash'e neden olabiliyor.
            Ölü/solgun durum opacity ile temsil edilir; üstüne overlay yetiyor. */}
        <Image
          source={pngImage}
          style={{
            width: imgSize,
            height: imgSize,
          }}
          resizeMode="contain"
        />
        {/* Solgun sarı overlay */}
        {isWilted && overlayColor ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              backgroundColor: overlayColor,
              opacity: 0.18,
            }}
          />
        ) : null}
      </View>
    );
  }

  // Palet (her bitki için) — SVG yolu
  const palette = getPalette(plantType, gradients);

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'flex-end',
        opacity: tint,
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 64 64">
        {/* Toprak izi (her zaman görünür) */}
        <Ellipse cx={32} cy={58} rx={14} ry={3} fill={colors.warning} opacity={0.4} />

        {/* Plant body — stage'e göre çiz */}
        {renderStage(plantType, stage, palette, colors, gradients, stageScale, isDead)}

        {/* Solgun overlay — hafif sarımsı */}
        {isWilted && overlayColor ? (
          <Rect x={0} y={0} width={64} height={64} fill={overlayColor} opacity={0.18} />
        ) : null}
      </Svg>
    </View>
  );
}

type Palette = {
  petal: string;
  petal2: string;
  center: string;
  leaf: string;
  leafDark: string;
  bark: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPalette(plantType: string, g: any): Palette {
  const map: Record<string, Palette> = {
    papatya:  { petal: '#FEF3C7', petal2: '#FBBF24', center: '#F59E0B', leaf: g.success[0], leafDark: g.success[1], bark: '#92400E' },
    lavanta:  { petal: '#C4B5FD', petal2: '#15803D', center: '#5B21B6', leaf: g.mint[0],    leafDark: g.mint[1],    bark: '#92400E' },
    aycicegi: { petal: '#FBBF24', petal2: '#F59E0B', center: '#92400E', leaf: g.success[0], leafDark: g.success[1], bark: '#78350F' },
    lale:     { petal: '#FB923C', petal2: '#DB2777', center: '#9D174D', leaf: g.success[0], leafDark: g.success[1], bark: '#15803D' },
    gul:      { petal: '#EF4444', petal2: '#B91C1C', center: '#7F1D1D', leaf: g.success[0], leafDark: g.success[1], bark: '#14532D' },
    hibiskus: { petal: '#FB923C', petal2: '#EA580C', center: '#9A3412', leaf: g.success[0], leafDark: g.success[1], bark: '#15803D' },
    lotus:    { petal: '#FBBF24', petal2: '#FCD34D', center: '#F59E0B', leaf: g.mint[0],    leafDark: g.mint[1],    bark: '#92400E' },
    anka:     { petal: '#EF4444', petal2: '#F97316', center: '#FBBF24', leaf: g.streak[0],  leafDark: g.streak[1],  bark: '#7C2D12' },
    cam:      { petal: g.success[0], petal2: g.success[1], center: '#14532D', leaf: g.success[0], leafDark: g.success[1], bark: '#78350F' },
    mese:     { petal: g.mint[1],    petal2: g.success[1], center: '#166534', leaf: g.mint[1],    leafDark: g.success[1], bark: '#7C2D12' },
    akcaagac: { petal: '#F97316',    petal2: '#DC2626', center: '#7C2D12', leaf: '#FB923C',    leafDark: '#DC2626',     bark: '#7C2D12' },
    manolya:  { petal: '#FCE7F3',    petal2: '#FB923C', center: '#EC4899', leaf: g.success[0], leafDark: g.success[1], bark: '#78350F' },
    bonsai:   { petal: '#FCA5A5',    petal2: '#F87171', center: '#B91C1C', leaf: g.success[0], leafDark: g.success[1], bark: '#7C2D12' },
    sakura:   { petal: '#FBCFE8',    petal2: '#FB923C', center: '#EC4899', leaf: g.success[0], leafDark: g.success[1], bark: '#7C2D12' },
  };
  return map[plantType] || map.papatya;
}

function renderStage(
  plantType: string,
  stage: PlantStage,
  p: Palette,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  colors: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gradients: any,
  scale: number,
  isDead: boolean,
) {
  // 4 evreyi merkezi kanal üzerinden çiz — her plantType kendi mature varyantına döner
  if (stage === 'seed') {
    // Küçük tohum: oval kahve nokta + ince çatlak
    return (
      <>
        <Ellipse cx={32} cy={50} rx={6} ry={4} fill={p.bark} />
        <Path d="M 32 50 L 32 47" stroke={colors.white} strokeWidth={0.8} opacity={0.6} />
      </>
    );
  }
  if (stage === 'sprout') {
    // Filiz: 2 yaprak + kısa sap
    return (
      <>
        <Path d="M 32 50 L 32 38" stroke={p.leafDark} strokeWidth={2} strokeLinecap="round" />
        <Path d={`M 32 42 q -6 -4 -10 -2 q 4 6 10 2 Z`} fill={p.leaf} />
        <Path d={`M 32 42 q 6 -4 10 -2 q -4 6 -10 2 Z`} fill={p.leaf} />
      </>
    );
  }
  if (stage === 'young') {
    // Genç: orta boy gövde + 3-4 yaprak, küçük bud
    return (
      <>
        <Path d="M 32 50 L 32 26" stroke={p.leafDark} strokeWidth={2.4} strokeLinecap="round" />
        <Path d={`M 32 38 q -8 -3 -12 0 q 4 7 12 0 Z`} fill={p.leaf} />
        <Path d={`M 32 38 q 8 -3 12 0 q -4 7 -12 0 Z`} fill={p.leaf} />
        <Path d={`M 32 30 q -7 -3 -10 0 q 3 6 10 0 Z`} fill={p.leaf} />
        <Path d={`M 32 30 q 7 -3 10 0 q -3 6 -10 0 Z`} fill={p.leaf} />
        <Circle cx={32} cy={22} r={3} fill={p.petal2} opacity={0.7} />
      </>
    );
  }
  // mature — plant tipine göre özelleştir
  if (isDead) {
    // Tüm matureler için droop pose
    return (
      <>
        <Path d="M 32 52 Q 30 32 22 28" stroke={colors.textMuted} strokeWidth={2.4} strokeLinecap="round" fill="none" />
        <Path d={`M 22 28 q -5 1 -7 4 q 3 4 9 1`} fill={colors.bgElevated} />
      </>
    );
  }
  return renderMature(plantType, p, colors, gradients);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderMature(plantType: string, p: Palette, colors: any, gradients: any) {
  // Çiçek tipleri — gövde + yapraklar + merkez taç
  const isFlower = ['papatya','lavanta','aycicegi','lale','gul','hibiskus','lotus','anka'].includes(plantType);

  if (isFlower) {
    // Çiçek varyantları
    return (
      <>
        {/* Gövde */}
        <Path d="M 32 56 L 32 30" stroke={p.leafDark} strokeWidth={2.4} strokeLinecap="round" />
        {/* Alt yaprak */}
        <Path d="M 32 44 q -10 -3 -14 1 q 5 7 14 -1 Z" fill={p.leaf} stroke={p.leafDark} strokeWidth={0.5} />
        <Path d="M 32 44 q 10 -3 14 1 q -5 7 -14 -1 Z" fill={p.leaf} stroke={p.leafDark} strokeWidth={0.5} />

        {/* Çiçek başı — tipe göre */}
        {plantType === 'papatya' ? (
          <>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <Ellipse
                key={deg}
                cx={32 + Math.cos((deg * Math.PI) / 180) * 8}
                cy={22 + Math.sin((deg * Math.PI) / 180) * 8}
                rx={4}
                ry={3}
                fill={p.petal}
                stroke={p.petal2}
                strokeWidth={0.5}
              />
            ))}
            <Circle cx={32} cy={22} r={4} fill={p.center} />
          </>
        ) : plantType === 'lavanta' ? (
          // Lavanta — uzun sap üzerinde 5 küçük mor topuz
          <>
            {[0, 1, 2, 3, 4].map((i) => (
              <Circle key={i} cx={32} cy={26 - i * 3} r={2.4} fill={p.petal2} />
            ))}
            <Circle cx={32} cy={26} r={2.6} fill={p.petal} opacity={0.6} />
          </>
        ) : plantType === 'aycicegi' ? (
          // Ayçiçeği — büyük başlı, kahverengi merkez
          <>
            {[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map((deg) => (
              <Path
                key={deg}
                d={`M 32 18 l ${Math.cos(((deg - 90) * Math.PI) / 180) * 9} ${Math.sin(((deg - 90) * Math.PI) / 180) * 9} l ${Math.cos(((deg - 78) * Math.PI) / 180) * 4} ${Math.sin(((deg - 78) * Math.PI) / 180) * 4} z`}
                fill={p.petal}
                stroke={p.petal2}
                strokeWidth={0.4}
              />
            ))}
            <Circle cx={32} cy={18} r={5} fill={p.center} />
          </>
        ) : plantType === 'lale' ? (
          // Lale — kapalı kupa formu
          <>
            <Path
              d="M 22 24 Q 24 12 32 10 Q 40 12 42 24 Q 38 28 32 28 Q 26 28 22 24 Z"
              fill={p.petal}
              stroke={p.petal2}
              strokeWidth={0.6}
            />
            <Path d="M 30 12 Q 32 24 34 12" stroke={p.petal2} strokeWidth={0.6} fill="none" />
          </>
        ) : plantType === 'gul' ? (
          // Gül — katmanlı yapraklar
          <>
            {[12, 10, 8, 6, 4].map((r, i) => (
              <Circle
                key={i}
                cx={32}
                cy={20 - i}
                r={r * 0.7}
                fill={i % 2 === 0 ? p.petal : p.petal2}
                opacity={0.85}
              />
            ))}
            <Circle cx={32} cy={20} r={2} fill={p.center} />
          </>
        ) : plantType === 'hibiskus' ? (
          // Hibiskus — geniş 5 yaprak + uzun pistil
          <>
            {[0, 72, 144, 216, 288].map((deg) => (
              <Path
                key={deg}
                d={`M 32 22 q ${Math.cos((deg * Math.PI) / 180) * 12} ${Math.sin((deg * Math.PI) / 180) * 12} 0 0 q ${Math.cos(((deg + 30) * Math.PI) / 180) * 6} ${Math.sin(((deg + 30) * Math.PI) / 180) * 6} 0 0`}
                fill={p.petal}
                opacity={0.85}
                stroke={p.petal2}
                strokeWidth={0.4}
              />
            ))}
            <Circle cx={32} cy={22} r={3.5} fill={p.center} />
            <Path d="M 32 22 L 38 18" stroke={p.petal2} strokeWidth={1} />
          </>
        ) : plantType === 'lotus' ? (
          // Lotus — altın taç, su yansıması
          <>
            <Ellipse cx={32} cy={32} rx={16} ry={3} fill={gradients.ocean[0]} opacity={0.5} />
            {[0, 60, 120, 180, 240, 300].map((deg) => (
              <Path
                key={deg}
                d={`M 32 22 q ${Math.cos((deg * Math.PI) / 180) * 8} ${Math.sin((deg * Math.PI) / 180) * 8} 0 0 z`}
                fill={p.petal}
                stroke={p.petal2}
                strokeWidth={0.5}
              />
            ))}
            <Circle cx={32} cy={22} r={3} fill={p.center} />
          </>
        ) : plantType === 'anka' ? (
          // Anka — alev yapraklar
          <>
            {[0, 60, 120, 180, 240, 300].map((deg) => (
              <Path
                key={deg}
                d={`M 32 22 q ${Math.cos((deg * Math.PI) / 180) * 10} ${Math.sin((deg * Math.PI) / 180) * 10} ${Math.cos(((deg + 30) * Math.PI) / 180) * 4} ${Math.sin(((deg + 30) * Math.PI) / 180) * 4} z`}
                fill={p.petal}
                opacity={0.92}
              />
            ))}
            <Circle cx={32} cy={22} r={3.5} fill={p.center} />
            {/* Alev parıltısı */}
            <Circle cx={28} cy={18} r={1.2} fill={colors.white} opacity={0.7} />
          </>
        ) : null}
      </>
    );
  }

  // AĞAÇ varyantları
  if (plantType === 'cam') {
    // Çam — üç katmanlı sivri
    return (
      <>
        <Rect x={29} y={50} width={6} height={10} fill={p.bark} />
        <Path d="M 32 8 L 18 30 L 26 30 L 14 44 L 28 44 L 18 56 L 46 56 L 36 44 L 50 44 L 38 30 L 46 30 Z" fill={p.petal} stroke={p.petal2} strokeWidth={0.6} />
      </>
    );
  }
  if (plantType === 'mese') {
    // Meşe — yuvarlak yaprak topu, kalın gövde
    return (
      <>
        <Rect x={28} y={42} width={8} height={18} fill={p.bark} />
        <Circle cx={32} cy={26} r={18} fill={p.petal} stroke={p.petal2} strokeWidth={0.8} />
        <Circle cx={22} cy={30} r={9} fill={p.petal} opacity={0.85} />
        <Circle cx={42} cy={28} r={10} fill={p.petal} opacity={0.85} />
      </>
    );
  }
  if (plantType === 'akcaagac') {
    // Akçaağaç — turuncu/kırmızı yaprak topu
    return (
      <>
        <Rect x={29} y={44} width={6} height={16} fill={p.bark} />
        <Path d="M 32 14 Q 14 22 18 36 Q 22 46 32 44 Q 42 46 46 36 Q 50 22 32 14 Z" fill={p.petal} stroke={p.petal2} strokeWidth={0.6} />
        <Circle cx={28} cy={30} r={3} fill={p.petal2} opacity={0.7} />
        <Circle cx={38} cy={26} r={2.5} fill={p.petal2} opacity={0.7} />
      </>
    );
  }
  if (plantType === 'manolya') {
    // Manolya — soluk pembe büyük çiçekli ağaç
    return (
      <>
        <Rect x={29} y={46} width={6} height={14} fill={p.bark} />
        <Circle cx={32} cy={28} r={16} fill={p.leaf} stroke={p.leafDark} strokeWidth={0.5} />
        {[0, 72, 144, 216, 288].map((deg) => (
          <Circle
            key={deg}
            cx={32 + Math.cos((deg * Math.PI) / 180) * 9}
            cy={28 + Math.sin((deg * Math.PI) / 180) * 9}
            r={4}
            fill={p.petal}
            stroke={p.petal2}
            strokeWidth={0.5}
          />
        ))}
      </>
    );
  }
  if (plantType === 'bonsai') {
    // Bonsai — kıvrımlı gövde + minik yaprak topu
    return (
      <>
        <Ellipse cx={32} cy={56} rx={14} ry={3} fill={colors.bgElevated} />
        <Path d="M 32 56 Q 26 44 32 36 Q 38 28 30 18" stroke={p.bark} strokeWidth={3.5} fill="none" strokeLinecap="round" />
        <Circle cx={28} cy={22} r={7} fill={p.leaf} stroke={p.leafDark} strokeWidth={0.6} />
        <Circle cx={36} cy={26} r={6} fill={p.leaf} stroke={p.leafDark} strokeWidth={0.6} />
        <Circle cx={28} cy={22} r={2} fill={p.petal} />
        <Circle cx={36} cy={26} r={1.6} fill={p.petal} />
      </>
    );
  }
  if (plantType === 'sakura') {
    // Sakura — pembe çiçekli ağaç, dökülen yapraklar
    return (
      <>
        <Rect x={29} y={46} width={6} height={14} fill={p.bark} />
        <Circle cx={32} cy={26} r={18} fill={p.petal} stroke={p.petal2} strokeWidth={0.6} />
        <Circle cx={22} cy={30} r={8} fill={p.petal} opacity={0.92} />
        <Circle cx={42} cy={30} r={9} fill={p.petal} opacity={0.92} />
        {/* Çiçek noktaları */}
        <Circle cx={26} cy={22} r={1.4} fill={p.petal2} />
        <Circle cx={36} cy={20} r={1.4} fill={p.petal2} />
        <Circle cx={32} cy={32} r={1.4} fill={p.petal2} />
        {/* Düşen yaprak */}
        <Circle cx={48} cy={42} r={1.2} fill={p.petal2} opacity={0.7} />
        <Circle cx={18} cy={50} r={1.2} fill={p.petal2} opacity={0.7} />
      </>
    );
  }
  return null;
}

export const PlantRenderer = memo(PlantRendererBase);
