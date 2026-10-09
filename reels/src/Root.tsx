import { Composition } from "remotion";
import { BrandShowcase, type BrandShowcaseProps } from "./BrandShowcase";
import { ProductCard, type ProductCardProps } from "./ProductCard";
import { ScreenTutorial } from "./ScreenTutorial";
import type { ReelProps } from "./types";

// Пустые значения для Studio; при рендере всё приходит через --props=reel.json
const defaults: ReelProps = {
  fps: 30,
  width: 1080,
  height: 1920,
  duration: 3,
  accent: "#FFC400",
  kicker: "Лайфхак",
  clipAspect: 0.87,
  voice: "voice.wav",
  scenes: [],
  words: [],
};

const cardDefaults: ProductCardProps = {
  items: [],
  seconds: 2.6,
  accent: "#8FCB8A",
};

const showcaseDefaults: BrandShowcaseProps = {
  items: [],
  seconds: 2.6,
  intro: 1.6,
  outro: 2.4,
  logo: "logo.png",
  green: "#517D51",
  dark: "#2A322B",
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="BrandShowcase"
      component={BrandShowcase}
      defaultProps={showcaseDefaults}
      fps={30}
      width={1080}
      height={1920}
      durationInFrames={90}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.round(
          (props.intro + props.items.length * props.seconds + props.outro) * 30,
        ),
      })}
    />
    <Composition
      id="ProductCard"
      component={ProductCard}
      defaultProps={cardDefaults}
      fps={30}
      width={1080}
      height={1920}
      durationInFrames={90}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(
          1,
          Math.round(props.items.length * props.seconds * 30),
        ),
      })}
    />
    <Composition
      id="ScreenTutorial"
      component={ScreenTutorial}
      defaultProps={defaults}
      fps={30}
      width={1080}
      height={1920}
      durationInFrames={90}
      calculateMetadata={({ props }) => ({
        fps: props.fps,
        width: props.width,
        height: props.height,
        durationInFrames: Math.ceil(props.duration * props.fps),
      })}
    />
  </>
);
