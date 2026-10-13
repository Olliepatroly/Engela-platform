import { z } from "zod";

/**
 * One shared schema for the sign-in form: the client uses it for inline
 * validation, the server action re-validates with the same rules. The server
 * is authoritative.
 */
export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export type SignInInput = z.infer<typeof signInSchema>;

/** "Forgotten your password?" request: just the account email. */
export const passwordResetRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

/**
 * Choosing a new password from the emailed link. The token is the hashed
 * recovery token Supabase issued; the length rule matches invite acceptance.
 */
export const passwordResetSchema = z
  .object({
    token: z.string().regex(/^[0-9a-f]{20,128}$/i, "This reset link is not valid."),
    password: z.string().min(10, "Use at least 10 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "The two passwords do not match.",
    path: ["confirm"],
  });
