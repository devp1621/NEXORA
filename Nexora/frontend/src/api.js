// Thin fetch wrapper around the Nexora backend. The backend serves this frontend, so the
// default base is same-origin. Override at build time with: API_BASE=http://localhost:8000 node build.mjs
/* global __API_BASE__ */
const BASE = typeof __API_BASE__ !== "undefined" ? __API_BASE__ : "";
const TIMEOUT_MS = 20000;

export class ApiError extends Error {
  constructor(message, { status = 0, code = "error", details = [], network = false } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.network = network;
  }
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;
  try {
    response = await fetch(BASE + path, {
      ...options,
      credentials: "include",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
    });
  } catch (err) {
    const timedOut = err && err.name === "AbortError";
    throw new ApiError(
      timedOut
        ? "The server took too long to respond."
        : "Cannot reach the Nexora server. Make sure the backend is running.",
      { network: true, code: timedOut ? "timeout" : "network" }
    );
  } finally {
    clearTimeout(timer);
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
    /* non-JSON error page */
  }
  if (!response.ok) {
    const e = body && body.error;
    throw new ApiError((e && e.message) || `Request failed (${response.status}).`, {
      status: response.status,
      code: (e && e.code) || "http_error",
      details: (e && e.details) || [],
    });
  }
  return body;
}

export const api = {
  health: () => request("/api/health"),
  careers: () => request("/api/careers"),
  analyze: (careerId, profile) =>
    request("/api/analyze", { method: "POST", body: JSON.stringify({ careerId, profile }) }),
  me: () => request("/api/auth/me"),
  login: (email, password) => request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  register: (name, email, password) => request("/api/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) }),
  logout: () => request("/api/auth/logout", { method: "POST", body: "{}" }),
  getState: () => request("/api/state"),
  putState: (state) => request("/api/state", { method: "PUT", body: JSON.stringify(state) }),
  chat: (careerId, profile, message, history) =>
    request("/api/chat", { method: "POST", body: JSON.stringify({ careerId, profile, message, history }) }),
  recommendations: (careerId, profile) =>
    request("/api/recommendations", { method: "POST", body: JSON.stringify({ careerId, profile }) }),
};

// The backend ignores unknown keys, but only send what it documents.
export function toApiProfile(profile) {
  const clean = (s) => (typeof s === "string" ? s.trim() : s);
  return {
    name: clean(profile.name),
    degree: clean(profile.degree),
    branch: clean(profile.branch),
    year: clean(profile.year),
    technicalSkills: (profile.technicalSkills || []).map((s) => ({ name: clean(s.name), level: s.level || "intermediate" })),
    softSkills: profile.softSkills || [],
    projects: (profile.projects || []).map((p) => ({
      title: clean(p.title),
      description: clean(p.description || ""),
      technologies: p.technologies || [],
    })),
    certifications: (profile.certifications || []).map((c) => ({ name: clean(c.name), issuer: clean(c.issuer || "") })),
    experience: (profile.experience || []).map((e) => ({
      role: clean(e.role),
      organization: clean(e.organization || ""),
      description: clean(e.description || ""),
    })),
    achievements: profile.achievements || [],
  };
}
