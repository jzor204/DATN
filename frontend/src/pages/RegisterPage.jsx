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
    <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-6 px-4 py-8 lg:grid-cols-[0.95fr_1.05fr]">
      <SectionCard
        title="Register"
        eyebrow="Onboarding"
        description="Register hien tai tao luon access token. Sau khi tao tai khoan xong, frontend se vao thang workspace."
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <AlertBanner message={notice} tone="info" />
          <AlertBanner message={error} />

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-700">Full name</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-tide"
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Le Anh"
              required
              value={form.name}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-700">Email</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-tide"
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="you@example.com"
              required
              type="email"
              value={form.email}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-700">Password</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-tide"
              minLength={6}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="At least 6 characters"
              required
              type="password"
              value={form.password}
            />
          </label>

          <button
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <div className="mt-5 text-sm text-slate-600">
          Da co tai khoan?{" "}
          <button
            className="font-semibold text-tide"
            onClick={() => navigateTo("/login")}
            type="button"
          >
            Quay ve trang login
          </button>
        </div>
      </SectionCard>

      <div className="space-y-5">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ember">Project Flow</p>
        <h1 className="text-5xl text-ink sm:text-6xl">Frontend nay duoc dung theo chinh luong demo MVP.</h1>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            "Login / register va xem user ID cua minh",
            "Tao project moi va them member bang user ID",
            "Tao task, assign trong project, doi status",
            "Vao task detail de comment, sua, xoa"
          ].map((item) => (
            <div
              className="glass-panel rounded-[28px] border border-white/70 px-5 py-5 text-sm text-slate-700 shadow-panel"
              key={item}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
