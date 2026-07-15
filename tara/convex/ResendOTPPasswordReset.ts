import { Email } from "@convex-dev/auth/providers/Email";
import { Resend as ResendAPI } from "resend";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";
import { VerificationCodeEmail } from "./emails/VerificationCodeEmail";

const RESET_TTL_SECONDS = 60 * 15;

// Password-reset verification code, sent via Resend. Used as the `reset`
// option on the Password provider (see auth.ts).
export const ResendOTPPasswordReset = Email({
  id: "resend-otp-password-reset",
  apiKey: process.env.AUTH_RESEND_KEY,
  maxAge: RESET_TTL_SECONDS,
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes) {
        crypto.getRandomValues(bytes);
      },
    };
    return generateRandomString(random, "0123456789", 6);
  },
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const resend = new ResendAPI(provider.apiKey);
    const { error } = await resend.emails.send(
      {
        from: process.env.AUTH_EMAIL_FROM ?? "TARA Peptides <onboarding@resend.dev>",
        to: [email],
        subject: `${token} is your TARA password reset code`,
        react: VerificationCodeEmail({
          code: token,
          expiresMinutes: RESET_TTL_SECONDS / 60,
          heading: "Reset your TARA password",
        }),
      },
      { idempotencyKey: `reset-otp/${email}/${token}` }
    );
    if (error) throw new Error(`Resend failed to send password-reset email: ${JSON.stringify(error)}`);
  },
});
