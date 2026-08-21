"use client";

import { useRef, useState } from "react";
import {
  MAX_IMPORT_ROWS,
  labsCsv,
  parseConnectCsv,
  readingsCsv,
  sourceForFormat,
  trainingCsv,
  validateMeasurement,
  weighInsCsv,
  type ConnectCsvResult,
  type MeasurementInput,
} from "@convex/tm/logicSync";
import { cn } from "@/lib/utils";
import { useTimento } from "../_lib/backend";
import type { ConnectData, ImportReport } from "../_lib/types";
import { Card, Eyebrow, Stat, TmButton } from "./ui";

type Reading = ConnectData["readings"][number];

/**
 * Connect — every gadget's numbers, one file, one door in.
 *
 * The strategy behind this screen is docs/research/INTEGRATIONS.md in one
 * sentence: for a two-person web app there is no "connect everything" switch —
 * Apple/Samsung/Health Connect have no server API, aggregators cost hundreds a
 * month, Garmin's programme is closed — so the universal connector is the
 * export file every ecosystem can produce, plus one unsanctioned poller for
 * the scale that earns it. Everything lands through the same parser, the same
 * plausibility bounds and the same dedupe plan, whichever door it came in.
 *
 * The honesty rules the rest of the app holds apply here unchanged: nothing
 * on this screen reads a photo or a PDF for values, an implausible number is
 * refused rather than corrected, a refused row is listed rather than dropped,
 * and a sync that is not configured says so instead of showing a switch that
 * lies.
 */

/** A Samsung Health weight export with years of history is still well under this. */
const CSV_MAX_FILE_BYTES = 4 * 1024 * 1024;

const FORMAT_LABELS: Record<NonNullable<ConnectCsvResult["format"]>, string> = {
  renpho: "a Renpho export",
  samsung: "a Samsung Health download",
  generic: "a plain spreadsheet",
};

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

/**
 * Hand a CSV to the person. On iPhone the share sheet is the only reliable
 * route to a saved file — `<a download>` is broken there and can eject a
 * home-screen app entirely (WebKit 167341/216918, see INTEGRATIONS.md) — so
 * the Web Share API goes first and the anchor is the desktop fallback.
 */
