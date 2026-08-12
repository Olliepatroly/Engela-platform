/**
 * Shared shape of a submitted report. Kept free of server-only imports so the
 * upload forms (client components) and the server action validate against the
 * same list.
 */

export const REPORT_KINDS = [
  "review",
  "bloods",
  "imaging",
  "dexa",
  "clinic_letter",
  "test",
  "other",
] as const;

export type ReportKind = (typeof REPORT_KINDS)[number];

/** Plain British English labels, in the order the pickers show them. */
export const REPORT_KIND_LABELS: Record<ReportKind, string> = {
  review: "Review report",
  bloods: "Bloods",
  imaging: "Imaging or scan",
  dexa: "DEXA scan",
  clinic_letter: "Clinic letter",
  test: "Other test result",
  other: "Other document",
};

/** The kinds a client is offered for their own uploads. */
export const CLIENT_REPORT_KINDS: ReportKind[] = ["test", "clinic_letter", "other"];

export const REPORT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
] as const;

/** Matches the bucket's file_size_limit in migration 0021. */
export const MAX_REPORT_BYTES = 10 * 1024 * 1024;

export const REPORT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/jpeg,image/png,image/heic";
