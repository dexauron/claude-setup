// Данные ролика. Их готовит tools/build_reel.py из plan.json — руками не пишутся.

export type Focus = {
  // Точка приближения в долях кадра записи (0..1) и масштаб (1 = весь экран)
  x: number;
  y: number;
  zoom: number;
};

export type Click = {
  // Где и когда (секунды от начала сцены) подсветить клик
  x: number;
  y: number;
  at: number;
};

export type Scene = {
  kind: "hook" | "step" | "cta";
  start: number; // секунды от начала ролика
  duration: number;
  clip?: string; // файл в public-dir: кусок записи, уже подогнанный по длине
  still?: string; // кадр-фон для hook/cta
  step?: string; // «Шаг 1»
  label?: string; // крупная подпись шага
  title?: string; // заголовок hook/cta
  subtitle?: string;
  focus?: Focus;
  click?: Click;
};

export type Word = {
  text: string;
  start: number; // секунды от начала ролика
  end: number;
};

export type ReelProps = {
  fps: number;
  width: number;
  height: number;
  duration: number;
  accent: string;
  kicker: string; // маленькая строка сверху: «ШТРИХ-М 7 · ЛАЙФХАК»
  clipAspect: number; // ширина/высота куска записи
  voice: string; // файл озвучки в public-dir
  music?: string;
  musicVolume?: number;
  scenes: Scene[];
  words: Word[];
};
