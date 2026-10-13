import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, toApiProfile } from "./api.js";
import { DEMOS } from "./demo.js";

const KEYS = {
  profile: "cc.v1.profile",
  career: "cc.v1.careerId",
  analysis: "cc.v1.analysis",
  progress: "cc.v1.progress",
  chat: "cc.v1.chat",
};

let storageFailed = false;
function load(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    if (value === null || value === undefined) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    storageFailed = true;
  }
}

export function go(path) {
  window.location.hash = path;
}

/** "Sample data", "Sample data (edited)" or null, derived from the profile contents. */
export function sampleLabel(profile) {
  if (!profile || !profile.sample || !DEMOS[profile.sample]) return null;
  const original = JSON.stringify(toApiProfile(DEMOS[profile.sample].profile));
  return JSON.stringify(toApiProfile(profile)) === original ? "Sample data" : "Sample data (edited)";
}

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [careers, setCareers] = useState({ status: "loading", data: null, error: null });
  const [health, setHealth] = useState({ status: "loading", data: null });
  const [profile, setProfile] = useState(() => load(KEYS.profile, null));
  const [careerId, setCareerId] = useState(() => load(KEYS.career, null));
  const [analysis, setAnalysis] = useState(() => {
    const cached = load(KEYS.analysis, null);
    return cached ? { status: "loading", data: cached.data, error: null, offline: false } : { status: "idle", data: null, error: null, offline: false };
  });
  const [progress, setProgress] = useState(() => load(KEYS.progress, {}));
  const [recs, setRecs] = useState({ status: "idle", data: null, error: null });
  const [storageOk, setStorageOk] = useState(true);
  const [chat, setChatState] = useState(() => load(KEYS.chat, []));
  // auth.status: "loading" | "guest" | "user". auth.enabled is true only when the server has a database.
  const [auth, setAuth] = useState({ status: "loading", enabled: false, user: null });
  const [sync, setSync] = useState("idle"); // idle | saving | saved | error | expired
  const [syncReady, setSyncReady] = useState(false);
  const token = useRef(0);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const setChat = useCallback((update) => {
    setChatState((prev) => {
      const next = (typeof update === "function" ? update(prev) : update).slice(-40);
      save(KEYS.chat, next);
      return next;
    });
  }, []);

  const runAnalysis = useCallback(async (p, cid) => {
    const mine = ++token.current;
    setAnalysis((a) => ({ ...a, status: "loading", error: null }));
    setRecs({ status: "idle", data: null, error: null });
    try {
      const data = await api.analyze(cid, toApiProfile(p));
      if (mine !== token.current) return { ok: false, stale: true };
      setAnalysis({ status: "ready", data, error: null, offline: false });
      save(KEYS.analysis, { careerId: cid, data });
      setStorageOk(!storageFailed);
      return { ok: true, data };
    } catch (err) {
      if (mine !== token.current) return { ok: false, stale: true };
      const error = err instanceof ApiError ? err : new ApiError("Unexpected error while analyzing.");
      const cached = load(KEYS.analysis, null);
      if (error.network && cached && cached.careerId === cid) {
        setAnalysis({ status: "ready", data: cached.data, error, offline: true });
      } else {
        setAnalysis({ status: "error", data: null, error, offline: false });
      }
      return { ok: false, error };
    }
  }, []);

  // Initial load: reference data, service status, and a fresh analysis of any saved profile.
  const loadCareers = useCallback(async () => {
    setCareers((c) => ({ ...c, status: "loading", error: null }));
    try {
      setCareers({ status: "ready", data: await api.careers(), error: null });
    } catch (err) {
      setCareers({ status: "error", data: null, error: err });
    }
    try {
      const data = await api.health();
      setHealth({ status: "ok", data });
      return data;
    } catch {
      setHealth({ status: "down", data: null });
      return null;
    }
  }, []);

  /** Replace local state with the signed-in user's saved data. If the account has none yet, keep what is here and upload it. */
  const hydrate = useCallback(
    async (user) => {
      setAuth({ status: "user", enabled: true, user });
      setSyncReady(false);
      try {
        const { state } = await api.getState();
        if (state && (state.profile || state.careerId)) {
          setProfile(state.profile || null);
          setCareerId(state.careerId || null);
          setProgress(state.progress || {});
          setChatState(state.chat || []);
          save(KEYS.profile, state.profile || null);
          save(KEYS.career, state.careerId || null);
          save(KEYS.progress, state.progress || {});
          save(KEYS.chat, state.chat || []);
          if (state.profile && state.careerId) runAnalysis(state.profile, state.careerId);
          else setAnalysis({ status: "idle", data: null, error: null, offline: false });
        }
        setSyncReady(true);
        setSync("saved");
        return Boolean((state && state.profile) || profileRef.current);
      } catch (err) {
        setSync(err && err.status === 401 ? "expired" : "error");
        return Boolean(profileRef.current);
      }
    },
    [runAnalysis]
  );

  useEffect(() => {
    (async () => {
      const h = await loadCareers();
      if (profile && careerId) runAnalysis(profile, careerId);
      else setAnalysis({ status: "idle", data: null, error: null, offline: false });
      if (!h || !h.authEnabled) {
        setAuth({ status: "guest", enabled: false, user: null });
        return;
      }
      try {
        const { user } = await api.me();
        if (!user) {
          setAuth({ status: "guest", enabled: true, user: null });
          return;
        }
        await hydrate(user);
      } catch {
        setAuth({ status: "guest", enabled: true, user: null });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save to the account (debounced) whenever the saved data changes.
  useEffect(() => {
    if (auth.status !== "user" || !syncReady) return undefined;
    setSync("saving");
    const timer = setTimeout(async () => {
      try {
        await api.putState({
          profile: profile ? { ...toApiProfile(profile), ...(profile.sample ? { sample: profile.sample } : {}) } : null,
          careerId: careerId || null,
          progress,
          chat: chat.map((m) => ({ role: m.role, text: String(m.text).slice(0, 2000), source: m.source, note: m.note, error: m.error })),
        });
        setSync("saved");
      } catch (err) {
        if (err && err.status === 401) {
          setAuth((a) => ({ ...a, status: "guest", user: null }));
          setSync("expired");
        } else setSync("error");
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [profile, careerId, progress, chat, auth.status, syncReady]);

  const signUp = useCallback(
    async (name, email, password) => {
      try {
        const { user } = await api.register(name, email, password);
        return { ok: true, hasProfile: await hydrate(user) };
      } catch (error) {
        return { ok: false, error };
      }
    },
    [hydrate]
  );

  const signIn = useCallback(
    async (email, password) => {
      try {
        const { user } = await api.login(email, password);
        return { ok: true, hasProfile: await hydrate(user) };
      } catch (error) {
        return { ok: false, error };
      }
    },
    [hydrate]
  );

  /** Sign out and wipe this browser's copy so the next person on a shared computer sees nothing. */
  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* the server session expires on its own; still clear this device */
    }
    token.current++;
    Object.values(KEYS).forEach((k) => save(k, null));
    setProfile(null);
    setCareerId(null);
    setProgress({});
    setChatState([]);
    setAnalysis({ status: "idle", data: null, error: null, offline: false });
    setRecs({ status: "idle", data: null, error: null });
    setSyncReady(false);
    setSync("idle");
    setAuth({ status: "guest", enabled: true, user: null });
  }, []);

  const persist = (p, cid) => {
    save(KEYS.profile, p);
    save(KEYS.career, cid);
    setStorageOk(!storageFailed);
  };

  const saveProfile = useCallback(
    async (p, cid) => {
      setProfile(p);
      setCareerId(cid);
      persist(p, cid);
      return runAnalysis(p, cid);
    },
    [runAnalysis]
  );

  const selectCareer = useCallback(
    async (cid) => {
      setCareerId(cid);
      save(KEYS.career, cid);
      if (profile) return runAnalysis(profile, cid);
      return { ok: true };
    },
    [profile, runAnalysis]
  );

  const loadDemo = useCallback(
    async (key) => {
      const demo = DEMOS[key];
      const p = { ...structuredClone(demo.profile), sample: key };
      return saveProfile(p, demo.careerId);
    },
    [saveProfile]
  );

  const addSkill = useCallback(
    async (name, level) => {
      if (!profile) return { ok: false };
      const lower = name.trim().toLowerCase();
      const rest = profile.technicalSkills.filter((s) => s.name.trim().toLowerCase() !== lower);
      const next = { ...profile, technicalSkills: [...rest, { name: name.trim(), level }] };
      return saveProfile(next, careerId);
    },
    [profile, careerId, saveProfile]
  );

  const clearProfile = useCallback(() => {
    token.current++;
    setProfile(null);
    setCareerId(null);
    setAnalysis({ status: "idle", data: null, error: null, offline: false });
    setRecs({ status: "idle", data: null, error: null });
    save(KEYS.profile, null);
    save(KEYS.career, null);
    save(KEYS.analysis, null);
  }, []);

  const toggleTask = useCallback((id) => {
    setProgress((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      save(KEYS.progress, next);
      return next;
    });
    setStorageOk(!storageFailed);
  }, []);

  const resetProgress = useCallback((ids) => {
    setProgress((prev) => {
      const next = { ...prev };
      ids.forEach((id) => delete next[id]);
      save(KEYS.progress, next);
      return next;
    });
  }, []);

  const requestAI = useCallback(async () => {
    if (!profile || !careerId) return;
    setRecs({ status: "loading", data: null, error: null });
    try {
      setRecs({ status: "ready", data: await api.recommendations(careerId, toApiProfile(profile)), error: null });
    } catch (err) {
      setRecs({ status: "error", data: null, error: err });
    }
  }, [profile, careerId]);

  const value = useMemo(
    () => ({
      careers, health, profile, careerId, analysis, progress, recs, storageOk, chat, setChat, auth, sync, signUp, signIn, signOut,
      saveProfile, selectCareer, loadDemo, addSkill, clearProfile, toggleTask, resetProgress, requestAI,
      retry: () => (profile && careerId ? runAnalysis(profile, careerId) : null),
      reloadCareers: loadCareers,
    }),
    [careers, health, profile, careerId, analysis, progress, recs, storageOk, chat, setChat, auth, sync, signUp, signIn, signOut, saveProfile, selectCareer, loadDemo, addSkill, clearProfile, toggleTask, resetProgress, requestAI, runAnalysis, loadCareers]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
