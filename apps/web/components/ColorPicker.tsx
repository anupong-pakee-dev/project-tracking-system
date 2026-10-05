"use client";

import { useState } from "react";
import { PROJECT_COLORS } from "@tracker/shared/types";
import { useT } from "./LangProvider";

// Same saturation/lightness as the gradient in .hue-slider, so the thumb matches the strip.
const SAT = 55;
const LIGHT = 55;

function hslToHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (!d) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round((h * 60 + 360) % 360);
}

/** Preset swatches plus a hue strip for any other colour. Submits as `name`. */
export function ColorPicker({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const t = useT();
  const [color, setColor] = useState(defaultValue ?? PROJECT_COLORS[0]);
  const [hue, setHue] = useState(() => hexToHue(color));
  const isPreset = (PROJECT_COLORS as readonly string[]).includes(color);

  return (
    <fieldset>
      <legend className="label">{t("Color", "สี")}</legend>
      <input type="hidden" name={name} value={color} />
      <div className="flex flex-wrap items-center gap-2">
        {PROJECT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setColor(c);
              setHue(hexToHue(c));
            }}
            aria-pressed={color === c}
            aria-label={c}
            className={`block size-8 rounded-full ring-offset-2 ring-offset-surface ${color === c ? "ring-2 ring-text" : ""}`}
            style={{ background: c }}
          />
        ))}
        {!isPreset && (
          <span
            aria-label={`${t("Custom color", "สีที่เลือกเอง")} ${color}`}
            className="block size-8 rounded-full ring-2 ring-text ring-offset-2 ring-offset-surface"
            style={{ background: color }}
          />
        )}
      </div>
      <div className="mt-3.5">
        <label htmlFor={`${name}-hue`} className="text-xs text-muted">{t("or pick from the hue strip", "หรือเลือกจากแถบสี")}</label>
        <input
          id={`${name}-hue`}
          type="range"
          min={0}
          max={359}
          value={hue}
          onChange={(e) => {
            const h = Number(e.target.value);
            setHue(h);
            setColor(hslToHex(h, SAT, LIGHT));
          }}
          className="hue-slider mt-1.5"
          style={{ "--picked": color } as React.CSSProperties}
        />
      </div>
    </fieldset>
  );
}
