// Montserrat из npm-пакета @fontsource/montserrat (OFL-1.1): файлы попадают в
// сборку, поэтому рендер не ходит в сеть за шрифтами.
import { loadFont } from "@remotion/fonts";
import cyr600 from "@fontsource/montserrat/files/montserrat-cyrillic-600-normal.woff2";
import cyr800 from "@fontsource/montserrat/files/montserrat-cyrillic-800-normal.woff2";
import cyr900 from "@fontsource/montserrat/files/montserrat-cyrillic-900-normal.woff2";
import lat600 from "@fontsource/montserrat/files/montserrat-latin-600-normal.woff2";
import lat800 from "@fontsource/montserrat/files/montserrat-latin-800-normal.woff2";
import lat900 from "@fontsource/montserrat/files/montserrat-latin-900-normal.woff2";

export const fontFamily = "Montserrat";

const CYRILLIC = "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116";
const LATIN =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";

const files: [string, string, string][] = [
  [cyr600, "600", CYRILLIC],
  [cyr800, "800", CYRILLIC],
  [cyr900, "900", CYRILLIC],
  [lat600, "600", LATIN],
  [lat800, "800", LATIN],
  [lat900, "900", LATIN],
];

for (const [url, weight, unicodeRange] of files) {
  loadFont({ family: fontFamily, url, weight, unicodeRange, format: "woff2" });
}
