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

// Всплывающая карточка товара: товар поворачивается в объёме (±28°), по нему
// проходит блик. Полного 360° из одного фото не бывает — нет обратной стороны;
// для настоящего оборота нужна съёмка на поворотном столике.

export type CardItem = { image: string; name: string; sub?: string };
export type ProductCardProps = {
  items: CardItem[];
  seconds: number; // сколько держится каждая карточка
  accent: string;
  background?: string; // картинка фона (например, кадр кассы)
};

const Card: React.FC<{ item: CardItem; accent: string; dur: number }> = ({ item, accent, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 170 } });
  const out = interpolate(frame, [dur - 0.35 * fps, dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  const rot = Math.sin(t * 1.6) * 28; // плавное покачивание в объёме
  const float = Math.sin(t * 2.1) * 10;
  const sheen = interpolate(frame, [0.5 * fps, 1.5 * fps], [-60, 160], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
  const src = staticFile(item.image);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: 760,
          height: 1060,
          borderRadius: 48,
          background: "linear-gradient(160deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06))",
          border: "2px solid rgba(255,255,255,0.35)",
          boxShadow: "0 40px 120px rgba(0,0,0,0.45)",
          backdropFilter: "blur(24px)",
          scale: interpolate(pop, [0, 1], [0.7, 1]) * interpolate(out, [0, 1], [0.85, 1]),
          opacity: Math.min(interpolate(pop, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }), out),
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "70px 50px 56px",
          overflow: "hidden",
        }}
      >
        <div style={{ perspective: 1400, height: 700, display: "flex", alignItems: "center" }}>
          <div
            style={{
              position: "relative",
              height: 640,
              transform: `translateY(${float}px) rotateY(${rot}deg)`,
              transformStyle: "preserve-3d",
            }}
          >
            <Img src={src} style={{ height: 640, filter: "drop-shadow(0 30px 30px rgba(0,0,0,0.35))" }} />
            {/* блик — только по форме товара */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `linear-gradient(105deg, transparent ${sheen - 20}%, rgba(255,255,255,0.55) ${sheen}%, transparent ${sheen + 20}%)`,
                WebkitMaskImage: `url(${src})`,
                WebkitMaskSize: "100% 100%",
                maskImage: `url(${src})`,
                maskSize: "100% 100%",
                mixBlendMode: "screen",
              }}
            />
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily, fontWeight: 800, fontSize: 60, color: "white", lineHeight: 1.1 }}>{item.name}</div>
          {item.sub ? (
            <div style={{ fontFamily, fontWeight: 600, fontSize: 34, color: accent, marginTop: 14 }}>{item.sub}</div>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const ProductCard: React.FC<ProductCardProps> = ({ items, seconds, accent, background }) => {
  const { fps } = useVideoConfig();
  const dur = Math.round(seconds * fps);
  return (
    <AbsoluteFill style={{ background: "radial-gradient(900px 700px at 50% 45%, #4a4136 0%, #1c1a17 70%)" }}>
      {background ? (
        <Img
          src={staticFile(background)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(14px) brightness(0.6)" }}
        />
      ) : null}
      {items.map((item, i) => (
        <Sequence key={i} from={i * dur} durationInFrames={dur}>
          <Card item={item} accent={accent} dur={dur} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
