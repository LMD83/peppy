"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTimento } from "../_lib/backend";
import { TmButton } from "./ui";

const USERS = [
  { slug: "liam", name: "Liam" },
  { slug: "conor", name: "Conor" },
];

export function Login() {
  const { actions, demo } = useTimento();
  const [slug, setSlug] = useState("liam");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await actions.login(slug, passcode);
    setBusy(false);
    if (!res.ok) setError(res.error ?? "Sign-in error");
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-tm-paper">
      <div className="relative overflow-hidden bg-tm-ink">
        <Image
          src="/why/kitchen-close.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-tm-ink via-tm-ink/75 to-tm-ink/45" />
        <div className="relative mx-auto max-w-md px-4 pt-14 pb-10">
          <p className="font-tm-mono text-[10px] tracking-[0.2em] text-tm-dim2 uppercase">
            Performance file
          </p>
          <h1 className="mt-3 font-tm-disp text-4xl leading-none tracking-tight text-white uppercase md:text-5xl">
            Timento
          </h1>
          <p className="mt-3 max-w-[34ch] text-[15px] leading-relaxed text-[#c9cdd4]">
            Two people, one file. Checks, modes, experiments. Evidence over vibes.
          </p>
        </div>
      </div>
      <form onSubmit={submit} className="mx-auto w-full max-w-md flex-1 px-4 pt-8">
        <fieldset>
          <legend className="mb-2.5 font-tm-mono text-[10.5px] tracking-[0.15em] text-tm-dim uppercase">
            Who&apos;s checking in
          </legend>
          <div className="flex gap-2">
            {USERS.map((u) => (
              <button
                key={u.slug}
                type="button"
                onClick={() => setSlug(u.slug)}
                aria-pressed={slug === u.slug}
                className={cn(
                  "flex min-h-11 flex-1 cursor-pointer items-center rounded-[10px] border px-4 py-3 text-left text-sm font-medium transition-[transform,opacity] duration-150 active:scale-[0.98] active:opacity-80",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tm-ink/25 focus-visible:ring-offset-2 focus-visible:ring-offset-tm-paper",
                  slug === u.slug ? "border-tm-ink bg-tm-ink text-white" : "border-tm-rule bg-tm-panel text-tm-ink",
                )}
              >
                {u.name}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="mt-5 block">
          <span className="mb-2.5 block font-tm-mono text-[10.5px] tracking-[0.15em] text-tm-dim uppercase">
            Passcode
          </span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            className="min-h-12 w-full rounded-[10px] border border-tm-rule bg-tm-panel px-4 py-3 font-tm-mono text-base tracking-[0.3em] text-tm-ink outline-none focus:border-tm-ink focus-visible:ring-2 focus-visible:ring-tm-ink/25"
            placeholder="••••"
          />
        </label>
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-[10px] border border-tm-red bg-[#faeceb] px-3 py-2.5 text-[13px] font-medium text-tm-red"
          >
            {error}
          </p>
        )}
        <TmButton type="submit" disabled={busy || passcode.length === 0} className="mt-5 w-full py-3.5 text-[12px]">
          {busy ? "Checking…" : "Open the file"}
        </TmButton>
        {demo && (
          <p className="mt-4 rounded-[10px] bg-tm-soft px-3 py-2.5 font-tm-mono text-[10px] leading-relaxed text-tm-dim">
            Demo mode. No deployment configured. Passcodes: Liam 2580 · Conor 1379.
          </p>
        )}
        <p className="mt-8 pb-10 text-center">
          <Link
            href="/why"
            className="font-tm-mono text-[10px] tracking-[0.12em] text-tm-dim uppercase underline decoration-tm-rule underline-offset-4"
          >
            Why this design
          </Link>
        </p>
      </form>
    </div>
  );
}
