/**
 * Anatomical body-map geometry vendored from react-muscle-highlighter
 * (https://github.com/soroojshehryar/react-muscle-highlighter), MIT licence.
 * See LICENSE-react-muscle-highlighter in this folder. The vendored data has
 * had its hard-coded fill colours removed; colour is applied from design
 * tokens by the BodyMap / BodyMapRate components instead.
 */

/** A region's SVG path fragments, split so bilateral muscles can be addressed
 * per side. `common` is a centre or non-paired shape. */
export interface RegionPaths {
  common?: string[];
  left?: string[];
  right?: string[];
}

/** One drawn region on the figure, keyed by the library's slug. */
export interface BodyRegion {
  slug: string;
  path: RegionPaths;
}
