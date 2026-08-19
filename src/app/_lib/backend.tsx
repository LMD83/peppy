"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { ConvexProvider, ConvexReactClient, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { DemoDb } from "./demo-db";
import { fetchDeliverCapability } from "./deliver-client";
import { SWEEP_MINUTES } from "@convex/tm/logicPush";
import {
  localToday,
  type CravingEntry,
  type TimentoActions,
  type TimentoState,
  type TmSession,
} from "./types";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const SESSION_KEY = "timento.session";

/**
 * A deployment env var is the one input we cannot test before it reaches
 * production. `new ConvexReactClient(bad)` throws inside render, and a throw in
 * render is a 500 on the very first paint — the whole app, not one card. A
 * malformed backend URL must degrade to the demo backend instead: the file
 * still opens, and the misconfiguration is visible rather than fatal.
 */
function usableConvexUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const CONVEX_ENDPOINT = usableConvexUrl(CONVEX_URL);
const DEMO = process.env.NEXT_PUBLIC_TIMENTO_DEMO === "1" || !CONVEX_ENDPOINT;

const TimentoContext = createContext<TimentoState | null>(null);

export function useTimento(): TimentoState {
  const ctx = useContext(TimentoContext);
  if (!ctx) throw new Error("useTimento outside TimentoProvider");
  return ctx;
}

/* Session is external state (localStorage) — bind it with useSyncExternalStore. */
const sessionListeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedSession: TmSession | null = null;

function readSession(): TmSession | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(SESSION_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedSession = raw ? (JSON.parse(raw) as TmSession) : null;
    } catch {
      cachedSession = null;
    }
  }
  return cachedSession;
}

function subscribeSession(cb: () => void) {
  sessionListeners.add(cb);
  return () => sessionListeners.delete(cb);
}

/** Drop the stored session (e.g. after the server rejects a stale token). */
export function clearStoredSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // storage unavailable — the in-memory cache below still clears
  }
  cachedRaw = null;
  cachedSession = null;
  sessionListeners.forEach((fn) => fn());
}

/* The local calendar date is external, ticking state — never freeze it at mount,
   or a tab left open past midnight writes every log to yesterday. */
function subscribeLocalDate(cb: () => void) {
  const t = setInterval(cb, 30_000);
  window.addEventListener("visibilitychange", cb);
  window.addEventListener("focus", cb);
  return () => {
    clearInterval(t);
    window.removeEventListener("visibilitychange", cb);
    window.removeEventListener("focus", cb);
  };
}

function useLocalDate(): string {
  return useSyncExternalStore(subscribeLocalDate, localToday, localToday);
}

function useStoredSession() {
  const session = useSyncExternalStore(subscribeSession, readSession, () => null);
  // false during SSR/hydration, true once the client store is authoritative.
  const authReady = useSyncExternalStore(
    subscribeSession,
    () => true,
    () => false,
  );
  const store = useCallback((s: TmSession | null) => {
    try {
      if (s) window.localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else window.localStorage.removeItem(SESSION_KEY);
    } catch {
      // storage unavailable — fall back to the in-memory cache below
    }
    cachedRaw = s ? JSON.stringify(s) : null;
    cachedSession = s;
    sessionListeners.forEach((fn) => fn());
  }, []);
  return { session, authReady, store };
}

/* ===== Demo backend — in-memory DemoDb, same fixtures + logic as Convex ===== */

let demoDb: DemoDb | null = null;
function getDemoDb(): DemoDb {
  if (!demoDb) demoDb = new DemoDb(localToday());
  return demoDb;
}

