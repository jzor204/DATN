import { useMemo, useState } from "react";
import AlertBanner from "../components/AlertBanner";
import SectionCard from "../components/SectionCard";
import { formatRoleLabel } from "../utils/format";
import { getAccessToken } from "../utils/auth";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8080/api/v1";
const FRONTEND_URL = "http://127.0.0.1:5173";

function StatusChip({ tone = "success", children }) {
  const tones = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    info: "border-blue-200 bg-blue-50 text-blue-700",
    muted: "border-slate-200 bg-slate-100 text-slate-700",
    danger: "border-red-200 bg-red-50 text-red-700"
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

function ReadOnlyField({ label, value, onCopy }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <div className="flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none"
          readOnly
          value={value}
        />
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
          onClick={() => onCopy(value)}
          type="button"
        >
          Copy
        </button>
      </div>
    </label>
  );
}

function ToggleRow({ label, description, enabled = true }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div>
        <div className="text-sm font-semibold text-ink">{label}</div>
        <div className="mt-1 text-xs text-slate-500">{description}</div>
      </div>
      <span
        className={`flex h-6 w-11 items-center rounded-full px-1 transition ${
          enabled ? "justify-end bg-blue-600" : "justify-start bg-slate-300"
        }`}
      >
        <span className="h-4 w-4 rounded-full bg-white" />
      </span>
    </div>
  );
}

export default function SettingsPage({ currentUser, onLogout }) {
  const [message, setMessage] = useState("");
  const token = getAccessToken();

  const sessionSummary = useMemo(() => {
    if (!token) {
      return "No token";
    }
    return `${token.slice(0, 12)}...${token.slice(-8)}`;
  }, [token]);

  async function handleCopy(value) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied to clipboard.");
    } catch (err) {
      setMessage("Clipboard is not available in this browser.");
    }
  }

  function handleResetDemoFilters() {
    window.localStorage.removeItem("task_management_demo_filters");
    setMessage("Demo filters reset.");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Cai dat</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cau hinh tai khoan, phien dang nhap va moi truong API.
        </p>
      </div>

      <AlertBanner
        message={message}
        tone={message === "Copied to clipboard." || message === "Demo filters reset." ? "success" : "info"}
      />

      <div className="flex flex-wrap gap-2">
        {["Tai khoan", "Bao mat", "API & Realtime", "Cache"].map((tab) => (
          <span
            className={`rounded-md border px-3 py-2 text-sm font-semibold ${
              tab === "API & Realtime"
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-600"
            }`}
            key={tab}
          >
            {tab}
          </span>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <SectionCard title="Tai khoan" eyebrow="Profile">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</div>
                <div className="mt-2 text-sm font-semibold text-ink">{currentUser.name}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</div>
                <div className="mt-2 truncate text-sm font-semibold text-ink">{currentUser.email}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Global role</div>
                <div className="mt-2">
                  <StatusChip tone={currentUser.role === "admin" ? "info" : "muted"}>
                    {formatRoleLabel(currentUser.role)}
                  </StatusChip>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">User ID</div>
                <div className="mt-2 text-sm font-semibold text-ink">#{currentUser.id}</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                type="button"
              >
                Cap nhat ho so
              </button>
              <button
                className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                onClick={onLogout}
                type="button"
              >
                Dang xuat
              </button>
            </div>
          </SectionCard>

          <SectionCard title="API Environment" eyebrow="Backend">
            <div className="grid gap-4">
              <ReadOnlyField label="API base URL" onCopy={handleCopy} value={API_BASE_URL} />
              <ReadOnlyField label="Swagger" onCopy={handleCopy} value="/swagger/index.html" />
              <ReadOnlyField label="Frontend Vite URL" onCopy={handleCopy} value={FRONTEND_URL} />
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-ink">Docker compose backend</div>
                  <div className="mt-1 text-xs text-slate-500">mysql, redis, api</div>
                </div>
                <StatusChip>Configured</StatusChip>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Realtime WebSocket" eyebrow="Events">
            <div className="grid gap-4 md:grid-cols-2">
              <ReadOnlyField label="Connection path" onCopy={handleCopy} value="/api/v1/ws" />
              <ReadOnlyField label="Active scopes" onCopy={handleCopy} value="projects, project, task" />
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reconnect attempts</div>
                <div className="mt-2 text-sm font-semibold text-ink">5</div>
              </div>
              <ToggleRow
                description="Frontend refetches data after receiving a valid event."
                label="Refetch on event"
              />
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Redis Cache" eyebrow="Cache">
            <div className="space-y-4">
              <ReadOnlyField label="Cache key" onCopy={handleCopy} value="user:{id}:profile" />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">TTL</div>
                  <div className="mt-2 text-sm font-semibold text-ink">5 phut</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Used by</div>
                  <div className="mt-2 text-sm font-semibold text-ink">/auth/me</div>
                </div>
              </div>
              <ToggleRow description="Redis profile cache is active in backend." label="Cache enabled" />
            </div>
          </SectionCard>

          <SectionCard title="Session" eyebrow="JWT">
            <div className="space-y-4">
              <ReadOnlyField label="Access token" onCopy={handleCopy} value={sessionSummary} />
              <ToggleRow description="JWT access token is stored in localStorage." label="Local session" />
              <ToggleRow description="Refresh token is not implemented yet." enabled={false} label="Refresh token" />
              <ToggleRow description="Protected routes redirect anonymous users." label="Protected routes" />
            </div>
          </SectionCard>

          <section className="rounded-lg border border-red-200 bg-white px-5 py-5 shadow-panel">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Danger zone</p>
              <h2 className="mt-1 text-lg font-semibold text-ink">Session tools</h2>
            </div>
            <div className="space-y-3">
              <button
                className="w-full rounded-md border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                onClick={onLogout}
                type="button"
              >
                Xoa session local
              </button>
              <button
                className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                onClick={handleResetDemoFilters}
                type="button"
              >
                Reset bo loc demo
              </button>
              <button
                className="w-full cursor-not-allowed rounded-md border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-400"
                disabled
                type="button"
              >
                Xoa tai khoan
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
