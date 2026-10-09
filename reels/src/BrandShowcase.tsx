import { Audio } from "@remotion/media";
import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fontFamily } from "./fonts";

// Витрина товаров в фирменном стиле WAY Маркета: светлый фон, зелёная дуга и
// «линии скорости» из логотипа, белые карточки, товар покачивается в объёме.

export type ShowcaseItem = { image: string; name: string; sub?: string };
export type BrandShowcaseProps = {
  items: ShowcaseItem[];
  seconds: number; // длительность карточки
  intro: number; // заставка с логотипом, секунды
  outro: number; // финал с логотипом и адресом
  logo: string;
  slogan?: string; // подпись под карточкой; в логотипе слоган уже есть — по умолчанию не нужна
  address?: string;
  whoosh?: string; // звук появления карточки
  green: string;
  dark: string;
};

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Зелёная дуга как в логотипе: рисуется и медленно вращается
const Arc: React.FC<{
  size: number;
  color: string;
  width: number;
  progress: number;
  rotate: number;
  opacity: number;
}> = ({ size, color, width, progress, rotate, opacity }) => {
  const r = size / 2 - width;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      style={{ position: "absolute", rotate: `${rotate}deg`, opacity }}
    >
      <defs>
        <linearGradient id={`g${size}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.15} />
          <stop offset="100%" stopColor={color} stopOpacity={1} />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={`url(#g${size})`}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={`${c * 0.72 * progress} ${c}`}
      />
    </svg>
  );
};

// «Линии скорости» из логотипа: пролетают слева при появлении карточки
const SpeedLines: React.FC<{ color: string; y: number }> = ({ color, y }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lines = [0, 1, 2, 3, 4];
  return (
    <>
      {lines.map((i) => {
        const delay = i * 1.5;
        const p = interpolate(frame - delay, [0, 0.55 * fps], [0, 1], {
          ...clamp,
          easing: Easing.out(Easing.cubic),
        });
        const fade = interpolate(
          frame - delay,
          [0.35 * fps, 0.8 * fps],
          [1, 0],
          clamp,
        );
        const len = [380, 300, 420, 260, 340][i];
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: y + i * 26,
              left: interpolate(p, [0, 1], [-len, 60 + i * 12]),
              width: len,
              height: 9,
              borderRadius: 9,
              background: `linear-gradient(90deg, transparent, ${color})`,
              opacity: fade * 0.85,
            }}
          />
        );
      })}
    </>
  );
};

