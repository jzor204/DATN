import { useState } from "react";
import { login } from "../api/authApi";
import AlertBanner from "../components/AlertBanner";
import SectionCard from "../components/SectionCard";
import { navigateTo } from "../utils/router";

const initialForm = {
  email: "",
  password: ""
};

export default function LoginPage({ notice, onAuthSuccess }) {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const payload = await login(form);
      onAuthSuccess(payload.access_token);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-xl font-semibold text-ink">Task Management</div>
          <div className="mt-2 text-sm text-slate-500">Quan ly du an, cong viec va binh luan</div>
        </div>

        <SectionCard
          action={
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              API online
            </span>
          }
          title="Dang nhap"
        >
          <form className="space-y-4" onSubmit={handleSubmit}>
            <AlertBanner message={notice} tone="info" />
            <AlertBanner message={error} />

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Email</span>
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="admin@example.com"
                required
                type="email"
                value={form.email}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Mat khau</span>
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="123456"
                required
                type="password"
                value={form.password}
              />
            </label>

            <button
              className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Dang dang nhap..." : "Dang nhap"}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between gap-3 text-sm text-slate-600">
            <span>Chua co tai khoan?</span>
            <button
              className="font-semibold text-blue-600"
              onClick={() => navigateTo("/register")}
              type="button"
            >
              Dang ky
            </button>
          </div>
        </SectionCard>

        <div className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
          Seed admin: admin@example.com / 123456
        </div>
      </div>
    </div>
  );
}
