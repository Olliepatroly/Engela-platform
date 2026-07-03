/**
 * The Engela Health mark (from engela_health_icon.svg), inlined so it takes
 * `currentColor` and can sit in the navy sidebar, the cream client header and
 * the sign-in card without separate assets. The viewBox is trimmed to the
 * glyph's bounds; size it with the `size` prop (height in rem).
 */
export function EngelaMark({ size = 1.25, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="70 152 480 317"
      style={{ height: `${size}rem`, width: "auto" }}
      className={className}
      fill="currentColor"
      role="img"
      aria-label="Engela Health"
      focusable="false"
    >
      <rect x="70" y="152" width="205" height="58" />
      <rect x="70" y="277" width="480" height="58" />
      <rect x="70" y="411" width="210" height="58" />
      <rect x="379" y="152" width="70" height="317" />
    </svg>
  );
}
