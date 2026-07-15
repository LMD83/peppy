import { Email } from "@convex-dev/auth/providers/Email";
import { Resend as ResendAPI } from "resend";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";
import { VerificationCodeEmail } from "./emails/VerificationCodeEmail";

const OTP_TTL_SECONDS = 60 * 15;

// Sign-up / sign-in email verification, sent via Resend. Used as the
// `verify` option on the Password provider (see auth.ts) — no password
// sign-in succeeds until this code is entered.
export const ResendOTP = Email({
  id: "resend-otp",
  apiKey: process.env.AUTH_RESEND_KEY,
  maxAge: OTP_TTL_SECONDS,
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
        subject: `${token} is your TARA verification code`,
        react: VerificationCodeEmail({ code: token, expiresMinutes: OTP_TTL_SECONDS / 60 }),
      },
      { idempotencyKey: `verify-otp/${email}/${token}` }
    );
    if (error) throw new Error(`Resend failed to send verification email: ${JSON.stringify(error)}`);
  },
});
