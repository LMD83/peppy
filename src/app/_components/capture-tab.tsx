"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  captureKindLabel,
  captureLabel,
  noteForChoice,
  type CaptureKind,
  type CaptureView,
  type ConfirmChoice,
} from "@convex/tm/logicCapture";
import { cn } from "@/lib/utils";
import { useTimento } from "../_lib/backend";
import { BigChoice, Card, Eyebrow } from "./ui";

/**
 * Visual check-ins — a photo as evidence, never as an identification.
 *
 * The app never looks at the picture. It takes one, shows it back, and then asks
 * the user to say what it is from a short list built out of their own configured
 * stack and their own meal plan — with a way out when none of them is right.
 * There is no classifier here and there is no scope through which a capture can
 * reach the crew or a carer: the pictures are the most sensitive thing in the
 * file, so they stay in it.
 *
 * Survival mode: available, never prompted. Easy mode: one button, one photo,
 * one confirm, done.
 */

const MAX_FILE_BYTES = 12 * 1024 * 1024;

/* ===== the panel ===== */

export function CapturePanel() {
  // `demo` is fixed for the life of the page (it comes from a build-time env
  // var), so branching on it here picks one component tree and keeps it — the
  // Convex half may call Convex hooks, the demo half never mounts them.
  const { demo } = useTimento();
  return demo ? <DemoCapture /> : <ConvexCapture />;
}

/** Demo backend: the picture never leaves the tab. */
function DemoCapture() {
  const upload = useCallback(async (file: File) => URL.createObjectURL(file), []);
  return <CaptureBody upload={upload} />;
}

/** Convex backend: short-lived upload URL, POST the bytes, keep the id. */
function ConvexCapture() {
  const { session } = useTimento();
  const token = session?.token;
  const generateUploadUrl = useMutation(api.tm.remind.generateUploadUrl);

  const upload = useCallback(
    async (file: File) => {
      if (!token) throw new Error("not-signed-in");
      const url = await generateUploadUrl({ token });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("upload-failed");
      const body: unknown = await res.json();
      const storageId =
        typeof body === "object" && body !== null && "storageId" in body
          ? (body as { storageId: unknown }).storageId
          : null;
      if (typeof storageId !== "string") throw new Error("upload-failed");
      return storageId;
    },
    [generateUploadUrl, token],
  );

  return <CaptureBody upload={upload} />;
}

/* ===== the body ===== */

type Uploader = (file: File) => Promise<string>;

function useCaptureView(): CaptureView | undefined {
  const { remind } = useTimento();
  return remind?.capture;
}