function DemoBackend({ children }: { children: React.ReactNode }) {
  const db = getDemoDb();
  const { session, authReady, store } = useStoredSession();
  const date = useLocalDate();
  useSyncExternalStore(
    db.subscribe,
    () => db.version,
    () => 0,
  );

  const slug = session?.slug ?? null;

  useEffect(() => {
    let cancelled = false;
    void fetchDeliverCapability().then((cap) => {
      if (!cancelled) db.setDelivery(cap);
    });
    return () => {
      cancelled = true;
    };
  }, [db]);

  useEffect(() => {
    if (!slug) return;
    const id = window.setInterval(() => {
      void db.sweepReminders(slug, date);
    }, SWEEP_MINUTES * 60 * 1000);
    return () => window.clearInterval(id);
  }, [db, slug, date]);

  const actions: TimentoActions = useMemo(
    () => ({
      login: async (loginSlug: string, passcode: string) => {
        const res = db.login(loginSlug, passcode);
        if (res.ok) store({ token: `demo:${loginSlug}`, slug: loginSlug, name: res.name ?? loginSlug });
        return res;
      },
      logout: () => store(null),
      toggleCheck: (key: string) => slug && db.toggleCheck(slug, date, key),
      logWeight: (kg: number) => slug && db.logWeight(slug, date, kg),
      logState: (patch: { stress?: number; energy?: number }) => slug && db.logState(slug, date, patch),
      markRitual: () => slug && db.markRitual(slug, date),
      logCraving: async (entry: CravingEntry): Promise<string | null> => {
        if (!slug) return null;
        return db.logCraving(slug, date, entry);
      },
      enrichCraving: async (id, patch) => (slug ? db.enrichCraving(slug, id, patch) : false),
      undoCraving: (id: string) => slug && db.undoCraving(slug, id),
      markSessionDone: () => slug && db.markSessionDone(slug, date),
      setMode: (mode, reason, reviewDate) => slug && db.setMode(slug, date, mode, reason, reviewDate),
      nudge: (message: string) => slug && db.nudge(slug, message),
      logFood: (slot, foodKey, grams) => slug && db.logFood(slug, date, slot, foodKey, grams),
      setFoodEaten: (entryId, eaten) => db.setFoodEaten(entryId, eaten),
      removeFood: (entryId) => db.removeFood(entryId),
      generateMealPlan: (today) => slug && db.generateMealPlan(slug, date, today),
      logMenu: (slot, items) => slug && db.logMenu(slug, date, slot, items),
      saveMenu: (name, slot, items) => slug && db.saveMenu(slug, name, slot, items),
      copyYesterday: () => slug && db.copyYesterday(slug, date),
      generateWeek: (today) => slug && db.generateWeek(slug, date, today),
      setKitchen: (patch) => slug && db.setKitchen(slug, patch),
      swapFood: (entryId, foodKey) => db.swapFood(entryId, foodKey),
      logSet: (exercise, setIndex, weightKg, reps, rir) =>
        slug && db.logSet(slug, date, exercise, setIndex, weightKg, reps, rir),
      startMesocycle: (goal) => slug && db.startMesocycle(slug, date, goal),
      saveTrainProfile: (profile) => slug && db.saveTrainProfile(slug, profile),
      swapTrainBlock: (exercise, replacement) => slug && db.swapTrainBlock(slug, exercise, replacement),
      logDose: (itemId, timing, taken, site) => slug && db.logDose(slug, date, itemId, timing, taken, site),
      setStackItemActive: (itemId, active) => db.setStackItemActive(itemId, active),
      addLabPanel: (name, results, fasted, source, photoStorageId) =>
        slug && db.addLabPanel(slug, date, name, results, fasted, source, photoStorageId),
      submitAssessment: (instrument, answers) => slug && db.submitAssessment(slug, date, instrument, answers),
      addIntention: (trigger, action) => slug && db.addIntention(slug, date, trigger, action),
      markIntentionWin: (intentionId) => db.markIntentionWin(intentionId),
      saveReflection: (prompt, response, win) => slug && db.saveReflection(slug, date, prompt, response, win),
      inviteCrew: (target, scopes, relationship) =>
        slug && db.inviteCrew(slug, date, target, scopes, relationship),
      setPantry: (foodKey, grams) => slug && db.setPantry(slug, date, foodKey, grams),
      clearPantry: () => slug && db.clearPantry(slug),
      savePushSubscription: (sub) => slug && db.savePushSubscription(slug, date, sub),
      removePushSubscription: (endpoint) => db.removePushSubscription(endpoint),
      setReminderPrefs: (prefs) => slug && db.setReminderPrefs(slug, prefs),
      saveCapture: (kind, storageId, note) => slug && db.saveCapture(slug, date, kind, storageId, note),
      removeCapture: (captureId) => db.removeCapture(captureId),
      respondToCrewInvite: (linkId, accept) => slug && db.respondToCrewInvite(slug, date, linkId, accept),
      revokeCrewLink: (linkId) => slug && db.revokeCrewLink(slug, date, linkId),
      setSupplyCount: (itemId, onHand) => slug && db.setSupplyCount(slug, date, itemId, onHand),
      saveContact: (kind, name, phone) => slug && db.saveContact(slug, kind, name, phone),
      setA11yProfile: (profile) => slug && db.setA11yProfile(slug, profile),
      createIngestToken: (label) => slug && db.createIngestToken(slug, date, label),
      revokeIngestToken: (tokenId) => db.revokeIngestToken(tokenId),
    }),
    [db, slug, date, store],
  );

  const value: TimentoState = {
    demo: true,
    date,
    session,
    authReady,
    today: slug ? db.today(slug, date) : undefined,
    crew: slug ? db.crew(slug, date) : undefined,
    feed: slug ? db.feed() : undefined,
    progress: slug ? db.progress(slug, date) : undefined,
    research: slug ? db.research(slug, date) : undefined,
    fuel: slug ? db.fuel(slug, date) : undefined,
    train: slug ? db.train(slug, date) : undefined,
    stack: slug ? db.stack(slug, date) : undefined,
    labs: slug ? db.labsView(slug, date) : undefined,
    mind: slug ? db.mind(slug, date) : undefined,
    supply: slug ? db.supply(slug, date) : undefined,
    handsFree: slug ? db.handsFree(slug, date) : undefined,
    shop: slug ? db.shop(slug, date) : undefined,
    remind: slug ? db.remind(slug, date) : undefined,
    actions,
  };
  return <TimentoContext.Provider value={value}>{children}</TimentoContext.Provider>;
}

