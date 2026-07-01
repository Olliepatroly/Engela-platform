/**
 * Roles and routing. The role travels as a claim on the Supabase access token
 * (set by an access-token hook) so middleware and RLS can read it without an
 * extra query. Keep this module free of server-only imports so both middleware
 * and client code can use the types + helpers.
 */

export type Role = "consultant" | "nurse" | "cep" | "client" | "admin";

// The clinical team: consultant, specialist nurse, clinical exercise physiologist, admin.
export const CLINICAL_ROLES: readonly Role[] = ["consultant", "nurse", "cep", "admin"] as const;

export function isRole(value: unknown): value is Role {
  return (
    value === "consultant" ||
    value === "nurse" ||
    value === "cep" ||
    value === "client" ||
    value === "admin"
  );
}

export function isClinical(role: Role | null | undefined): boolean {
  return role != null && CLINICAL_ROLES.includes(role);
}

/** Where a signed-in user with this role belongs. */
export function homePathForRole(role: Role | null | undefined): string {
  if (isClinical(role)) return "/console";
  if (role === "client") return "/app";
  return "/signin";
}