function CaptureBody({ upload }: { upload: Uploader }) {
  const view = useCaptureView();
  const { actions } = useTimento();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [kind, setKind] = useState<CaptureKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The preview URL is ours alone — the stored copy gets its own — so it is
  // safe to release the moment the preview goes away.
  useEffect(() => {
    if (preview === null) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const reset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setKind(null);
    setError(null);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  if (!view) return <CaptureSkeleton />;

  const onPick = (picked: File | null) => {
    setSavedLabel(null);
    setError(null);
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      setError("That file is not a picture. Take a photo, or choose one from your camera roll.");
      return;
    }
    if (picked.size > MAX_FILE_BYTES) {
      setError("That picture is too big to save. Take it again at a smaller size.");
      return;
    }
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
    // Easy mode does not ask what kind of photo it is — there is one kind.
    setKind(view.easy ? (view.kinds[0]?.kind ?? "organiser") : null);
  };

  const save = async (choice: ConfirmChoice) => {
    if (!file || kind === null || busy) return;
    setBusy(true);
    setError(null);
    try {
      const storageId = await upload(file);
      actions.saveCapture(kind, storageId, noteForChoice(choice));
      setSavedLabel(choice.label);
      reset();
    } catch {
      setBusy(false);
      setError("The photo did not save. Nothing was kept — try again.");
    }
  };

  const choices = kind === null ? [] : view.choices[kind];

  return (
    <div
      className={cn(
        "flex flex-col gap-4 pt-5",
        !view.easy && "lg:grid lg:grid-cols-12 lg:items-start lg:gap-6",
      )}
    >
      <div className="flex flex-col gap-3 lg:col-span-7">
      <Card>
        <Eyebrow color="bg-tm-blue">Visual check-in</Eyebrow>
        <p className="text-[14px]">
          Take a photo of the organiser, a plate, or a box, then say what it is yourself. Timento
          never reads the picture.
        </p>

        {/*
          Unconditional, and on this card rather than in the storage note at the
          bottom of the tab: the person who most needs to know a photo has no
          sharing scope is the one who has not taken one yet and is deciding
          whether to. Not reading the picture and not sharing it are two
          different promises — the paragraph above is only the first.
        */}
        <p className="mt-2 text-[14px]">{view.neverShared}</p>

        {view.survival && (
          <p className="mt-2 text-[14px] text-tm-dim">
            The floor does not ask for photos. This is here if you want it.
          </p>
        )}

        {file === null ? (
          <>
            <PickButton
              inputRef={inputRef}
              onPick={onPick}
              disabled={view.atLimit}
              label={savedLabel === null ? "Take a photo" : "Take another photo"}
            />
            {view.atLimit && (
              <p className="mt-2 text-[14px] text-tm-dim">
                That is {view.limitPerDay} photos for today. Enough evidence for one day. Delete one
                below if you need room.
              </p>
            )}
          </>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            {preview !== null && (
              // A local object URL and, later, a signed storage URL — neither is a
              // build-time asset, so next/image has nothing to optimise here.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="The photo you just took, not yet saved."
                className="max-h-64 w-full rounded-[14px] border border-tm-rule object-contain"
              />
            )}

            {kind === null ? (
              <BigChoice
                question="What is this a photo of?"
                options={view.kinds.map((k) => ({
                  id: k.kind,
                  label: k.label,
                  detail: k.detail,
                  onSelect: () => setKind(k.kind),
                }))}
              />
            ) : (
              <ConfirmStep
                kind={kind}
                choices={choices}
                escape={view.escape}
                busy={busy}
                onChoose={(choice) => void save(choice)}
              />
            )}

            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="min-h-11 w-full cursor-pointer rounded-[14px] border border-tm-rule bg-tm-panel px-3 text-[14px] text-tm-dim transition-transform duration-150 active:scale-[0.98] disabled:active:scale-100"
            >
              Throw this photo away
            </button>
          </div>
        )}

        {error !== null && (
          <p role="alert" className="mt-2 text-[14px] text-tm-red">
            {error}
          </p>
        )}
        {savedLabel !== null && file === null && (
          <p role="status" className="mt-2 text-[14px]">
            Saved · {savedLabel.toLowerCase()}.
          </p>
        )}
      </Card>
      </div>

      <div className="flex flex-col gap-3 lg:col-span-5">
      <TodayStrip view={view} onDelete={actions.removeCapture} />

      <EarlierCard view={view} onDelete={actions.removeCapture} />

      <Card>
        <Eyebrow color="bg-tm-dim2">Where these photos live</Eyebrow>
        {/*
          Not `retention.lines`: its sharing line is the same sentence the
          capture card above now carries, and a promise said in two places is
          read in neither. The other three are about storage, which is what this
          card is for.
        */}
        <ul className="flex flex-col gap-2">
          {[view.retention.where, view.retention.deleting, view.retention.care].map((line) => (
            <li key={line} className="text-[14px]">
              {line}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[14px] text-tm-dim">{view.note}</p>
      </Card>
      </div>
    </div>
  );
}

/* ===== the Today card ===== */

/**
 * Nothing at all unless a photo was actually taken today, and nothing ever in
 * the floor. This card never asks for anything.
 */
export function CaptureTodayCard() {
  const view = useCaptureView();
  if (!view || !view.summary.show) return null;

  return (
    <Card>
      <Eyebrow color="bg-tm-blue">Visual check-in</Eyebrow>
      <p className="text-[14px]">{view.summary.line}</p>
      <p className="mt-1 text-[14px] text-tm-dim">{view.summary.detail}</p>
    </Card>
  );
}

/* ===== pieces ===== */

function CaptureSkeleton() {
  return (
    <div className="flex flex-col gap-3 pt-4" aria-busy="true">
      {[0, 1].map((i) => (
        <div key={i} className="h-32 rounded-[14px] border border-tm-rule bg-tm-panel" />
      ))}
      <p className="text-center font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase">
        Loading check-ins…
      </p>
    </div>
  );
}

/**
 * A plain file input with `capture` — it opens the camera on a phone and the
 * picker everywhere else, and it needs no permission dance to do it. The input
 * stays in the accessibility tree (sr-only, not hidden) so it is still the thing
 * that gets focused and announced; the label is only its skin.
 */
function PickButton({
  inputRef,
  onPick,
  disabled,
  label,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (file: File | null) => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <label
      className={cn(
        "mt-3 flex min-h-16 w-full items-center justify-center gap-3 rounded-[14px] border px-4 py-3 text-[17px] font-medium transition-transform duration-150 active:scale-[0.98]",
        "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-tm-ink",
        disabled
          ? "cursor-not-allowed border-tm-rule bg-tm-soft text-tm-dim"
          : "cursor-pointer border-tm-ink bg-tm-ink text-white",
      )}
    >
      <span aria-hidden className="font-tm-mono text-[17px]">
        ▣
      </span>
      <span>{label}</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        disabled={disabled}
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        className="sr-only"
      />
    </label>
  );
}

/** Three answers from your own file, and an honest way out of all three. */
function ConfirmStep({
  kind,
  choices,
  escape,
  busy,
  onChoose,
}: {
  kind: CaptureKind;
  choices: ConfirmChoice[];
  escape: ConfirmChoice;
  busy: boolean;
  onChoose: (choice: ConfirmChoice) => void;
}) {
  const question =
    kind === "meal"
      ? "Which meal is this?"
      : kind === "dose"
        ? "Which dose is this?"
        : "Which part of the organiser is this?";

  return (
    <div className="flex flex-col gap-2">
      <BigChoice
        question={question}
        hint={
          choices.length === 0
            ? "Nothing is scheduled for today, so there is nothing to pick from. Keep the photo anyway."
            : "From what you already have on your own file. Timento is not reading the picture."
        }
        options={choices.map((c) => ({
          id: c.id,
          label: c.label,
          detail: c.detail ?? undefined,
          onSelect: () => onChoose(c),
        }))}
      />
      <button
        type="button"
        onClick={() => onChoose(escape)}
        disabled={busy}
        className="min-h-11 w-full cursor-pointer rounded-[14px] border border-tm-rule-strong bg-tm-panel px-4 py-2 text-left text-[15px] transition-transform duration-150 active:scale-[0.98] disabled:active:scale-100"
      >
        <span className="block font-medium">{escape.label}</span>
        <span className="block text-[14px] text-tm-dim">{escape.detail}</span>
      </button>
      {busy && (
        <p role="status" className="text-[14px] text-tm-dim">
          Saving the photo…
        </p>
      )}
    </div>
  );
}

function TodayStrip({ view, onDelete }: { view: CaptureView; onDelete: (id: string) => void }) {
  if (view.today.length === 0) return null;
  return (
    <Card>
      <div className="flex items-center justify-between">
        <Eyebrow color="bg-tm-green" className="mb-0">
          Today
        </Eyebrow>
        <span className="font-tm-mono text-[11.5px] text-tm-dim">
          {view.today.length} of {view.limitPerDay}
        </span>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {view.today.map((row) => (
          <li key={row.id} className="rounded-[14px] border border-tm-rule p-2">
            {row.url === null ? (
              <div className="flex h-24 items-center justify-center rounded-[14px] bg-tm-soft text-[14px] text-tm-dim">
                Picture gone
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.url}
                alt={captureLabel(row)}
                className="h-24 w-full rounded-[14px] object-cover"
              />
            )}
            <p className="mt-1.5 text-[14px]">{captureLabel(row)}</p>
            <p className="font-tm-mono text-[11.5px] text-tm-dim">{captureKindLabel(row.kind)}</p>
            <button
              type="button"
              onClick={() => onDelete(row.id)}
              className="mt-1.5 min-h-11 w-full cursor-pointer rounded-[14px] border border-tm-red bg-tm-panel px-2 text-[14px] text-tm-red transition-transform duration-150 active:scale-[0.98]"
            >
              Delete this photo
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function EarlierCard({ view, onDelete }: { view: CaptureView; onDelete: (id: string) => void }) {
  const past = view.days.filter((d) => d.date !== view.date);
  // Easy mode keeps one screen's worth: today, and nothing to scroll past.
  if (view.easy || past.length === 0) return null;

  return (
    <Card>
      <Eyebrow color="bg-tm-dim2">Earlier</Eyebrow>
      <ul className="flex flex-col gap-3">
        {past.slice(0, 7).map((day) => (
          <li key={day.date}>
            <p className="font-tm-mono text-[11.5px] tracking-[0.12em] text-tm-dim uppercase">
              {day.date}
            </p>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {day.captures.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-2 rounded-[14px] border border-tm-rule px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px]">{captureLabel(row)}</span>
                    <span className="block font-tm-mono text-[11.5px] text-tm-dim">
                      {captureKindLabel(row.kind)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onDelete(row.id)}
                    className="min-h-11 shrink-0 cursor-pointer rounded-[14px] border border-tm-red bg-tm-panel px-3 text-[14px] text-tm-red transition-transform duration-150 active:scale-[0.98]"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Card>
  );
}
