"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTimento } from "../_lib/backend";

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
    <div className="flex min-h-screen flex-col">
      <div className="bg-tm-ink px-4 pt-10 pb-8">
        <div className="mx-auto max-w-md">
          <div className="font-tm-mono text-[10px] tracking-[0.2em] text-tm-dim2 uppercase">Performance file</div>
          <h1 className="mt-2 font-tm-disp text-3xl text-white">Timento</h1>
          <p className="mt-2 max-w-[34ch] text-[13px] text-[#c9cdd4]">
            Two people, one file. Checks, modes, experiments — evidence over vibes.
          </p>
        </div>
      </div>
      <form onSubmit={submit} className="mx-auto w-full max-w-md flex-1 px-4 pt-6">
        <fieldset>
          <legend className="mb-2 font-tm-mono text-[10.5px] tracking-[0.15em] text-tm-dim uppercase">Who&apos;s checking in</legend>
          <div className="flex gap-2">
            {USERS.map((u) => (
              <button
                key={u.slug}
                type="button"
                onClick={() => setSlug(u.slug)}
                aria-pressed={slug === u.slug}
                className={cn(
                  "flex-1 cursor-pointer rounded-[10px] border px-4 py-3 text-left text-sm font-medium",
                  slug === u.slug ? "border-tm-ink bg-tm-ink text-white" : "border-tm-rule bg-tm-panel text-tm-ink",
                )}
              >
                {u.name}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="mt-4 block">
          <span className="mb-2 block font-tm-mono text-[10.5px] tracking-[0.15em] text-tm-dim uppercase">Passcode</span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            className="w-full rounded-[10px] border border-tm-rule bg-tm-panel px-4 py-3 font-tm-mono text-base tracking-[0.3em] outline-none focus:border-tm-ink"
            placeholder="••••"
          />
        </label>
        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-tm-red bg-[#faeceb] px-3 py-2 text-[12.5px] text-tm-red">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || passcode.length === 0}
          className="mt-4 w-full cursor-pointer rounded-[10px] bg-tm-ink py-3.5 font-tm-mono text-[11px] tracking-[0.15em] text-white uppercase disabled:opacity-40"
        >
          {busy ? "Checking…" : "Open the file"}
        </button>
        {demo && (
          <p className="mt-4 rounded-lg bg-tm-soft px-3 py-2 font-tm-mono text-[10px] text-tm-dim">
            Demo mode — no deployment configured. Passcodes: Liam 2580 · Conor 1379.
          </p>
        )}
        <p className="mt-6 pb-8 text-center">
          <Link href="/timento/why" className="font-tm-mono text-[10px] tracking-[0.12em] text-tm-dim underline uppercase">
            Why this design
          </Link>
        </p>
      </form>
    </div>
  );
}
