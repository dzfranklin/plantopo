import { registerFont } from "canvas";
import fs from "fs/promises";
import { join } from "node:path";

// In prod the bundle is a single file at /app/server.js, so we use an explicit
// path rather than import.meta.dirname (which would resolve to /app).
// Fonts are downloaded by scripts/download-fonts.sh (run via npm prepare).
const FONTS_DIR =
  process.env.FONTS_DIR ?? join(import.meta.dirname, "../../../..", ".fonts");

const FONTS: { name: string; weight: string; style: string }[] = [
  { name: "SourceSans3-ExtraLight", weight: "200", style: "normal" },
  { name: "SourceSans3-ExtraLightItalic", weight: "200", style: "italic" },
  { name: "SourceSans3-Light", weight: "300", style: "normal" },
  { name: "SourceSans3-LightItalic", weight: "300", style: "italic" },
  { name: "SourceSans3-Regular", weight: "400", style: "normal" },
  { name: "SourceSans3-Italic", weight: "400", style: "italic" },
  { name: "SourceSans3-Medium", weight: "500", style: "normal" },
  { name: "SourceSans3-MediumItalic", weight: "500", style: "italic" },
  { name: "SourceSans3-SemiBold", weight: "600", style: "normal" },
  { name: "SourceSans3-SemiBoldItalic", weight: "600", style: "italic" },
  { name: "SourceSans3-Bold", weight: "700", style: "normal" },
  { name: "SourceSans3-BoldItalic", weight: "700", style: "italic" },
  { name: "SourceSans3-ExtraBold", weight: "800", style: "normal" },
  { name: "SourceSans3-ExtraBoldItalic", weight: "800", style: "italic" },
  { name: "SourceSans3-Black", weight: "900", style: "normal" },
  { name: "SourceSans3-BlackItalic", weight: "900", style: "italic" },
];

let status: Promise<void> | true | null = null;

export async function ensureFonts(): Promise<void> {
  if (status === true) return;
  if (status) await status;
  else {
    status = registerFonts().then(() => {
      status = true;
    });
    await status;
  }
}

async function registerFonts(): Promise<void> {
  for (const { name, weight, style } of FONTS) {
    const fontPath = join(FONTS_DIR, `${name}.ttf`);

    // Ensure this fails if the file is missing
    try {
      await fs.access(fontPath);
    } catch (err) {
      throw new Error(`Please run "npm run download-fonts"`, { cause: err });
    }

    registerFont(fontPath, {
      family: "Source Sans 3",
      weight,
      style,
    });
  }
}
