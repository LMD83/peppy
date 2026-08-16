"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTimento } from "../_lib/backend";

const USERS = [
  { slug: "liam", name: "Liam" },
  { slug: "artur", name: "Artur" },
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
    <div className="grid min-h-[100dvh] bg-tm-paper lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-tm-ink lg:block">
        <Image
          src="/why/kitchen-close.png"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-tm-ink via-tm-ink/50 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-10">
          <p className="font-tm-mono text-[11.5px] tracking-[0.2em] text-tm-onink uppercase">
            Performance file
          </p>
          <p className="mt-3 max-w-[22ch] font-tm-disp text-4xl leading-[1.05] tracking-tight text-white uppercase">
            The kitchen closes. The loop continues.
          </p>
        </div>
      </div>

      <div className="flex flex-col">
        <div className="bg-tm-ink px-4 pt-12 pb-8 lg:bg-transparent lg:px-10 lg:pt-16 lg:pb-0">
          <div className="mx-auto w-full max-w-md lg:mx-0">
            <p className="font-tm-mono text-[11.5px] tracking-[0.2em] text-tm-onink uppercase lg:hidden">
              Performance file
            </p>
            <h1 className="mt-3 font-tm-disp text-4xl leading-none tracking-tight text-white uppercase lg:text-5xl lg:text-tm-ink">
              Timento
            </h1>
            <p className="mt-3 max-w-[34ch] text-[15px] leading-relaxed text-tm-onink lg:text-tm-ink2">
              Two people, one file. Checks, modes, experiments. Evidence over vibes.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="mx-auto w-full max-w-md flex-1 px-4 pt-7 lg:mx-0 lg:px-10 lg:pt-10">
          <fieldset>
            <legend className="mb-2.5 font-tm-mono text-[11.5px] tracking-[0.15em] text-tm-dim uppercase">
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
                    "min-h-12 flex-1 cursor-pointer rounded-[10px] border px-4 py-3 text-left text-[15px] font-medium transition-[transform,opacity] duration-150 active:scale-[0.98]",
                    slug === u.slug
                      ? "border-tm-ink bg-tm-ink text-white"
                      : "border-tm-rule-strong bg-tm-panel text-tm-ink",
                  )}
                >
                  {u.name}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="mt-5 block">
            <span className="mb-2.5 block font-tm-mono text-[11.5px] tracking-[0.15em] text-tm-dim uppercase">
              Passcode
            </span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="min-h-12 w-full rounded-[10px] border border-tm-rule-strong bg-tm-panel px-4 py-3 font-tm-mono text-base tracking-[0.3em] text-tm-ink outline-none focus:border-tm-ink"
              placeholder="••••"
            />
          </label>
          {error && (
            <p role="alert" className="mt-3 rounded-[10px] border border-tm-red bg-tm-red-bg px-3 py-2.5 text-[14px] text-tm-red">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || passcode.length === 0}
            className="mt-5 min-h-12 w-full cursor-pointer rounded-[10px] bg-tm-ink py-3.5 font-tm-mono text-[12.5px] tracking-[0.15em] text-white uppercase transition-transform duration-150 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
          >
            {busy ? "Checking…" : "Open the file"}
          </button>
          {demo && (
            <p className="mt-4 rounded-[10px] bg-tm-soft px-3 py-2.5 font-tm-mono text-[11.5px] leading-relaxed text-tm-dim">
              Demo mode. No deployment configured. Passcodes: Liam 2580 · Artur 1379.
            </p>
          )}
          <p className="mt-8 pb-10">
            <Link
              href="/why"
              className="inline-flex min-h-11 items-center font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase underline decoration-tm-rule underline-offset-4"
            >
              Why this design
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
