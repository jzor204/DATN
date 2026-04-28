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
    <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-6 px-4 py-8 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-5">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-tide">Task Management</p>
        <h1 className="text-5xl text-ink sm:text-6xl">Dua backend hien tai len thanh mot frontend MVP co the demo ngay.</h1>
        <p className="max-w-2xl text-base leading-7 text-slate-600">
          Dang nhap de tao project, them member, tao task, doi trang thai va comment tren cung
          mot giao dien web don gian, ro luong va bam sat API.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="glass-panel rounded-[28px] border border-white/70 px-5 py-5 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-ember">Seed Admin</p>
            <div className="mt-3 space-y-1 text-sm text-slate-700">
              <div>Email: admin@example.com</div>
              <div>Password: 123456</div>
            </div>
          </div>
          <div className="glass-panel rounded-[28px] border border-white/70 px-5 py-5 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-tide">Seed Members</p>
            <div className="mt-3 space-y-1 text-sm text-slate-700">
              <div>membera@example.com / 123456</div>
              <div>memberb@example.com / 123456</div>
            </div>
          </div>
        </div>
      </div>

      <SectionCard
        title="Login"
        eyebrow="Access"
        description="Token se duoc luu localStorage va tu dong gui kem theo moi request."
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <AlertBanner message={notice} tone="info" />
          <AlertBanner message={error} />

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-700">Email</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-tide"
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="admin@example.com"
              required
              type="email"
              value={form.email}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-700">Password</span>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-tide"
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="123456"
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
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-5 text-sm text-slate-600">
          Chua co tai khoan?{" "}
          <button
            className="font-semibold text-tide"
            onClick={() => navigateTo("/register")}
            type="button"
          >
            Dang ky tai day
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
