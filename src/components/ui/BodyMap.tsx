import styles from "./body-map.module.css";
import {
  MUSCLE_LABELS,
  type Figure,
  type MuscleGroup,
  type View,
  getOutline,
  getRegions,
  musclesForSlug,
  regionPaths,
} from "./bodyMapGeometry";

export { MUSCLE_LABELS };
export type { MuscleGroup };

function FigureView({
  view,
  figure,
  primary,
  secondary,
}: {
  view: View;
  figure: Figure;
  primary: Set<MuscleGroup>;
  secondary: Set<MuscleGroup>;
}) {
  const regions = getRegions(figure, view);
  const outline = getOutline(figure, view);

  return (
    <figure className={styles.figure}>
      <svg viewBox={outline.viewBox} role="img" aria-label={`${view} view of the body`}>
        <path className={styles.body} d={outline.d} />
        {regions.map((region) => {
          const muscles = musclesForSlug(region.slug);
          const kind = muscles.some((m) => primary.has(m))
            ? "primary"
            : muscles.some((m) => secondary.has(m))
              ? "secondary"
              : null;
          const cls = `${styles.muscle} ${kind === "primary" ? styles.primary : ""} ${
            kind === "secondary" ? styles.secondary : ""
          }`;
          const label = muscles.length ? MUSCLE_LABELS[muscles[0]!] : region.slug;
          return (
            <g key={region.slug} className={cls}>
              {kind ? <title>{label}</title> : null}
              {regionPaths(region).map((d, i) => (
                <path key={i} d={d} />
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption className={styles.viewLabel}>{view === "front" ? "Front" : "Back"}</figcaption>
    </figure>
  );
}

/**
 * Muscles-worked body map (front and back views, male or female figure).
 * Every compartment is drawn as anatomical line art; the ones this session
 * works are filled (amber = worked directly, slate = also involved). Status
 * rule applies here too: the legend always names the groups in text.
 */
export function BodyMap({
  primary,
  secondary = [],
  figure = "male",
}: {
  primary: MuscleGroup[];
  secondary?: MuscleGroup[];
  figure?: Figure;
}) {
  const primarySet = new Set(primary);
  // A muscle that is primary anywhere in the session shows as primary.
  const secondarySet = new Set(secondary.filter((m) => !primarySet.has(m)));
  const names = (set: Set<MuscleGroup>) =>
    Array.from(set)
      .map((m) => MUSCLE_LABELS[m])
      .join(", ");

  return (
    <div className={styles.wrap}>
      <div className={styles.figures}>
        <FigureView view="front" figure={figure} primary={primarySet} secondary={secondarySet} />
        <FigureView view="back" figure={figure} primary={primarySet} secondary={secondarySet} />
      </div>
      <dl className={styles.legend}>
        {primarySet.size > 0 ? (
          <div className={styles.legendRow}>
            <dt className={styles.legendTerm}>
              <span className={`${styles.legendDot} ${styles.legendDotPrimary}`} aria-hidden="true" />
              Worked directly
            </dt>
            <dd className={styles.legendNames}>{names(primarySet)}</dd>
          </div>
        ) : null}
        {secondarySet.size > 0 ? (
          <div className={styles.legendRow}>
            <dt className={styles.legendTerm}>
              <span
                className={`${styles.legendDot} ${styles.legendDotSecondary}`}
                aria-hidden="true"
              />
              Also involved
            </dt>
            <dd className={styles.legendNames}>{names(secondarySet)}</dd>
          </div>
        ) : null}
        {primarySet.size === 0 && secondarySet.size === 0 ? (
          <p className={styles.legendEmpty}>No muscle groups highlighted.</p>
        ) : null}
      </dl>
    </div>
  );
}
