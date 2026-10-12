import { describe, expect, it } from "vitest";
import { passwordResetRequestSchema, passwordResetSchema } from "./schema";

const token = "a".repeat(56);

describe("passwordResetRequestSchema", () => {
  it("normalises the email", () => {
    const parsed = passwordResetRequestSchema.parse({ email: "  Ollie@Example.COM " });
    expect(parsed.email).toBe("ollie@example.com");
  });

  it("rejects a malformed email", () => {
    expect(passwordResetRequestSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });
});

describe("passwordResetSchema", () => {
  it("accepts a matching password of 10 or more characters", () => {
    const result = passwordResetSchema.safeParse({
      token,
      password: "correct horse",
      confirm: "correct horse",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a short password", () => {
    const result = passwordResetSchema.safeParse({ token, password: "short", confirm: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched passwords", () => {
    const result = passwordResetSchema.safeParse({
      token,
      password: "correct horse",
      confirm: "correct horses",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("The two passwords do not match.");
  });

  it("rejects a token that is not hex", () => {
    const result = passwordResetSchema.safeParse({
      token: "<script>",
      password: "correct horse",
      confirm: "correct horse",
    });
    expect(result.success).toBe(false);
  });
});
