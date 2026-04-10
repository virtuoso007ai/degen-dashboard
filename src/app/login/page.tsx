"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("Şifre hatalı veya sunucu hatası.");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl"
      >
        <h1 className="text-lg font-semibold text-zinc-100 mb-1">Degen panel</h1>
        <p className="text-sm text-zinc-500 mb-6">Sadece sen: ortam şifresi</p>
        <label className="block text-sm text-zinc-400 mb-2">Şifre</label>
        <input
          type="password"
          autoComplete="current-password"
          className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100 mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-700 py-2 text-sm font-medium hover:bg-emerald-600 disabled:opacity-50"
        >
          {loading ? "…" : "Giriş"}
        </button>
      </form>
    </div>
  );
}
