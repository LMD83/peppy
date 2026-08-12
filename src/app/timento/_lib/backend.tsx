"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { ConvexProvider, ConvexReactClient, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { DemoDb } from "./demo-db";
import {
  localToday,
  type CravingEntry,
  type TimentoActions,
  type TimentoState,
  type TmSession,
} from "./types";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const DEMO = process.env.NEXT_PUBLIC_TIMENTO_DEMO === "1" || !CONVEX_URL;
const SESSION_KEY = "timento.session";

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
  const date = useMemo(() => localToday(), []);
  useSyncExternalStore(
    db.subscribe,
    () => db.version,
    () => 0,
  );

  const slug = session?.slug ?? null;
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
      logState: (stress: number, energy: number) => slug && db.logState(slug, date, stress, energy),
      markRitual: () => slug && db.markRitual(slug, date),
      logCraving: (entry: CravingEntry) => slug && db.logCraving(slug, date, entry),
      setMode: (mode, reason, reviewDate) => slug && db.setMode(slug, date, mode, reason, reviewDate),
      nudge: (message: string) => slug && db.nudge(slug, message),
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
    actions,
  };
  return <TimentoContext.Provider value={value}>{children}</TimentoContext.Provider>;
}

/* ===== Convex backend ===== */

let convexClient: ConvexReactClient | null = null;
function getConvexClient(): ConvexReactClient {
  if (!convexClient) convexClient = new ConvexReactClient(CONVEX_URL as string);
  return convexClient;
}

function ConvexBackendInner({ children }: { children: React.ReactNode }) {
  const { session, authReady, store } = useStoredSession();
  const date = useMemo(() => localToday(), []);
  const token = session?.token;
  const args = token ? { token, date } : "skip";

  const today = useQuery(api.tm.today.get, args);
  const crew = useQuery(api.tm.crew.board, args);
  const feed = useQuery(api.tm.crew.feed, token ? { token } : "skip");
  const progress = useQuery(api.tm.progress.get, args);
  const research = useQuery(api.tm.research.get, args);

  const loginMut = useMutation(api.tm.auth.login);
  const logoutMut = useMutation(api.tm.auth.logout);
  const toggleMut = useMutation(api.tm.today.toggleCheck);
  const weightMut = useMutation(api.tm.today.logWeight);
  const stateMut = useMutation(api.tm.today.logState);
  const ritualMut = useMutation(api.tm.today.markRitual);
  const cravingMut = useMutation(api.tm.today.logCraving);
  const modeMut = useMutation(api.tm.today.setMode);
  const nudgeMut = useMutation(api.tm.crew.nudge);

  const actions: TimentoActions = useMemo(
    () => ({
      login: async (slug: string, passcode: string) => {
        try {
          const res = await loginMut({ slug, passcode });
          store(res);
          return { ok: true };
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Login failed";
          return { ok: false, error: msg.includes("passcode") ? "Wrong passcode" : "Sign-in error" };
        }
      },
      logout: () => {
        if (token) void logoutMut({ token }).catch(() => undefined);
        store(null);
      },
      toggleCheck: (key: string) => token && void toggleMut({ token, date, key }),
      logWeight: (weightKg: number) => token && void weightMut({ token, date, weightKg }),
      logState: (stress: number, energy: number) => token && void stateMut({ token, date, stress, energy }),
      markRitual: () => token && void ritualMut({ token, date }),
      logCraving: (entry: CravingEntry) => token && void cravingMut({ token, date, ...entry }),
      setMode: (mode, reason, reviewDate) => token && void modeMut({ token, date, mode, reason, reviewDate }),
      nudge: (message: string) => token && void nudgeMut({ token, message }),
    }),
    [token, date, store, loginMut, logoutMut, toggleMut, weightMut, stateMut, ritualMut, cravingMut, modeMut, nudgeMut],
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
    actions,
  };
  return <TimentoContext.Provider value={value}>{children}</TimentoContext.Provider>;
}

function ConvexBackend({ children }: { children: React.ReactNode }) {
  return (
    <ConvexProvider client={getConvexClient()}>
      <ConvexBackendInner>{children}</ConvexBackendInner>
    </ConvexProvider>
  );
}

export function TimentoProvider({ children }: { children: React.ReactNode }) {
  if (DEMO) return <DemoBackend>{children}</DemoBackend>;
  return <ConvexBackend>{children}</ConvexBackend>;
}
