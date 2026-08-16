import {
  MAX_CAPTURES_PER_DAY,
  buildCaptureView,
  canSaveCapture,
  doseChoices,
  isCaptureKind,
  mealChoices,
  normaliseCaptureNote,
  type CaptureKind,
  type CaptureRow,
  type CaptureView,
  type CaptureViewInput,
} from "@convex/tm/logicCapture";
import type { StackItem } from "@convex/tm/logicStack";
import { foodByKey } from "@convex/tm/data/foods";
import type { DemoDb } from "../demo-db";

/**
 * Demo mirror of the capture half of convex/tm/remind.ts. Same gather, same
 * shared logic, same shape — the view is built by buildCaptureView in both
 * backends, so the two can only ever disagree by failing to compile.
 *
 * The demo has no file storage. A capture's `storageId` is whatever the tab
 * handed over, which in demo mode is an object URL for the file the user just
 * picked: the picture never leaves the tab.
 */

/** Only something that can actually be rendered becomes a url. */
function urlFor(storageId: string): string | null {
  return storageId.startsWith("blob:") || storageId.startsWith("data:") ? storageId : null;
}

function gather(db: DemoDb, slug: string, date: string): CaptureViewInput {
  const user = db.users.find((u) => u.slug === slug);
  if (!user) throw new Error("Unknown user");

  const items: StackItem[] = db.protocolItems
    .filter((r) => r.userSlug === slug)
    .map(({ userSlug: _slug, ...row }) => row);

  const captures: CaptureRow[] = db.captures
    .filter((r) => r.userSlug === slug)
    .map((r) => ({
      id: r.id,
      date: r.date,
      kind: r.kind,
      url: urlFor(r.storageId),
      note: r.note ?? null,
      at: r.at,
    }));

  const foods = mealChoices(
    db.mealEntries
      .filter((r) => r.userSlug === slug && r.date === date)
      .map((r) => ({
        id: r.id,
        name: foodByKey(r.foodKey)?.name ?? r.foodKey,
        slot: r.slot,
      })),
  );

  return {
    mode: user.modeMut,
    date,
    captures,
    items: doseChoices(items, date),
    foods,
    a11y: user.a11yProfileMut ?? "standard",
  };
}

export function view(db: DemoDb, slug: string, date: string): CaptureView {
  return buildCaptureView(gather(db, slug, date));
}

/**
 * A photo plus the label the user picked. Nothing is derived from the image —
 * `note` arrives already chosen from the user's own list, or absent.
 */
export function saveCapture(
  db: DemoDb,
  slug: string,
  date: string,
  kind: CaptureKind,
  storageId: string,
  note?: string,
): void {
  if (!isCaptureKind(kind)) throw new Error("bad-kind");
  const trimmedId = storageId.trim();
  if (trimmedId === "") throw new Error("bad-storage-id");

  const countToday = db.captures.filter((r) => r.userSlug === slug && r.date === date).length;
  if (!canSaveCapture(countToday, MAX_CAPTURES_PER_DAY)) throw new Error("capture-limit");

  db.captures.push({
    id: db.newId("cap"),
    userSlug: slug,
    date,
    kind,
    storageId: trimmedId,
    note: normaliseCaptureNote(note),
    at: Date.now(),
  });
}

/** One tap, immediate, no bin. The row and the picture go together. */
export function removeCapture(db: DemoDb, captureId: string): void {
  const i = db.captures.findIndex((r) => r.id === captureId);
  if (i === -1) throw new Error("not-your-capture");
  const [row] = db.captures.splice(i, 1);
  if (row.storageId.startsWith("blob:") && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(row.storageId);
  }
}