/* ===== Convex backend ===== */

let convexClient: ConvexReactClient | null = null;
function getConvexClient(): ConvexReactClient | null {
  if (!CONVEX_ENDPOINT) return null;
  if (!convexClient) {
    try {
      convexClient = new ConvexReactClient(CONVEX_ENDPOINT);
    } catch {
      return null;
    }
  }
  return convexClient;
}

function ConvexBackendInner({ children }: { children: React.ReactNode }) {
  const { session, authReady, store } = useStoredSession();
  const date = useLocalDate();
  const token = session?.token;
  const args = token ? { token, date } : "skip";

  const today = useQuery(api.tm.today.get, args);
  const crew = useQuery(api.tm.crew.board, args);
  const feed = useQuery(api.tm.crew.feed, token ? { token } : "skip");
  const progress = useQuery(api.tm.progress.get, args);
  const research = useQuery(api.tm.research.get, args);
  const fuel = useQuery(api.tm.fuel.get, args);
  const train = useQuery(api.tm.train.get, args);
  const stack = useQuery(api.tm.stack.get, args);
  const labs = useQuery(api.tm.labs.get, args);
  const mind = useQuery(api.tm.mind.get, args);
  const supply = useQuery(api.tm.supply.get, args);
  const handsFree = useQuery(api.tm.ingest.get, args);
  const shop = useQuery(api.tm.shop.get, args);
  const remind = useQuery(api.tm.remind.get, args);

  const loginMut = useMutation(api.tm.auth.login);
  const logoutMut = useMutation(api.tm.auth.logout);
  const toggleMut = useMutation(api.tm.today.toggleCheck);
  const weightMut = useMutation(api.tm.today.logWeight);
  const stateMut = useMutation(api.tm.today.logState);
  const ritualMut = useMutation(api.tm.today.markRitual);
  const cravingMut = useMutation(api.tm.today.logCraving);
  const enrichCravingMut = useMutation(api.tm.today.enrichCraving);
  const undoCravingMut = useMutation(api.tm.today.undoCraving);
  const sessionDoneMut = useMutation(api.tm.today.markSessionDone);
  const modeMut = useMutation(api.tm.today.setMode);
  const nudgeMut = useMutation(api.tm.crew.nudge);
  const logFoodMut = useMutation(api.tm.fuel.logFood);
  const setFoodEatenMut = useMutation(api.tm.fuel.setFoodEaten);
  const removeFoodMut = useMutation(api.tm.fuel.removeFood);
  const generatePlanMut = useMutation(api.tm.fuel.generatePlan);
  const logMenuMut = useMutation(api.tm.fuel.logMenu);
  const saveMenuMut = useMutation(api.tm.fuel.saveMenu);
  const copyYesterdayMut = useMutation(api.tm.fuel.copyYesterday);
  const generateWeekMut = useMutation(api.tm.fuel.generateWeek);
  const setKitchenMut = useMutation(api.tm.fuel.setKitchen);
  const swapFoodMut = useMutation(api.tm.fuel.swapFood);
  const logSetMut = useMutation(api.tm.train.logSet);
  const startMesoMut = useMutation(api.tm.train.startMesocycle);
  const saveTrainProfileMut = useMutation(api.tm.train.saveProfile);
  const swapTrainBlockMut = useMutation(api.tm.train.swapBlock);
  const logDoseMut = useMutation(api.tm.stack.logDose);
  const setItemActiveMut = useMutation(api.tm.stack.setItemActive);
  const addPanelMut = useMutation(api.tm.labs.addPanel);
  const submitAssessmentMut = useMutation(api.tm.mind.submitAssessment);
  const addIntentionMut = useMutation(api.tm.mind.addIntention);
  const intentionWinMut = useMutation(api.tm.mind.markIntentionWin);
  const saveReflectionMut = useMutation(api.tm.mind.saveReflection);
  const inviteCrewMut = useMutation(api.tm.crew.invite);
  const respondCrewMut = useMutation(api.tm.crew.respondToInvite);
  const revokeCrewMut = useMutation(api.tm.crew.revokeLink);
  const setSupplyMut = useMutation(api.tm.supply.setCount);
  const saveContactMut = useMutation(api.tm.supply.saveContact);
  const setProfileMut = useMutation(api.tm.today.setA11yProfile);
  const createTokenMut = useMutation(api.tm.ingest.createToken);
  const revokeTokenMut = useMutation(api.tm.ingest.revokeToken);
  const setPantryMut = useMutation(api.tm.shop.setPantry);
  const clearPantryMut = useMutation(api.tm.shop.clearPantry);
  const savePushMut = useMutation(api.tm.remind.saveSubscription);
  const removePushMut = useMutation(api.tm.remind.removeSubscription);
  const setPrefsMut = useMutation(api.tm.remind.setPrefs);
  const saveCaptureMut = useMutation(api.tm.remind.saveCapture);
  const removeCaptureMut = useMutation(api.tm.remind.removeCapture);

  const actions: TimentoActions = useMemo(
    () => ({
      login: async (slug: string, passcode: string) => {
        try {
          const res = await loginMut({ slug, passcode });
          if (!res.ok) {
            const error =
              res.code === "wrong-passcode"
                ? "Wrong passcode"
                : res.code === "too-many-attempts"
                  ? "Too many attempts. Try again in 15 minutes."
                  : "Unknown user";
            return { ok: false, error };
          }
          store({ token: res.token, slug: res.slug, name: res.name });
          return { ok: true };
        } catch {
          return { ok: false, error: "Sign-in error" };
        }
      },
      logout: () => {
        if (token) void logoutMut({ token }).catch(() => undefined);
        store(null);
      },
      toggleCheck: (key: string) => token && void toggleMut({ token, date, key }),
      logWeight: (weightKg: number) => token && void weightMut({ token, date, weightKg }),
      logState: (patch: { stress?: number; energy?: number }) => token && void stateMut({ token, date, ...patch }),
      markRitual: () => token && void ritualMut({ token, date }),
      logCraving: async (entry: CravingEntry): Promise<string | null> => {
        if (!token) return null;
        // Null is the only failure this returns. A rejection here would land in
        // the card mid-write, and a card that cannot finish its write is a card
        // that stops accepting taps for the rest of the night.
        try {
          return await cravingMut({ token, date, ...entry });
        } catch {
          return null;
        }
      },
      // A rejected patch is answered here, not thrown at the card: the caller
      // gets a plain false and decides what to tell the person.
      enrichCraving: async (id, patch) => {
        if (!token) return false;
        try {
          await enrichCravingMut({ token, id: id as Id<"tm_cravings">, ...patch });
          return true;
        } catch {
          return false;
        }
      },
      undoCraving: (id: string) => token && void undoCravingMut({ token, id: id as Id<"tm_cravings"> }),
      markSessionDone: () => token && void sessionDoneMut({ token, date }),
      setMode: (mode, reason, reviewDate) => token && void modeMut({ token, date, mode, reason, reviewDate }),
      nudge: (message: string) => token && void nudgeMut({ token, message }),
      logFood: (slot, foodKey, grams) => token && void logFoodMut({ token, date, slot, foodKey, grams }),
      setFoodEaten: (entryId, eaten) =>
        token && void setFoodEatenMut({ token, entryId: entryId as Id<"tm_mealEntries">, eaten }),
      removeFood: (entryId) =>
        token && void removeFoodMut({ token, entryId: entryId as Id<"tm_mealEntries"> }),
      generateMealPlan: (today) => token && void generatePlanMut({ token, date, ...(today ?? {}) }),
      logMenu: (slot, items) => token && void logMenuMut({ token, date, slot, items }),
      saveMenu: (name, slot, items) => token && void saveMenuMut({ token, name, slot, items }),
      copyYesterday: () => token && void copyYesterdayMut({ token, date }),
      generateWeek: (today) => token && void generateWeekMut({ token, date, ...(today ?? {}) }),
      setKitchen: (patch) => token && void setKitchenMut({ token, ...patch }),
      swapFood: (entryId, foodKey) =>
        token && void swapFoodMut({ token, entryId: entryId as Id<"tm_mealEntries">, foodKey }),
      logSet: (exercise, setIndex, weightKg, reps, rir) =>
        token && void logSetMut({ token, date, exercise, setIndex, weightKg, reps, rir }),
      startMesocycle: (goal) => token && void startMesoMut({ token, date, goal }),
      saveTrainProfile: (profile) => token && void saveTrainProfileMut({ token, ...profile }),
      swapTrainBlock: (exercise, replacement) =>
        token && void swapTrainBlockMut({ token, exercise, replacement }),
      logDose: (itemId, timing, taken, site) =>
        token && void logDoseMut({ token, date, itemId: itemId as Id<"tm_protocolItems">, timing, taken, site }),
      setStackItemActive: (itemId, active) =>
        token && void setItemActiveMut({ token, itemId: itemId as Id<"tm_protocolItems">, active }),
      addLabPanel: (name, results, fasted, source, photoStorageId) =>
        token &&
        void addPanelMut({
          token,
          date,
          name,
          results,
          fasted,
          source,
          photoStorageId: photoStorageId as Id<"_storage"> | undefined,
        }),
      submitAssessment: (instrument, answers) =>
        token && void submitAssessmentMut({ token, date, instrument, answers }),
      addIntention: (trigger, action) => token && void addIntentionMut({ token, date, trigger, action }),
      markIntentionWin: (intentionId) =>
        token && void intentionWinMut({ token, intentionId: intentionId as Id<"tm_intentions"> }),
      saveReflection: (prompt, response, win) =>
        token && void saveReflectionMut({ token, date, prompt, response, win }),
      inviteCrew: (slug, scopes, relationship) =>
        token && void inviteCrewMut({ token, date, slug, scopes, relationship }),
      setPantry: (foodKey, grams) => token && void setPantryMut({ token, date, foodKey, grams }),
      clearPantry: () => token && void clearPantryMut({ token }),
      savePushSubscription: (sub) => token && void savePushMut({ token, date, ...sub }),
      removePushSubscription: (endpoint) => token && void removePushMut({ token, endpoint }),
      setReminderPrefs: (prefs) => token && void setPrefsMut({ token, ...prefs }),
      saveCapture: (kind, storageId, note) =>
        token && void saveCaptureMut({ token, date, kind, storageId: storageId as Id<"_storage">, note }),
      removeCapture: (captureId) =>
        token && void removeCaptureMut({ token, captureId: captureId as Id<"tm_captures"> }),
      respondToCrewInvite: (linkId, accept) =>
        token && void respondCrewMut({ token, date, linkId: linkId as Id<"tm_crewLinks">, accept }),
      revokeCrewLink: (linkId) =>
        token && void revokeCrewMut({ token, date, linkId: linkId as Id<"tm_crewLinks"> }),
      setSupplyCount: (itemId, onHand) =>
        token && void setSupplyMut({ token, date, itemId: itemId as Id<"tm_protocolItems">, onHand }),
      saveContact: (kind, name, phone) => token && void saveContactMut({ token, kind, name, phone }),
      setA11yProfile: (profile) => token && void setProfileMut({ token, profile }),
      createIngestToken: (label) => token && void createTokenMut({ token, date, label }),
      revokeIngestToken: (tokenId) =>
        token && void revokeTokenMut({ token, tokenId: tokenId as Id<"tm_ingestTokens"> }),
    }),
    [
      token,
      date,
      store,
      loginMut,
      logoutMut,
      toggleMut,
      weightMut,
      stateMut,
      ritualMut,
      cravingMut,
      enrichCravingMut,
      undoCravingMut,
      sessionDoneMut,
      modeMut,
      nudgeMut,
      logFoodMut,
      setFoodEatenMut,
      removeFoodMut,
      generatePlanMut,
      logMenuMut,
      saveMenuMut,
      copyYesterdayMut,
      generateWeekMut,
      setKitchenMut,
      swapFoodMut,
      logSetMut,
      startMesoMut,
      saveTrainProfileMut,
      swapTrainBlockMut,
      logDoseMut,
      setItemActiveMut,
      addPanelMut,
      submitAssessmentMut,
      addIntentionMut,
      intentionWinMut,
      saveReflectionMut,
      inviteCrewMut,
      respondCrewMut,
      revokeCrewMut,
      setSupplyMut,
      saveContactMut,
      setProfileMut,
      createTokenMut,
      revokeTokenMut,
      setPantryMut,
      clearPantryMut,
      savePushMut,
      removePushMut,
      setPrefsMut,
      saveCaptureMut,
      removeCaptureMut,
    ],
  );

  const value: TimentoState = {
    demo: false,
    date,
    session,
    authReady,
    today,
    crew,
    feed,
    progress,
    research,
    fuel,
    train,
    stack,
    labs,
    mind,
    supply,
    handsFree,
    shop,
    remind,
    actions,
  };
  return <TimentoContext.Provider value={value}>{children}</TimentoContext.Provider>;
}

function ConvexBackend({ children }: { children: React.ReactNode }) {
  const client = getConvexClient();
  if (!client) return <DemoBackend>{children}</DemoBackend>;
  return (
    <ConvexProvider client={client}>
      <ConvexBackendInner>{children}</ConvexBackendInner>
    </ConvexProvider>
  );
}

export function TimentoProvider({ children }: { children: React.ReactNode }) {
  if (DEMO) return <DemoBackend>{children}</DemoBackend>;
  return <ConvexBackend>{children}</ConvexBackend>;
}