const Background: React.FC<{ green: string }> = ({ green }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(170deg, #FCFDFB 0%, #F2F7EF 55%, #E6F0E1 100%)",
        overflow: "hidden",
      }}
    >
      {/* мягкие зелёные пятна света, едва движутся */}
      {[
        { x: 120, y: 260, r: 520, a: 0.16, s: 0.25 },
        { x: 820, y: 1380, r: 640, a: 0.14, s: 0.18 },
        { x: 900, y: 420, r: 360, a: 0.1, s: 0.3 },
      ].map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: b.x - b.r / 2 + Math.sin(t * b.s + i) * 40,
            top: b.y - b.r / 2 + Math.cos(t * b.s + i) * 30,
            width: b.r,
            height: b.r,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${green}${Math.round(b.a * 255)
              .toString(16)
              .padStart(2, "0")} 0%, transparent 70%)`,
          }}
        />
      ))}
      {/* большая дуга логотипа на фоне */}
      <div
        style={{
          position: "absolute",
          left: -380,
          top: 520,
          width: 1500,
          height: 1500,
        }}
      >
        <Arc
          size={1500}
          color={green}
          width={22}
          progress={1}
          rotate={150 + t * 4}
          opacity={0.12}
        />
      </div>
    </AbsoluteFill>
  );
};

const Card: React.FC<{
  item: ShowcaseItem;
  dur: number;
  green: string;
  dark: string;
}> = ({ item, dur, green, dark }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const pop = spring({ frame, fps, config: { damping: 15, stiffness: 160 } });
  const out = interpolate(frame, [dur - 0.35 * fps, dur], [1, 0], {
    ...clamp,
    easing: Easing.in(Easing.cubic),
  });
  const rot = Math.sin(t * 1.6) * 26;
  const float = Math.sin(t * 2.1) * 10;
  const sheen = interpolate(frame, [0.5 * fps, 1.5 * fps], [-60, 160], {
    ...clamp,
    easing: Easing.inOut(Easing.quad),
  });
  const arc = interpolate(frame, [0.1 * fps, 0.9 * fps], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const src = staticFile(item.image);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <SpeedLines color={green} y={760} />
      <div
        style={{
          width: 800,
          height: 1080,
          marginTop: 40,
          borderRadius: 56,
          background: "rgba(255,255,255,0.9)",
          border: `2px solid ${green}22`,
          boxShadow: `0 40px 100px ${dark}2e, 0 6px 18px ${dark}14`,
          scale:
            interpolate(pop, [0, 1], [0.72, 1]) *
            interpolate(out, [0, 1], [0.88, 1]),
          translate: `${interpolate(pop, [0, 1], [-60, 0])}px 0px`,
          opacity: Math.min(interpolate(pop, [0, 0.5], [0, 1], clamp), out),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "60px 50px 64px",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "relative",
            width: 700,
            height: 720,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Arc
            size={640}
            color={green}
            width={18}
            progress={arc}
            rotate={110 + t * 12}
            opacity={0.9}
          />
          <div style={{ perspective: 1400 }}>
            <div
              style={{
                position: "relative",
                lineHeight: 0,
                transform: `translateY(${float}px) rotateY(${rot}deg)`,
              }}
            >
              {/* высокие упаковки — по высоте, широкие (лапша, плитка) — по ширине */}
              <Img
                src={src}
                style={{
                  maxHeight: 600,
                  maxWidth: 620,
                  filter: `drop-shadow(0 34px 28px ${dark}40)`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `linear-gradient(105deg, transparent ${sheen - 20}%, rgba(255,255,255,0.6) ${sheen}%, transparent ${sheen + 20}%)`,
                  WebkitMaskImage: `url(${src})`,
                  WebkitMaskSize: "100% 100%",
                  maskImage: `url(${src})`,
                  maskSize: "100% 100%",
                  mixBlendMode: "screen",
                }}
              />
            </div>
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily,
              fontWeight: 800,
              fontSize: 64,
              color: dark,
              lineHeight: 1.1,
            }}
          >
            {item.name}
          </div>
          {item.sub ? (
            <div
              style={{
                fontFamily,
                fontWeight: 600,
                fontSize: 36,
                color: green,
                marginTop: 14,
              }}
            >
              {item.sub}
            </div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const LogoScene: React.FC<{
  logo: string;
  slogan?: string;
  address?: string;
  green: string;
  dark: string;
  dur: number;
}> = ({ logo, slogan, address, green, dark, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 16, stiffness: 140 } });
  const sub = spring({
    frame: frame - 0.3 * fps,
    fps,
    config: { damping: 200 },
  });
  const out = interpolate(frame, [dur - 0.3 * fps, dur], [1, 0], clamp);
  return (
    <AbsoluteFill
      style={{ alignItems: "center", justifyContent: "center", opacity: out }}
    >
      <SpeedLines color={green} y={820} />
      <Img
        src={staticFile(logo)}
        style={{
          width: 760,
          scale: interpolate(pop, [0, 1], [0.8, 1]),
          opacity: interpolate(pop, [0, 0.6], [0, 1], clamp),
        }}
      />
      {address ? (
        <div
          style={{
            fontFamily,
            fontWeight: 600,
            fontSize: 40,
            color: dark,
            marginTop: 40,
            opacity: sub,
          }}
        >
          {address}
        </div>
      ) : null}
      {slogan && !address ? (
        <div
          style={{
            fontFamily,
            fontWeight: 800,
            fontSize: 44,
            color: green,
            marginTop: 30,
            opacity: sub,
          }}
        >
          {slogan}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const BrandShowcase: React.FC<BrandShowcaseProps> = (p) => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const intro = Math.round(p.intro * fps);
  const dur = Math.round(p.seconds * fps);
  const outroFrom = intro + p.items.length * dur;
  // маленький логотип сверху, пока идут карточки
  const badge = interpolate(
    frame,
    [intro - 6, intro + 10, outroFrom - 6, outroFrom],
    [0, 1, 1, 0],
    clamp,
  );
  return (
    <AbsoluteFill>
      <Background green={p.green} />
      <Sequence durationInFrames={intro}>
        <LogoScene logo={p.logo} green={p.green} dark={p.dark} dur={intro} />
      </Sequence>
      <Img
        src={staticFile(p.logo)}
        style={{
          position: "absolute",
          top: 120,
          left: (1080 - 300) / 2,
          width: 300,
          opacity: badge,
        }}
      />
      {p.items.map((item, i) => (
        <Sequence key={i} from={intro + i * dur} durationInFrames={dur}>
          <Card item={item} dur={dur} green={p.green} dark={p.dark} />
          {p.whoosh ? <Audio src={staticFile(p.whoosh)} volume={0.55} /> : null}
        </Sequence>
      ))}
      <Sequence from={outroFrom} durationInFrames={Math.round(p.outro * fps)}>
        <LogoScene
          logo={p.logo}
          address={p.address}
          green={p.green}
          dark={p.dark}
          dur={Math.round(p.outro * fps)}
        />
      </Sequence>
      {p.slogan ? (
        <div
          style={{
            position: "absolute",
            bottom: 300,
            width: "100%",
            textAlign: "center",
            fontFamily,
            fontWeight: 800,
            fontSize: 34,
            letterSpacing: 2,
            color: p.green,
            opacity: badge,
          }}
        >
          {p.slogan}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
