import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` throws outside a React Server Component by design.
vi.mock("server-only", () => ({}));

describe("env", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("keeps defaults when a required value is missing at runtime", async () => {
    // As on the Worker: the NEXT_PUBLIC_ Supabase values exist only at build time.
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("RESEND_FROM_EMAIL", "");

    const { env } = await import("./env");
    expect(env.RESEND_FROM_EMAIL).toBe("team@engelahealth.com");
    expect(env.ACCOUNT_REQUEST_APPROVER_EMAIL).toBe("oliver@engelaras.co.uk");
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("https://engelahealth.com");
    expect(env.RESEND_API_KEY).toBe("re_test");
  });

  it("does not log secret values when validation fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not a url");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "super-secret-value");

    const { env } = await import("./env");
    void env.RESEND_FROM_EMAIL;
    const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(logged).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(logged).not.toContain("super-secret-value");
  });
});