async function handOffCsv(filename: string, text: string): Promise<void> {
  const file = new File([text], filename, { type: "text/csv" });
  const nav: Navigator = navigator;
  if ("share" in nav && typeof nav.canShare === "function" && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch {
      // Cancelled or unavailable — fall through to the download.
    }
  }
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function ConnectPanel() {
  const { connect } = useTimento();

  if (!connect) {
    return (
      <div className="flex flex-col gap-3 pt-4" aria-busy="true">
        <p role="status" className="sr-only">
          Loading section…
        </p>
        <div className="h-24 rounded-[10px] border border-tm-rule bg-tm-panel" />
      </div>
    );
  }

  if (connect.survival) {
    return (
      <div className="flex flex-col gap-4 pt-5">
        <h2 className="font-tm-disp text-2xl leading-[1.1] tracking-tight uppercase">Connect</h2>
        <Card tone="amber">
          <Eyebrow color="bg-tm-amber">The floor</Eyebrow>
          <p className="text-[15px]">
            Survival asks for three checks and nothing else. Imports and archives wait here until
            you step off the floor — nothing is lost, and nothing new is asked of you.
          </p>
        </Card>
        <PollerCard connect={connect} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-5">
      <PrintSheet />
      <div className="flex flex-col gap-4 print:hidden">
        <div>
          <h2 className="font-tm-disp text-2xl leading-[1.1] tracking-tight uppercase">Connect</h2>
          <p className="mt-1 text-[15px] text-tm-dim">
            Every gadget&apos;s numbers, one file. A reading is what the machine printed — imported
            as printed, refused when implausible, never guessed at.
          </p>
        </div>
        {connect.latest.length > 0 && <LatestCard connect={connect} />}
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
          <div className="flex flex-col gap-4 lg:col-span-7">
            <ImportCard />
            <InBodyCard />
            <PollerCard connect={connect} />
          </div>
          <div className="flex flex-col gap-4 lg:col-span-5">
            <ReadingsCard readings={connect.readings} sources={connect.sources} />
            <FilesOutCard />
          </div>
        </div>
      </div>
    </div>
  );
}

function LatestCard({ connect }: { connect: ConnectData }) {
  return (
    <Card>
      <Eyebrow color="bg-tm-blue">Latest readings</Eyebrow>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {connect.latest.slice(0, 4).map((l) => (
          <Stat key={l.key} value={`${fmt(l.value)}${l.unit === "level" ? "" : ` ${l.unit}`}`} label={l.label} />
        ))}
      </dl>
    </Card>
  );
}

/* ===== files in ===== */

function ImportCard() {
  const { actions } = useTimento();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ConnectCsvResult | null>(null);
  const [device, setDevice] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const onFile = async (picked: File | null) => {
    setParsed(null);
    setFileName(null);
    setReport(null);
    setSaveError(null);
    if (!picked) return;
    if (picked.size > CSV_MAX_FILE_BYTES) {
      setParsed({
        rows: [],
        format: null,
        errors: ["That file is bigger than a scale export should be — check it's the right one."],
      });
      return;
    }
    setFileName(picked.name);
    setParsed(parseConnectCsv(await picked.text()));
  };

  const save = async () => {
    if (!parsed || parsed.rows.length === 0 || parsed.format === null || busy) return;
    setBusy(true);
    setSaveError(null);
    try {
      const result = await actions.importMeasurements(
        sourceForFormat(parsed.format),
        parsed.rows,
        device.trim() === "" ? undefined : device.trim(),
      );
      if (result === null) {
        setSaveError("The import did not land. Nothing was written — try again.");
      } else {
        setReport(result);
        setParsed(null);
        setFileName(null);
        setDevice("");
        if (inputRef.current) inputRef.current.value = "";
      }
    } finally {
      setBusy(false);
    }
  };

  const shownErrors = parsed ? parsed.errors.slice(0, 6) : [];

  return (
    <Card>
      <Eyebrow color="bg-tm-green">Bring in a file</Eyebrow>
      <p className="text-[14px] text-tm-dim">
        The export every gadget can make. Renpho (app → export data), Samsung Health (settings →
        download personal data — the weight CSV), or any spreadsheet with a date and a weight
        column. Apple Watch and Garmin land the same way, through their export files.
      </p>
      <label className="mt-2 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-tm-rule-strong bg-tm-panel px-3 text-center font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-ink uppercase">
        {fileName ?? "Choose a .csv file"}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
        />
      </label>

      {parsed && (
        <div className="mt-2 flex flex-col gap-2">
          {parsed.format !== null && parsed.rows.length > 0 && (
            <p className="text-[14px]">
              Read {parsed.rows.length} reading{parsed.rows.length === 1 ? "" : "s"} from{" "}
              {FORMAT_LABELS[parsed.format]}
              {parsed.rows[0] ? ` (${parsed.rows[0].date} onward)` : ""}. Saving checks each one
              against the file and writes only what is new.
            </p>
          )}
          {shownErrors.length > 0 && (
            <div>
              <p className="font-tm-mono text-[11.5px] tracking-[0.1em] text-tm-red uppercase">
                {parsed.errors.length} row{parsed.errors.length === 1 ? "" : "s"} refused — listed,
                never silently dropped
              </p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {shownErrors.map((error) => (
                  <li key={error} className="text-[13px] text-tm-dim">
                    {error}
                  </li>
                ))}
              </ul>
              {parsed.errors.length > shownErrors.length && (
                <p className="mt-0.5 text-[13px] text-tm-dim">
                  …and {parsed.errors.length - shownErrors.length} more like these.
                </p>
              )}
            </div>
          )}
          {parsed.rows.length > 0 && (
            <>
              <label htmlFor="connect-device" className="text-[13px] font-medium">
                Which machine (optional)
              </label>
              <input
                id="connect-device"
                value={device}
                onChange={(e) => setDevice(e.target.value)}
                placeholder="e.g. Renpho ES-CS20M"
                className="min-h-11 rounded-[10px] border border-tm-rule-strong bg-tm-panel px-3 font-tm-mono text-sm focus:border-tm-ink"
              />
              <TmButton onClick={() => void save()} disabled={busy} className="w-full">
                {busy ? "Saving…" : "Save to the file"}
              </TmButton>
            </>
          )}
        </div>
      )}

      {saveError && <p className="mt-2 text-[13px] text-tm-red">{saveError}</p>}
      {report && <ReportLine report={report} />}
      <p className="mt-2 font-tm-mono text-[11.5px] text-tm-dim">
        One import takes up to {MAX_IMPORT_ROWS} readings. An ambiguous date or an implausible
        value is refused with the reason — this file does not guess.
      </p>
    </Card>
  );
}

/** The commit's own numbers, repeated exactly — never the preview's promise. */
function ReportLine({ report }: { report: ImportReport }) {
  const extras: string[] = [];
  if (report.duplicates > 0) extras.push(`${report.duplicates} already on file`);
  if (report.conflicts > 0) extras.push(`${report.conflicts} differed and were kept as they were`);
  if (report.filledDays > 0)
    extras.push(`filled ${report.filledDays} day weigh-in${report.filledDays === 1 ? "" : "s"}`);
  return (
    <div className="mt-2" role="status">
      <p className="text-[14px] font-medium">
        Wrote {report.wrote} reading{report.wrote === 1 ? "" : "s"}.
        {extras.length > 0 ? ` ${extras.join(" · ")}.` : ""}
      </p>
      {report.errors.length > 0 && (
        <ul className="mt-1 flex flex-col gap-0.5">
          {report.errors.slice(0, 4).map((error) => (
            <li key={error} className="text-[13px] text-tm-red">
              {error}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The InBody fields, in the order the printed sheet gives them. */
const INBODY_FIELDS = [
  { key: "weightKg", label: "Weight", unit: "kg" },
  { key: "skeletalMuscleKg", label: "Skeletal muscle (SMM)", unit: "kg" },
  { key: "bodyFatMassKg", label: "Body fat mass", unit: "kg" },
  { key: "bodyFatPct", label: "Body fat (PBF)", unit: "%" },
  { key: "visceralFat", label: "Visceral fat level", unit: "" },
  { key: "bmrKcal", label: "BMR", unit: "kcal" },
] as const;

function InBodyCard() {
  const { actions, date } = useTimento();
  const [scanDate, setScanDate] = useState(date);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  const save = async () => {
    if (busy) return;
    setError(null);
    setReport(null);
    const reading: MeasurementInput = { date: scanDate };
    for (const field of INBODY_FIELDS) {
      const raw = (values[field.key] ?? "").trim();
      if (raw === "") continue;
      const value = Number(raw.replace(",", "."));
      if (!Number.isFinite(value)) {
        setError(`${field.label}: "${raw}" is not a number.`);
        return;
      }
      reading[field.key] = value;
    }
    const invalid = validateMeasurement(reading);
    if (invalid.length > 0) {
      setError(invalid[0]);
      return;
    }
    setBusy(true);
    try {
      const result = await actions.importMeasurements("inbody", [reading], "InBody");
      if (result === null) setError("The reading did not land. Nothing was written — try again.");
      else {
        setReport(result);
        setValues({});
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Eyebrow color="bg-tm-blue">InBody sheet</Eyebrow>
      <p className="text-[14px] text-tm-dim">
        Type it straight off the result sheet — the gym&apos;s scanner prints kg and percentages,
        and this keeps them exactly as printed. Leave blank what the sheet doesn&apos;t show.
      </p>
      <div className="mt-2 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="inbody-date" className="text-[14px] font-medium">
            Scan date
          </label>
          <input
            id="inbody-date"
            type="date"
            value={scanDate}
            onChange={(e) => setScanDate(e.target.value)}
            className="min-h-11 rounded-[10px] border border-tm-rule-strong bg-tm-panel px-2 font-tm-mono text-sm focus:border-tm-ink"
          />
        </div>
        {INBODY_FIELDS.map((field) => (
          <div key={field.key} className="flex items-center justify-between gap-2">
            <label htmlFor={`inbody-${field.key}`} className="min-w-0 text-[14px]">
              {field.label}
            </label>
            <div className="flex shrink-0 items-center gap-1.5">
              <input
                id={`inbody-${field.key}`}
                value={values[field.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                inputMode="decimal"
                placeholder="—"
                className="min-h-11 w-20 rounded-[10px] border border-tm-rule-strong bg-tm-panel px-2 py-2 text-right font-tm-mono text-sm focus:border-tm-ink"
              />
              <span className="w-10 font-tm-mono text-[11.5px] text-tm-dim">{field.unit}</span>
            </div>
          </div>
        ))}
        <TmButton onClick={() => void save()} disabled={busy} className="w-full">
          {busy ? "Saving…" : "Save the scan"}
        </TmButton>
        {error && <p className="text-[13px] text-tm-red">{error}</p>}
        {report && <ReportLine report={report} />}
      </div>
    </Card>
  );
}

/* ===== the poller's honesty ===== */

function PollerCard({ connect }: { connect: ConnectData }) {
  const { demo } = useTimento();
  const { configured, lastRun } = connect.poller;
  return (
    <Card>
      <Eyebrow color="bg-tm-dim2">Automatic sync — Renpho</Eyebrow>
      {configured ? (
        lastRun ? (
          <p className="text-[14px]">
            Last run {new Date(lastRun.at).toLocaleString()}:{" "}
            <span className={cn("font-medium", lastRun.ok ? "" : "text-tm-red")}>{lastRun.reason}</span>
            {" — "}
            fetched {lastRun.fetched}, wrote {lastRun.wrote}.
          </p>
        ) : (
          <p className="text-[14px]">
            Configured. No run recorded yet — the first sweep lands on the next schedule tick.
          </p>
        )
      ) : demo ? (
        <p className="text-[14px] text-tm-dim">
          Demo mode has no cloud to poll and no credentials to hold, so there is no sync to show —
          and this card will not pretend otherwise. The file import above is the whole story here.
        </p>
      ) : (
        <p className="text-[14px] text-tm-dim">
          Not configured. Set RENPHO_EMAIL and RENPHO_PASSWORD on the Convex deployment (DEPLOY.md
          has the two commands) and the scale syncs itself twice a day. Until then this screen will
          not pretend it can.
        </p>
      )}
      <p className="mt-2 font-tm-mono text-[11.5px] text-tm-dim">
        Renpho publishes no API, so the sync speaks the app&apos;s own protocol. It can break
        without notice; the CSV import is the same parser and never can.
      </p>
    </Card>
  );
}

/* ===== the archive ===== */

function ReadingsCard({
  readings,
  sources,
}: {
  readings: Reading[];
  sources: ConnectData["sources"];
}) {
  if (readings.length === 0) {
    return (
      <Card>
        <Eyebrow color="bg-tm-blue">Readings</Eyebrow>
        <p className="text-[14px] text-tm-dim">
          Nothing yet. Bring in a file above, or type an InBody sheet — the first reading starts
          the record.
        </p>
      </Card>
    );
  }
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <Eyebrow color="bg-tm-blue" className="mb-0">
          Readings
        </Eyebrow>
        <span className="font-tm-mono text-[11.5px] text-tm-dim">
          {sources.map((s) => `${s.count} ${s.label}`).join(" · ")}
        </span>
      </div>
      <ul className="mt-2 flex flex-col divide-y divide-tm-rule">
        {readings.slice(0, 14).map((r) => (
          <li key={`${r.date}-${r.time ?? ""}-${r.source}`} className="flex items-baseline justify-between gap-2 py-2">
            <span className="font-tm-mono text-[11.5px] text-tm-dim">
              {r.date}
              {r.time ? ` ${r.time}` : ""}
            </span>
            <span className="text-right text-[14px]">
              {r.weightKg !== undefined && <span className="font-medium">{fmt(r.weightKg)} kg</span>}
              {r.bodyFatPct !== undefined && (
                <span className="text-tm-dim"> · {fmt(r.bodyFatPct)}%</span>
              )}
              {r.skeletalMuscleKg !== undefined && (
                <span className="text-tm-dim"> · SMM {fmt(r.skeletalMuscleKg)}</span>
              )}
              <span className="font-tm-mono text-[11.5px] text-tm-dim"> · {r.sourceLabel}</span>
            </span>
          </li>
        ))}
      </ul>
      {readings.length > 14 && (
        <p className="mt-1 font-tm-mono text-[11.5px] text-tm-dim">
          {readings.length - 14} more on the readings CSV below.
        </p>
      )}
    </Card>
  );
}

/* ===== files out ===== */

const EXPORTS = [
  { key: "weigh-ins", label: "Weigh-ins CSV" },
  { key: "training", label: "Training CSV" },
  { key: "bloods", label: "Bloods CSV" },
  { key: "readings", label: "Readings CSV" },
] as const;

type ExportKey = (typeof EXPORTS)[number]["key"];

function FilesOutCard() {
  const { actions, date } = useTimento();
  const [busyKey, setBusyKey] = useState<ExportKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (key: ExportKey) => {
    if (busyKey !== null) return;
    setBusyKey(key);
    setError(null);
    try {
      const bundle = await actions.getExportBundle();
      if (bundle === null) {
        setError("Could not gather the rows. Nothing left the file — try again.");
        return;
      }
      const text =
        key === "weigh-ins"
          ? weighInsCsv(bundle.days)
          : key === "training"
            ? trainingCsv(bundle.sets)
            : key === "bloods"
              ? labsCsv(bundle.labs)
              : readingsCsv(bundle.readings);
      await handOffCsv(`timento-${key}-${date}.csv`, text);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <Card>
      <Eyebrow color="bg-tm-green">Files out</Eyebrow>
      <p className="text-[14px] text-tm-dim">
        Your rows, as CSV — the format every other tool can read. On iPhone this opens the share
        sheet; elsewhere it downloads.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {EXPORTS.map((e) => (
          <TmButton
            key={e.key}
            variant="ghost"
            onClick={() => void run(e.key)}
            disabled={busyKey !== null}
          >
            {busyKey === e.key ? "Gathering…" : e.label}
          </TmButton>
        ))}
      </div>
      {error && <p className="mt-2 text-[13px] text-tm-red">{error}</p>}
      <div className="mt-3 border-t border-tm-rule pt-3">
        <p className="text-[14px] text-tm-dim">
          For a GP visit: one printed page — protocol, current stack, latest bloods, recent
          weights. Paper is its own hand-off.
        </p>
        <TmButton
          variant="ghost"
          className="mt-2 w-full"
          onClick={() => {
            if (typeof window !== "undefined") window.print();
          }}
        >
          Print the GP handover
        </TmButton>
      </div>
    </Card>
  );
}

/**
 * The paper version. Hidden on screen (`display: none`, so never a second live
 * heading) and on paper it is the only thing left — same pattern as the
 * shopping list's print view: 16–24px type, no colour to survive a mono
 * printer. It compiles what the file already shows; it diagnoses nothing, and
 * says so where a GP will read it.
 */
function PrintSheet() {
  const { today, labs, stack, connect, date } = useTimento();
  if (!today) return null;
  const weights = (connect?.readings ?? []).filter((r) => r.weightKg !== undefined).slice(0, 7);
  const bloods = labs ? [...labs.outOfRange, ...labs.latestByMarker.filter((m) => !labs.outOfRange.includes(m))] : [];
  const items = (stack?.items ?? []).filter((i) => i.active);
  return (
    <div className="hidden print:block">
      <h1 className="text-[24px] font-semibold">Health summary — {today.user.name}</h1>
      <p className="text-[16px]">
        {date} · {today.user.protocolTitle} · day {today.dayNumber}
      </p>
      <p className="text-[16px]">
        Weight {fmt(today.user.startKg)} kg → {fmt(today.latestKg)} kg · goal{" "}
        {fmt(today.user.goalKg)} kg
      </p>

      {items.length > 0 && (
        <>
          <h2 className="mt-4 text-[18px] font-semibold">Current stack</h2>
          <ul>
            {items.map((i) => (
              <li key={i.id} className="text-[16px]">
                {i.name} — {fmt(i.dose)} {i.unit} · {i.route} · {i.timings.join(", ")} · evidence:{" "}
                {i.evidence}
              </li>
            ))}
          </ul>
        </>
      )}

      {bloods.length > 0 && (
        <>
          <h2 className="mt-4 text-[18px] font-semibold">Latest bloods (flagged first)</h2>
          <ul>
            {bloods.slice(0, 22).map((m) => (
              <li key={m.marker} className="text-[16px]">
                {m.name}: {m.value} {m.unit}
                {m.refLow !== null && m.refHigh !== null ? ` (ref ${m.refLow}–${m.refHigh})` : ""} —{" "}
                {m.flag} · {m.date}
              </li>
            ))}
          </ul>
        </>
      )}

      {weights.length > 0 && (
        <>
          <h2 className="mt-4 text-[18px] font-semibold">Recent readings</h2>
          <ul>
            {weights.map((r) => (
              <li key={`${r.date}-${r.time ?? ""}`} className="text-[16px]">
                {r.date}: {r.weightKg !== undefined ? `${fmt(r.weightKg)} kg` : ""}
                {r.bodyFatPct !== undefined ? ` · ${fmt(r.bodyFatPct)}% body fat` : ""} (
                {r.sourceLabel})
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-4 text-[16px]">
        Compiled from Timento on {date}. These are tracked and correlated readings from the
        person&apos;s own file — flags mean outside a printed reference interval, and nothing here
        is a diagnosis or a prescription.
      </p>
    </div>
  );
}
