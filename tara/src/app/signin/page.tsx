"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Step = "signIn" | "signUp" | { email: string };

export default function SignInPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [step, setStep] = useState<Step>("signIn");
  const [submitting, setSubmitting] = useState(false);

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const formData = new FormData(event.currentTarget);
    try {
      await signIn("password", formData);
      const email = formData.get("email") as string;
      setStep({ email });
      toast.success("Check your email for a verification code");
    } catch {
      toast.error(
        step === "signUp"
          ? "Couldn't create that account — the email may already be in use."
          : "Incorrect email or password."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCodeSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const formData = new FormData(event.currentTarget);
    try {
      await signIn("password", formData);
      router.push("/account");
    } catch {
      toast.error("That code didn't match — check your email and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16">
      <div>
        <h1 className="font-serif text-2xl font-semibold">
          {typeof step === "object" ? "Enter your code" : "Sign in to TARA"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {typeof step === "object"
            ? `We sent a 6-digit code to ${step.email}.`
            : "Track orders, verify batches, and manage your research schedule."}
        </p>
      </div>

      {typeof step !== "object" && (
        <>
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
            <Input name="email" type="email" placeholder="Email" required autoComplete="email" />
            <Input
              name="password"
              type="password"
              placeholder="Password"
              required
              minLength={8}
              autoComplete={step === "signUp" ? "new-password" : "current-password"}
            />
            <input type="hidden" name="flow" value={step} />
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? "Please wait…" : step === "signIn" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setStep(step === "signIn" ? "signUp" : "signIn")}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {step === "signIn" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </>
      )}

      {typeof step === "object" && (
        <form onSubmit={handleCodeSubmit} className="flex flex-col gap-3">
          <Input name="code" placeholder="6-digit code" required autoComplete="one-time-code" />
          <input type="hidden" name="email" value={step.email} />
          <input type="hidden" name="flow" value="email-verification" />
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? "Verifying…" : "Continue"}
          </Button>
          <button
            type="button"
            onClick={() => setStep("signIn")}
            className="text-sm text-muted-foreground hover:underline"
          >
            Back
          </button>
        </form>
      )}

      <p className="text-xs text-muted-foreground">
        For laboratory research use only. Not for human or veterinary use.
      </p>
    </div>
  );
}
