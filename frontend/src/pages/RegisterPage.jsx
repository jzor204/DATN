import { useState } from "react";
import { register } from "../api/authApi";
import AlertBanner from "../components/AlertBanner";
import SectionCard from "../components/SectionCard";
import { navigateTo } from "../utils/router";

const initialForm = {
  name: "",
  email: "",
  password: ""
};

export default function RegisterPage({ notice, onAuthSuccess }) {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const payload = await register(form);
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
          <div className="mt-2 text-sm text-slate-500">Tao tai khoan de vao workspace</div>
        </div>

        <SectionCard title="Dang ky" description="Nguoi dung moi se mac dinh o vai tro member.">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <AlertBanner message={notice} tone="info" />
            <AlertBanner message={error} />

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Ho ten</span>
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Le Anh"
                required
                value={form.name}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Email</span>
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="you@example.com"
                required
                type="email"
                value={form.email}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Mat khau</span>
              <input
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                minLength={6}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="Toi thieu 6 ky tu"
                required
                type="password"
                value={form.password}
              />
              <span className="text-xs text-slate-500">Mat khau toi thieu 6 ky tu.</span>
            </label>

            <button
              className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Dang tao..." : "Dang ky"}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between gap-3 text-sm text-slate-600">
            <span>Da co tai khoan?</span>
            <button
              className="font-semibold text-blue-600"
              onClick={() => navigateTo("/login")}
              type="button"
            >
              Dang nhap
            </button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
