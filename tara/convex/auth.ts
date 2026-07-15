import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ResendOTP } from "./ResendOTP";
import { ResendOTPPasswordReset } from "./ResendOTPPasswordReset";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    // Google OAuth removed — email + password (with OTP verification) only.
    Password({
      // Untrusted-vs-trusted account linking (see convex/auth.md): requiring
      // `verify` here means a password sign-up only auto-links to an
      // existing Google account on the same email once the email is
      // confirmed via the OTP below — never before.
      verify: ResendOTP,
      reset: ResendOTPPasswordReset,
    }),
  ],
});
