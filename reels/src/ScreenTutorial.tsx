import { Audio, Video } from "@remotion/media";
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
import type { Focus, ReelProps, Scene, Word } from "./types";

// Безопасная зона Reels: сверху ~220px и снизу ~380px перекрывает интерфейс Instagram
const LAYOUT = {
  kickerY: 210,
  headerY: 258,
  cardTop: 480,
  cardHeight: 900,
  captionY: 1480,
};

// Страница субтитров — не длиннее этого числа знаков, чтобы влезать в 2 строки
const CAPTION_CHARS = 20;

const BG = "#0e1014";
const CARD_RADIUS = 28;
const NO_ZOOM: Focus = { x: 0.5, y: 0.5, zoom: 1 };

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// «*слово*» в заголовке выделяется акцентным цветом
const Accented: React.FC<{ text: string; accent: string }> = ({ text, accent }) => (
  <>
    {text.split(/(\*[^*]+\*)/g).map((part, i) =>
      part.startsWith("*") ? (
        <span key={i} style={{ color: accent }}>
          {part.slice(1, -1)}
        </span>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      ),
    )}
  </>
);

const Background: React.FC<{ accent: string }> = ({ accent }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(1200px 900px at 50% 38%, ${accent}22 0%, ${BG} 60%), ${BG}`,
    }}
  />
);

const ProgressBar: React.FC<{ accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        height: 10,
        width: `${(frame / durationInFrames) * 100}%`,
        background: accent,
      }}
    />
  );
};

const Kicker: React.FC<{ text: string; accent: string }> = ({ text, accent }) => (
  <div
    style={{
      position: "absolute",
      top: LAYOUT.kickerY,
      width: "100%",
      textAlign: "center",
      fontFamily,
      fontWeight: 800,
      fontSize: 30,
      letterSpacing: 4,
      color: accent,
      textTransform: "uppercase",
    }}
  >
    {text}
  </div>
);

// Плашка «ШАГ N» и подпись шага: въезжают в начале сцены
const StepHeader: React.FC<{ scene: Scene; accent: string }> = ({ scene, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: Math.round(0.45 * fps) });
  return (
    <div
      style={{
        position: "absolute",
        top: LAYOUT.headerY,
        left: 80,
        right: 80,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        opacity: enter,
        translate: `0px ${interpolate(enter, [0, 1], [24, 0])}px`,
      }}
    >
      {scene.step ? (
        <div
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: 30,
            letterSpacing: 2,
            color: BG,
            background: accent,
            padding: "8px 22px",
            borderRadius: 999,
            textTransform: "uppercase",
          }}
        >
          {scene.step}
        </div>
      ) : null}
      <div
        style={{
          fontFamily,
          fontWeight: 800,
          // длинная подпись уменьшается, чтобы влезть в 2 строки над карточкой
          fontSize: (scene.label ?? "").length > 20 ? 44 : 56,
          lineHeight: 1.1,
          color: "white",
          textAlign: "center",
        }}
      >
        {scene.label}
      </div>
    </div>
  );
};

// Кадр записи в карточке. Приближение плавно переходит от фокуса прошлой сцены к своему
const ScreenCard: React.FC<{
  scene: Scene;
  prevFocus: Focus;
  clipAspect: number;
  accent: string;
}> = ({ scene, prevFocus, clipAspect, accent }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const H = LAYOUT.cardHeight;
  const W = Math.min(H * clipAspect, width - 2 * 60);
  const target = scene.focus ?? NO_ZOOM;
  const t = interpolate(frame, [0, 0.7 * fps], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.65, 0, 0.35, 1),
  });
  const z = interpolate(t, [0, 1], [prevFocus.zoom, target.zoom]);
  const fx = interpolate(t, [0, 1], [prevFocus.x, target.x]);
  const fy = interpolate(t, [0, 1], [prevFocus.y, target.y]);
  // Фокус держим в центре карточки, но не показываем пустоту за краем записи
  const tx = Math.min(0, Math.max(W - W * z, W / 2 - fx * W * z));
  const ty = Math.min(0, Math.max(H - H * z, H / 2 - fy * H * z));

  return (
    <div
      style={{
        position: "absolute",
        top: LAYOUT.cardTop,
        left: (width - W) / 2,
        width: W,
        height: H,
        borderRadius: CARD_RADIUS,
        overflow: "hidden",
        boxShadow: `0 30px 80px rgba(0,0,0,0.55), 0 0 0 3px ${accent}55`,
        background: "#fff",
      }}
    >
      <div
        style={{
          width: W,
          height: H,
          transformOrigin: "0 0",
          transform: `translate(${tx}px, ${ty}px) scale(${z})`,
        }}
      >
        {scene.clip ? (
          <Video src={staticFile(scene.clip)} muted objectFit="fill" style={{ width: W, height: H }} />
        ) : null}
        {scene.click ? <ClickRing click={scene.click} W={W} H={H} accent={accent} zoom={z} /> : null}
      </div>
    </div>
  );
};

// Расходящееся кольцо в точке клика
const ClickRing: React.FC<{
  click: NonNullable<Scene["click"]>;
  W: number;
  H: number;
  accent: string;
  zoom: number;
}> = ({ click, W, H, accent, zoom }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - click.at * fps;
  if (local < 0 || local > 0.9 * fps) return null;
  const p = local / (0.9 * fps);
  const size = interpolate(p, [0, 1], [20, 120]) / zoom;
  return (
    <div
      style={{
        position: "absolute",
        left: click.x * W - size / 2,
        top: click.y * H - size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        border: `${6 / zoom}px solid ${accent}`,
        background: `${accent}33`,
        opacity: interpolate(p, [0, 0.15, 1], [0, 1, 0]),
      }}
    />
  );
};

// Заголовок-крючок и финальный призыв: крупный текст поверх размытого кадра
const TitleCard: React.FC<{ scene: Scene; accent: string; kicker: string }> = ({ scene, accent, kicker }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 14, stiffness: 160 } });
  const sub = spring({ frame: frame - 0.25 * fps, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill>
      {scene.still ? (
        <Img
          src={staticFile(scene.still)}
          style={{
            position: "absolute",
            inset: -60,
            width: "calc(100% + 120px)",
            height: "calc(100% + 120px)",
            objectFit: "cover",
            filter: "blur(18px) brightness(0.35)",
          }}
        />
      ) : null}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${BG}aa 0%, ${BG}55 45%, ${BG}ee 100%)` }} />
      <div
        style={{
          position: "absolute",
          top: 560,
          left: 80,
          right: 80,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 34,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: 30,
            letterSpacing: 3,
            color: BG,
            background: accent,
            padding: "10px 24px",
            borderRadius: 999,
            textTransform: "uppercase",
            opacity: sub,
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            fontFamily,
            fontWeight: 900,
            fontSize: 96,
            lineHeight: 1.04,
            color: "white",
            textTransform: "uppercase",
            scale: interpolate(pop, [0, 1], [0.85, 1]),
            opacity: interpolate(pop, [0, 0.4], [0, 1], clamp),
          }}
        >
          <Accented text={scene.title ?? ""} accent={accent} />
        </div>
        {scene.subtitle ? (
          <div
            style={{
              fontFamily,
              fontWeight: 600,
              fontSize: 46,
              lineHeight: 1.2,
              color: "#e8e8e8",
              opacity: sub,
              translate: `0px ${interpolate(sub, [0, 1], [20, 0])}px`,
            }}
          >
            <Accented text={scene.subtitle} accent={accent} />
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// Субтитры страницами по 1–3 слова; слово, которое звучит сейчас, — акцентом
type Page = { words: Word[]; start: number; end: number };

const makePages = (words: Word[]): Page[] => {
  const pages: Page[] = [];
  let cur: Word[] = [];
  words.forEach((w, i) => {
    const prev = words[i - 1];
    const len = cur.map((c) => c.text).join(" ").length;
    const breakHere =
      cur.length >= 3 ||
      len + 1 + w.text.length > CAPTION_CHARS ||
      (prev && (w.start - prev.end > 0.3 || /[.,!?…:;—]$/.test(prev.text)));
    if (cur.length && breakHere) {
      pages.push({ words: cur, start: cur[0].start, end: cur[cur.length - 1].end });
      cur = [];
    }
    cur.push(w);
  });
  if (cur.length) pages.push({ words: cur, start: cur[0].start, end: cur[cur.length - 1].end });
  return pages.map((p, i) => ({ ...p, end: Math.min(pages[i + 1]?.start ?? p.end + 0.5, p.end + 0.5) }));
};

const Captions: React.FC<{ words: Word[]; accent: string }> = ({ words, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const pages = React.useMemo(() => makePages(words), [words]);
  const page = pages.find((p) => t >= p.start && t < p.end);
  if (!page) return null;
  const local = (t - page.start) * fps;
  const pop = spring({ frame: local, fps, config: { damping: 12, stiffness: 220 }, durationInFrames: 8 });
  return (
    <div
      style={{
        position: "absolute",
        top: LAYOUT.captionY,
        left: 70,
        right: 70,
        translate: "0px -50%",
        textAlign: "center",
        fontFamily,
        fontWeight: 900,
        fontSize: 74,
        lineHeight: 1.08,
        textTransform: "uppercase",
        color: "white",
        WebkitTextStroke: "3px #000",
        paintOrder: "stroke fill",
        textShadow: "0 6px 24px rgba(0,0,0,0.7)",
        scale: interpolate(pop, [0, 1], [0.9, 1]),
      }}
    >
      {page.words.map((w, i) => {
        const active = t >= w.start && t < (page.words[i + 1]?.start ?? page.end);
        return (
          <span key={i} style={{ color: active ? accent : "white" }}>
            {w.text}
            {i < page.words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </div>
  );
};

export const ScreenTutorial: React.FC<ReelProps> = (props) => {
  const { fps } = useVideoConfig();
  const steps = props.scenes.filter((s) => s.kind === "step");
  return (
    <AbsoluteFill style={{ background: BG }}>
      <Background accent={props.accent} />
      {props.scenes.map((scene, i) => {
        const from = Math.round(scene.start * fps);
        const dur = Math.round((scene.start + scene.duration) * fps) - from;
        if (scene.kind !== "step") {
          return (
            <Sequence key={i} from={from} durationInFrames={dur}>
              <TitleCard scene={scene} accent={props.accent} kicker={props.kicker} />
            </Sequence>
          );
        }
        const prev = steps[steps.indexOf(scene) - 1];
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <Kicker text={props.kicker} accent={props.accent} />
            <StepHeader scene={scene} accent={props.accent} />
            <ScreenCard
              scene={scene}
              prevFocus={prev?.focus ?? NO_ZOOM}
              clipAspect={props.clipAspect}
              accent={props.accent}
            />
          </Sequence>
        );
      })}
      <Captions words={props.words} accent={props.accent} />
      <ProgressBar accent={props.accent} />
      <Audio src={staticFile(props.voice)} />
      {props.music ? <Audio src={staticFile(props.music)} volume={props.musicVolume ?? 0.12} loop /> : null}
    </AbsoluteFill>
  );
};
