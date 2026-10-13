import "server-only";

/*
 * Shared building blocks for the branded transactional emails (invitations,
 * password resets). Table-based and inline-styled so they render the same in
 * Gmail, Apple Mail and Outlook.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const FONT_DISPLAY = "'Fraunces', Georgia, 'Times New Roman', serif";
export const FONT_BODY = "'Hanken Grotesk', Arial, Helvetica, sans-serif";

/**
 * The Engela Health mark as a bulletproof HTML table (matches
 * src/components/ui/EngelaMark.tsx's four-rectangle glyph). No image request
 * and no SVG, so it renders identically in Gmail, Apple Mail and Outlook
 * without depending on the app being publicly deployed.
 */
export function logoMarkTableHtml(): string {
  const amber = "#FFA630";
  const bg = "#001A38"; // matches the header background so "off" cells disappear
  const cell = (fill: string, width: number, height: number) =>
    `<td width="${width}" height="${height}" style="background-color:${fill}; font-size:0; line-height:0;">&nbsp;</td>`;
  const row = (cells: string, height: number) =>
    `<tr style="height:${height}px;">${cells}</tr>`;

  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:42px; height:28px;">
    ${row(cell(amber, 18, 5) + cell(bg, 9, 5) + cell(amber, 6, 5) + cell(bg, 9, 5), 5)}
    ${row(cell(bg, 18, 6) + cell(bg, 9, 6) + cell(amber, 6, 6) + cell(bg, 9, 6), 6)}
    ${row(cell(amber, 18, 5) + cell(amber, 9, 5) + cell(amber, 6, 5) + cell(amber, 9, 5), 5)}
    ${row(cell(bg, 18, 7) + cell(bg, 9, 7) + cell(amber, 6, 7) + cell(bg, 9, 7), 7)}
    ${row(cell(amber, 18, 5) + cell(bg, 9, 5) + cell(amber, 6, 5) + cell(bg, 9, 5), 5)}
  </table>`;
}
