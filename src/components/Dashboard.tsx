"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import StrategyCreator from "./StrategyCreator";
import StrategyList from "./StrategyList";

/* ---------- types ---------- */

type ActivityEntry = {
  id: string;
  at: string;
  kind:
    | "open"
    | "close"
    | "modify"
    | "deposit"
    | "withdraw"
    | "cancel_limit"
    | "cancel_open_orders";
  alias: string;
  pair?: string;
  side?: string;
  size?: string;
  leverage?: number;
  ok: boolean;
  detail: string;
};

type SnapPosition = {
  pair?: string;
  side?: string;
  entryPrice?: string;
  markPrice?: string;
  leverage?: number;
  margin?: string;
  notionalSize?: string;
  unrealizedPnl?: string;
  liquidationPrice?: string | null;
  createdAt?: string;
};

type SnapAgent = {
  alias: string;
  label?: string;
  wallet: string | null;
  error: string | null;
  positions: SnapPosition[];
  account: {
    hlBalance?: string;
    withdrawableBalance?: string;
    hlAddress?: string;
  } | null;
};

type Snapshot = { fetchedAt: string; agents: SnapAgent[] };

type OpenOrder = {
  coin: string;
  side: string;
  limitPx: string;
  sz: string;
  oid: number;
  timestamp: number;
  origSz: string;
};

type OpenOrderAgent = {
  alias: string;
  label?: string;
  wallet: string | null;
  error: string | null;
  orders: OpenOrder[];
};

type OpenOrdersSnapshot = {
  fetchedAt: string;
  agents: OpenOrderAgent[];
};

type LbOurs = { alias: string; label?: string; rank: number | null };
type LbRow = {
  name?: string;
  performance?: {
    rank?: number;
    compositeScore?: number;
    totalRealizedPnl?: number;
  };
};
type LeaderboardFull = {
  season?: { name?: string };
  total?: number;
  rows?: LbRow[];
  ours?: LbOurs[];
};

type MainTab = "ozet" | "pozisyonlar" | "acik-limitler" | "stratejiler" | "islemler" | "siralama";

type HlReadinessRow = { alias: string; ready: boolean; missing: string[] };
type HlReadiness = { allReady: boolean; agents: HlReadinessRow[] };

/* ---------- helpers ---------- */

function isLong(s: string | undefined): boolean {
  return String(s ?? "").toLowerCase() === "long";
}

function pnlTone(u: string | undefined): string {
  const n = parseFloat(String(u ?? "").replace(/,/g, ""));
  if (!Number.isFinite(n)) return "text-zinc-400";
  if (n > 0) return "text-emerald-400";
  if (n < 0) return "text-rose-400";
  return "text-zinc-400";
}

function fmtNum(v: string | number | undefined | null, fallback = "—"): string {
  if (v == null || v === "") return fallback;
  const n = parseFloat(String(v).replace(/,/g, ""));
  if (!Number.isFinite(n)) return fallback;
  if (Math.abs(n) >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (Math.abs(n) >= 1) return n.toFixed(4).replace(/\.?0+$/, "");
  return String(v);
}

const KIND_LABELS: Record<string, { text: string; cls: string }> = {
  open: { text: "OPEN", cls: "text-emerald-400" },
  close: { text: "CLOSE", cls: "text-rose-400" },
  modify: { text: "MODIFY", cls: "text-amber-400" },
  deposit: { text: "DEPOSIT", cls: "text-sky-400" },
  withdraw: { text: "WITHDRAW", cls: "text-violet-400" },
  cancel_limit: { text: "CANCEL LMT", cls: "text-orange-400" },
  cancel_open_orders: { text: "CANCEL ALL", cls: "text-orange-300" },
};

async function apiPost(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: j };
}

/* ---------- component ---------- */

export function Dashboard() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [snapErr, setSnapErr] = useState("");
  const [openOrders, setOpenOrders] = useState<OpenOrdersSnapshot | null>(null);
  const [openOrdersErr, setOpenOrdersErr] = useState("");
  const [lb, setLb] = useState<LeaderboardFull | null>(null);
  const [lbErr, setLbErr] = useState("");
  const [mainTab, setMainTab] = useState<MainTab>("pozisyonlar");
  const [positionFilter, setPositionFilter] = useState("");
  const [logTick, setLogTick] = useState(0);

  // trade form
  const [alias, setAlias] = useState("");
  const [pair, setPair] = useState("ETH");
  const [side, setSide] = useState<"long" | "short">("long");
  const [size, setSize] = useState("50");
  const [lev, setLev] = useState(5);
  const [openSL, setOpenSL] = useState("");
  const [openTP, setOpenTP] = useState("");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitPrice, setLimitPrice] = useState("");
  const [openForAllAgents, setOpenForAllAgents] = useState(false);
  const [tradeMsg, setTradeMsg] = useState("");

  // confirmation dialog
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    details: string[];
    onConfirm: () => Promise<void>;
  } | null>(null);

  // toast notifications
  const [toasts, setToasts] = useState<Array<{
    id: string;
    type: "success" | "error" | "info";
    message: string;
  }>>([]);

  // modify state
  const [modifyKey, setModifyKey] = useState<string | null>(null);
  const [modSL, setModSL] = useState("");
  const [modTP, setModTP] = useState("");
  const [modLev, setModLev] = useState("");
  const [modMsg, setModMsg] = useState("");

  // strategy creator modal
  const [showStrategyCreator, setShowStrategyCreator] = useState(false);

  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [cancellingOrderKey, setCancellingOrderKey] = useState<string | null>(null);
  const [cancellingAllPair, setCancellingAllPair] = useState(false);
  const [hlReadiness, setHlReadiness] = useState<HlReadiness | null>(null);
  
  const loadActivity = useCallback(async () => {
    try {
      const res = await fetch("/api/activity", { cache: "no-store" });
      console.log("[Dashboard] Activity API response status:", res.status);
      if (res.ok) {
        const json = await res.json();
        console.log("[Dashboard] Activity fetched:", json.activities?.length || 0, "entries");
        setActivityLog(json.activities || []);
      } else {
        const text = await res.text();
        console.error("[Dashboard] Activity API error:", res.status, text);
      }
    } catch (e) {
      console.error("[Dashboard] Activity load error:", e);
    }
  }, []);

  useEffect(() => { loadActivity(); }, [logTick]);
  const bumpLog = () => setLogTick((t) => t + 1);

  /* ---------- data fetching ---------- */

  const loadSnap = useCallback(async () => {
    setSnapErr("");
    const res = await fetch("/api/snapshot", { cache: "no-store" });
    if (res.status === 401) { window.location.href = "/login"; return; }
    if (!res.ok) { setSnapErr((await res.text()) || "snapshot hata"); return; }
    setSnap(await res.json());
  }, []);

  const loadLb = useCallback(async () => {
    setLbErr("");
    const res = await fetch("/api/leaderboard", { cache: "no-store" });
    if (res.status === 401) { window.location.href = "/login"; return; }
    if (!res.ok) { setLbErr((await res.text()) || "leaderboard hata"); return; }
    setLb(await res.json());
  }, []);

  const loadOpenOrders = useCallback(async () => {
    setOpenOrdersErr("");
    try {
      const res = await fetch("/api/open-orders", { cache: "no-store" });
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok) { setOpenOrdersErr((await res.text()) || "open orders hata"); return; }
      setOpenOrders(await res.json());
    } catch (e) {
      setOpenOrdersErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    loadSnap();
    loadLb();
    loadOpenOrders();
    const t = setInterval(loadSnap, 15_000);
    const t2 = setInterval(loadOpenOrders, 15_000);
    return () => { clearInterval(t); clearInterval(t2); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/trade/hl-readiness", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: HlReadiness | null) => {
        if (!cancelled && j?.agents) setHlReadiness(j);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!snap?.agents.length) return;
    setAlias((prev) => prev || snap.agents[0].alias);
  }, [snap]);

  /* ---------- actions ---------- */

  function showToast(type: "success" | "error" | "info", message: string) {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function openPos(e: React.FormEvent) {
    e.preventDefault();
    setTradeMsg("");
    const base: Record<string, unknown> = { pair, side, size, leverage: lev };
    if (openSL.trim()) base.stopLoss = openSL.trim();
    if (openTP.trim()) base.takeProfit = openTP.trim();
    if (orderType === "limit") {
      base.orderType = "limit";
      if (limitPrice.trim()) base.limitPrice = limitPrice.trim();
    }

    const details = openForAllAgents
      ? [
          `Tüm agentlar (${aliases.length}): ${aliases.join(", ")}`,
          `Parite: ${pair} ${side.toUpperCase()}`,
          `Size: ${size} USDC notional | Kaldıraç: ${lev}x`,
        ]
      : [
          `Agent: ${alias}`,
          `Parite: ${pair} ${side.toUpperCase()}`,
          `Size: ${size} USDC notional | Kaldıraç: ${lev}x`,
        ];
    if (openSL.trim()) details.push(`Stop Loss: ${openSL}`);
    if (openTP.trim()) details.push(`Take Profit: ${openTP}`);
    if (orderType === "limit") details.push(`Limit: ${limitPrice || "—"}`);

    setConfirmAction({
      title: openForAllAgents ? "Tüm agentlara aynı emir (HL v2)" : "Pozisyon açılsın mı?",
      details,
      onConfirm: async () => {
        if (openForAllAgents) {
          const { ok, data } = await apiPost("/api/trade/open-multi", { ...base, allAgents: true });
          const results = (data as { results?: { alias: string; ok: boolean; error?: string }[] })?.results;
          const summary = (data as { summary?: { ok: number; total: number } })?.summary;
          let msg: string;
          if (!ok) {
            const errBody = data as { error?: string };
            msg = `Hata: ${errBody.error ?? JSON.stringify(data).slice(0, 400)}`;
          } else if (results && summary) {
            const bad = results.filter((r) => !r.ok);
            msg =
              bad.length === 0
                ? `${summary.ok}/${summary.total} agent: emir gönderildi (HL v2)`
                : `${summary.ok}/${summary.total} OK; hata: ${bad.map((b) => `${b.alias}${b.error ? ` (${b.error.slice(0, 80)})` : ""}`).join("; ")}`;
          } else {
            msg = "Yanıt beklenmedik";
          }
          setTradeMsg(msg);
          showToast(summary && summary.ok > 0 ? "success" : "error", msg);
          bumpLog();
          if (summary && summary.ok > 0) loadSnap();
        } else {
          const payload = { ...base, alias };
          const { ok, data } = await apiPost("/api/trade/open", payload);
          const msg = ok ? "Emir gönderildi (HL v2)" : `Hata: ${(data as { error?: string }).error ?? "?"}`;
          setTradeMsg(msg);
          showToast(ok ? "success" : "error", msg);
          bumpLog();
          if (ok) loadSnap();
        }
      },
    });
  }

  async function closePos(a: string, p: string) {
    setTradeMsg("");
    setConfirmAction({
      title: "Pozisyon kapatılsın mı?",
      details: [`Agent: ${a}`, `Parite: ${p}`],
      onConfirm: async () => {
        const { ok, data } = await apiPost("/api/trade/close", { alias: a, pair: p });
        const msg = ok ? "Kapatma gönderildi (HL v2)" : `Kapatma: ${data.error ?? "?"}`;
        setTradeMsg(msg);
        showToast(ok ? "success" : "error", msg);
        bumpLog();
        if (ok) loadSnap();
      },
    });
  }

  async function modifyPos(a: string, p: string) {
    setModMsg("");
    const body: Record<string, unknown> = { alias: a, pair: p };
    if (modSL.trim()) body.stopLoss = modSL.trim();
    if (modTP.trim()) body.takeProfit = modTP.trim();
    if (modLev.trim()) {
      const l = parseInt(modLev.trim(), 10);
      if (Number.isFinite(l) && l >= 1) body.leverage = l;
    }
    const details = [`Agent: ${a}`, `Parite: ${p}`];
    if (modSL.trim()) details.push(`Stop Loss: ${modSL}`);
    if (modTP.trim()) details.push(`Take Profit: ${modTP}`);
    if (modLev.trim()) details.push(`Yeni Kaldıraç: ${modLev}x`);

    setConfirmAction({
      title: "Pozisyon modify edilsin mi?",
      details,
      onConfirm: async () => {
        const { ok, data } = await apiPost("/api/trade/modify", body);
        const msg = ok ? "Modify gönderildi (HL v2)" : `Modify: ${data.error ?? "?"}`;
        setModMsg(msg);
        showToast(ok ? "success" : "error", msg);
        bumpLog();
        if (ok) { setModifyKey(null); setModSL(""); setModTP(""); setModLev(""); loadSnap(); }
      },
    });
  }

  /* ---------- derived ---------- */

  const aliases = snap?.agents.map((x) => x.alias) ?? [];
  const visibleAgents = snap?.agents.filter((a) => !positionFilter || a.alias === positionFilter) ?? [];
  const totalOpen = snap?.agents.reduce((s, a) => s + a.positions.length, 0) ?? 0;
  const unrealizedSum = useMemo(() => {
    if (!snap) return null;
    let s = 0, n = 0;
    for (const a of snap.agents) for (const p of a.positions) {
      const v = parseFloat(String(p.unrealizedPnl ?? "").replace(/,/g, ""));
      if (Number.isFinite(v)) { s += v; n += 1; }
    }
    return { sum: s, count: n };
  }, [snap]);
  const totalBalance = useMemo(() => {
    if (!snap) return null;
    let hl = 0, w = 0;
    for (const a of snap.agents) {
      if (!a.account) continue;
      const h = parseFloat(String(a.account.hlBalance ?? "").replace(/,/g, ""));
      const ww = parseFloat(String(a.account.withdrawableBalance ?? "").replace(/,/g, ""));
      if (Number.isFinite(h)) hl += h;
      if (Number.isFinite(ww)) w += ww;
    }
    return { hlBalance: hl, withdrawable: w };
  }, [snap]);

  /* ================================================================== */
  /*  RENDER                                                            */
  /* ================================================================== */

  const selectCls = "rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm";
  const inputCls = "rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 font-mono text-sm";
  const btnAmber = "rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-amber-400";

  return (
    <div className="min-h-screen bg-[#070708] text-zinc-100">
      {/* ---- header ---- */}
      <div className="border-b border-amber-500/10 bg-gradient-to-r from-zinc-950 via-zinc-900/90 to-zinc-950">
        <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 text-lg font-black border border-amber-500/25">
              ◆
            </span>
            <div>
              <h1 className="text-lg font-bold tracking-[0.2em] text-amber-100/95">DEGEN PANEL</h1>
              <p className="text-xs text-zinc-500">
                {snap?.fetchedAt ? `Son yenileme · ${new Date(snap.fetchedAt).toLocaleString()}` : "Yükleniyor…"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              type="button" 
              onClick={() => setShowStrategyCreator(true)} 
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 shadow-lg shadow-cyan-500/20"
            >
              Strategy Bot
            </button>
            <button type="button" onClick={() => { loadSnap(); loadLb(); loadOpenOrders(); }} className="rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 shadow-lg shadow-amber-500/10">Yenile</button>
            <button type="button" onClick={logout} className="rounded-lg border border-zinc-700 bg-zinc-900/80 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800">Çıkış</button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        {/* ---- tabs ---- */}
        <nav className="mb-8 flex flex-wrap gap-2 border-b border-zinc-800/80 pb-1">
          {([
            ["ozet", "Özet"],
            ["pozisyonlar", `Pozisyonlar (${totalOpen})`],
            ["acik-limitler", `Açık Limitler (${openOrders?.agents.reduce((sum, a) => sum + a.orders.length, 0) ?? 0})`],
            ["stratejiler", "Stratejiler"],
            ["islemler", `İşlemler (${activityLog.length})`],
            ["siralama", "Sıralama"],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setMainTab(id)}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${mainTab === id ? "bg-zinc-800/90 text-amber-200 border border-b-0 border-amber-500/30 -mb-px" : "text-zinc-500 hover:text-zinc-300"}`}>
              {label}
            </button>
          ))}
        </nav>

        {snapErr && <p className="mb-4 rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-red-300 text-sm">{snapErr}</p>}

        {hlReadiness && !hlReadiness.allReady && (
          <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-sm text-amber-100/95">
            <p className="font-semibold text-amber-200">HL v2: aşağıdaki agentlarda imza anahtarı veya master adres yok — trade API emir göndermez.</p>
            <ul className="mt-2 list-disc pl-5 text-xs text-zinc-300 space-y-1">
              {hlReadiness.agents
                .filter((a) => !a.ready)
                .map((a) => (
                  <li key={a.alias}>
                    <span className="font-mono text-amber-200">{a.alias}</span>
                    {a.missing.length > 0 ? ` → eksik: ${a.missing.join(", ")}` : ""}
                  </li>
                ))}
            </ul>
            <p className="mt-2 text-[11px] text-zinc-500">
              Vercel Environment: Telegram ile aynı <code className="text-zinc-400">AGENTS_JSON</code> ve her trade agent için{" "}
              <code className="text-zinc-400">HL_API_WALLET_KEY_FRIDAY</code> gibi (alias büyük harf).
            </p>
          </div>
        )}

        {/* ================================================================ */}
        {/*  ÖZET                                                           */}
        {/* ================================================================ */}
        {mainTab === "ozet" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Agent" value={String(snap?.agents.length ?? "—")} />
              <StatCard label="Açık pozisyon" value={String(totalOpen)} amber />
              <StatCard label="Tahmini uPnL Σ" value={unrealizedSum ? unrealizedSum.sum.toFixed(4) : "—"}
                cls={unrealizedSum && unrealizedSum.sum > 0 ? "text-emerald-400" : unrealizedSum && unrealizedSum.sum < 0 ? "text-rose-400" : undefined} />
              <StatCard label="HL Bakiye Σ" value={totalBalance ? totalBalance.hlBalance.toFixed(2) : "—"} sub={totalBalance ? `Çekilebilir: ${totalBalance.withdrawable.toFixed(2)}` : undefined} />
            </div>

            {/* agent balances grid */}
            <div>
              <h2 className="text-sm font-semibold text-zinc-300 mb-3">Agent Bakiyeleri</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {snap?.agents.map((a) => (
                  <div key={a.alias} className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-amber-200 text-sm">{a.alias}</span>
                      <span className="text-[10px] text-zinc-500">{a.positions.length} poz</span>
                    </div>
                    {a.label && <p className="text-xs text-zinc-500 -mt-1 mb-2">{a.label}</p>}
                    {a.account ? (
                      <div className="grid grid-cols-2 gap-1 text-xs text-zinc-400">
                        <span>HL Bakiye</span><span className="font-mono text-zinc-200">{fmtNum(a.account.hlBalance)}</span>
                        <span>Çekilebilir</span><span className="font-mono text-zinc-200">{fmtNum(a.account.withdrawableBalance)}</span>
                      </div>
                    ) : a.error ? (
                      <p className="text-xs text-amber-400">{a.error}</p>
                    ) : (
                      <p className="text-xs text-zinc-600">Hesap bilgisi yok</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* quick trade in ozet */}
            <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-b from-zinc-900/80 to-zinc-950 p-5 max-w-lg shadow-xl">
              <h2 className="text-sm font-semibold text-amber-200/90 mb-4">Yeni pozisyon</h2>
              <form onSubmit={openPos} className="space-y-3">
                <label className="block text-xs text-zinc-500">Agent
                  <select
                    className={`mt-1 w-full ${selectCls}`}
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    required={!openForAllAgents}
                    disabled={openForAllAgents}
                  >
                    <option value="">—</option>
                    {aliases.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded border-zinc-600"
                    checked={openForAllAgents}
                    onChange={(e) => setOpenForAllAgents(e.target.checked)}
                  />
                  Tüm agentlara aynı emir (her birinde hlApiWalletKey gerekli)
                </label>
                <label className="block text-xs text-zinc-500">Parite
                  <input className={`mt-1 w-full ${inputCls} uppercase`} value={pair} onChange={(e) => setPair(e.target.value)} />
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <label className="text-xs text-zinc-500">Yön
                    <select className={`mt-1 w-full ${selectCls}`} value={side} onChange={(e) => setSide(e.target.value as "long" | "short")}>
                      <option value="long">long</option><option value="short">short</option>
                    </select>
                  </label>
                  <label className="text-xs text-zinc-500">Size (USDC)
                    <input className={`mt-1 w-full ${inputCls}`} value={size} onChange={(e) => setSize(e.target.value)} title="USDC notional" />
                  </label>
                  <label className="text-xs text-zinc-500">Kal.
                    <input type="number" min={1} className={`mt-1 w-full ${inputCls}`} value={lev} onChange={(e) => setLev(Number(e.target.value))} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-zinc-500">Stop Loss
                    <input className={`mt-1 w-full ${inputCls}`} placeholder="opsiyonel" value={openSL} onChange={(e) => setOpenSL(e.target.value)} />
                  </label>
                  <label className="text-xs text-zinc-500">Take Profit
                    <input className={`mt-1 w-full ${inputCls}`} placeholder="opsiyonel" value={openTP} onChange={(e) => setOpenTP(e.target.value)} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-zinc-500">Stop Loss
                    <input className={`mt-1 w-full ${inputCls}`} placeholder="opsiyonel" value={openSL} onChange={(e) => setOpenSL(e.target.value)} />
                  </label>
                  <label className="text-xs text-zinc-500">Take Profit
                    <input className={`mt-1 w-full ${inputCls}`} placeholder="opsiyonel" value={openTP} onChange={(e) => setOpenTP(e.target.value)} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-zinc-500">Emir Tipi
                    <select className={`mt-1 w-full ${selectCls}`} value={orderType} onChange={(e) => setOrderType(e.target.value as "market" | "limit")}>
                      <option value="market">Market</option><option value="limit">Limit</option>
                    </select>
                  </label>
                  {orderType === "limit" && (
                    <label className="text-xs text-zinc-500">Limit Fiyat
                      <input className={`mt-1 w-full ${inputCls}`} placeholder="fiyat" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} />
                    </label>
                  )}
                </div>
                <button type="submit" className={`w-full ${btnAmber}`}>Pozisyon aç</button>
              </form>
              {tradeMsg && <p className="mt-3 text-xs text-zinc-400">{tradeMsg}</p>}
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/*  POZİSYONLAR                                                    */}
        {/* ================================================================ */}
        {mainTab === "pozisyonlar" && (
          <>
            {/* quick trade bar */}
            <div className="mb-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-4">
              <h2 className="text-sm font-semibold text-zinc-300 mb-3">Hızlı işlem</h2>
              <form onSubmit={openPos} className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  <select
                    className={selectCls}
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    required={!openForAllAgents}
                    disabled={openForAllAgents}
                  >
                    {aliases.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <input className={`${inputCls} uppercase`} value={pair} onChange={(e) => setPair(e.target.value)} placeholder="Parite" />
                  <select className={selectCls} value={side} onChange={(e) => setSide(e.target.value as "long" | "short")}>
                    <option value="long">long</option><option value="short">short</option>
                  </select>
                  <input className={inputCls} value={size} onChange={(e) => setSize(e.target.value)} placeholder="USDC notional" title="USDC notional" />
                  <input type="number" min={1} className={inputCls} value={lev} onChange={(e) => setLev(Number(e.target.value))} placeholder="Lev" />
                  <button type="submit" className={`${btnAmber} md:col-span-1`}>Aç</button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <input className={inputCls} placeholder="Stop Loss" value={openSL} onChange={(e) => setOpenSL(e.target.value)} />
                  <input className={inputCls} placeholder="Take Profit" value={openTP} onChange={(e) => setOpenTP(e.target.value)} />
                  <select className={selectCls} value={orderType} onChange={(e) => setOrderType(e.target.value as "market" | "limit")}>
                    <option value="market">Market</option><option value="limit">Limit</option>
                  </select>
                  {orderType === "limit" && (
                    <input className={inputCls} placeholder="Limit Fiyat" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} />
                  )}
                </div>
                <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded border-zinc-600"
                    checked={openForAllAgents}
                    onChange={(e) => setOpenForAllAgents(e.target.checked)}
                  />
                  Tüm agentlara aynı emir
                </label>
              </form>
              {tradeMsg && <p className="mt-2 text-xs text-zinc-500">{tradeMsg}</p>}
            </div>

            <div className="mb-6 rounded-2xl border border-zinc-700/80 bg-zinc-900/40 p-4">
              <h2 className="text-sm font-semibold text-zinc-300 mb-2">Marj: deposit / withdraw</h2>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Panel HL v2 ile sadece perp işlem yapıyor; ACP <code className="text-zinc-400">perp_deposit</code> /{" "}
                <code className="text-zinc-400">perp_withdraw</code> kaldırıldı. Marj için{" "}
                <code className="text-zinc-400">acp-cli</code>, Hyperliquid arayüzü veya cüzdan transferi kullanın.
              </p>
            </div>

            {/* filters */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-500">Filtre:</span>
              <button type="button" onClick={() => setPositionFilter("")}
                className={`rounded-full px-3 py-1 text-xs font-medium ${positionFilter === "" ? "bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                Tümü ({snap?.agents.length ?? 0})
              </button>
              {aliases.map((a) => (
                <button key={a} type="button" onClick={() => setPositionFilter(a)}
                  className={`rounded-full px-3 py-1 text-xs font-mono ${positionFilter === a ? "bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                  {a}
                </button>
              ))}
            </div>

            {/* position cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {snap?.agents.length === 0 && <p className="text-zinc-500 col-span-full">Agent yok.</p>}
              {visibleAgents.map((a) =>
                a.positions.length === 0 ? (
                  <div key={`${a.alias}-empty`} className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-4">
                    <span className="font-mono text-amber-200 text-sm">@{a.alias}</span>
                    {a.label && <span className="text-xs text-zinc-500 ml-2">{a.label}</span>}
                    <p className="text-xs text-zinc-600 mt-2">Açık pozisyon yok</p>
                    {a.account && (
                      <p className="text-xs text-zinc-500 mt-1">HL: {fmtNum(a.account.hlBalance)} · Çekilebilir: {fmtNum(a.account.withdrawableBalance)}</p>
                    )}
                  </div>
                ) : a.positions.map((p, idx) => {
                  const sym = (p.pair ?? "?").toUpperCase();
                  const long = isLong(p.side);
                  const cardKey = `${a.alias}-${sym}-${idx}`;
                  const isModifying = modifyKey === cardKey;

                  return (
                    <div key={cardKey} className="flex rounded-2xl overflow-hidden border border-zinc-800/90 bg-zinc-900/50 shadow-xl shadow-black/40">
                      <div className={`w-1.5 shrink-0 ${long ? "bg-emerald-500" : "bg-rose-500"}`} />
                      <div className="flex-1 p-4 min-w-0">
                        {/* header */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xl font-bold tracking-tight text-zinc-50">{sym}</span>
                              <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${long ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"}`}>
                                {p.side ?? "?"}
                              </span>
                              <span className="text-[11px] text-zinc-500 font-mono">@{a.alias}</span>
                            </div>
                            {a.label && <p className="text-xs text-zinc-600 mt-0.5">{a.label}</p>}
                          </div>
                          <span className={`text-sm font-mono font-semibold shrink-0 ${pnlTone(p.unrealizedPnl)}`}>
                            u {p.unrealizedPnl ?? "—"}
                          </span>
                        </div>

                        {/* data grid */}
                        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-zinc-400">
                          <span>Giriş <span className="text-zinc-200 font-mono">{fmtNum(p.entryPrice)}</span></span>
                          <span>Mark <span className="text-zinc-200 font-mono">{fmtNum(p.markPrice)}</span></span>
                          <span>Kal. <span className="text-zinc-200 font-mono">{p.leverage ?? "?"}x</span></span>
                          <span>N <span className="text-zinc-200 font-mono">{fmtNum(p.notionalSize)}</span></span>
                          <span>Margin <span className="text-zinc-200 font-mono">{fmtNum(p.margin)}</span></span>
                          <span>Liq. <span className={`font-mono ${p.liquidationPrice ? "text-orange-300" : "text-zinc-600"}`}>
                            {p.liquidationPrice ? fmtNum(p.liquidationPrice) : "N/A"}
                          </span></span>
                        </div>

                        {a.error && <p className="mt-2 text-xs text-amber-400">{a.error}</p>}

                        {/* modify inline form */}
                        {isModifying && (
                          <div className="mt-3 rounded-xl border border-amber-500/30 bg-zinc-950/80 p-3 space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                              <label className="text-[10px] text-zinc-500">Stop Loss
                                <input className={`mt-0.5 w-full ${inputCls} text-xs`} placeholder="—" value={modSL} onChange={(e) => setModSL(e.target.value)} />
                              </label>
                              <label className="text-[10px] text-zinc-500">Take Profit
                                <input className={`mt-0.5 w-full ${inputCls} text-xs`} placeholder="—" value={modTP} onChange={(e) => setModTP(e.target.value)} />
                              </label>
                              <label className="text-[10px] text-zinc-500">Kaldıraç
                                <input type="number" min={1} className={`mt-0.5 w-full ${inputCls} text-xs`} placeholder={String(p.leverage ?? "—")} value={modLev} onChange={(e) => setModLev(e.target.value)} />
                              </label>
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => modifyPos(a.alias, sym)}
                                className="flex-1 rounded-lg bg-amber-600 py-1.5 text-xs font-semibold text-white hover:bg-amber-500">Uygula</button>
                              <button type="button" onClick={() => { setModifyKey(null); setModMsg(""); }}
                                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800">İptal</button>
                            </div>
                            {modMsg && <p className="text-[10px] text-zinc-400">{modMsg}</p>}
                          </div>
                        )}

                        {/* action buttons */}
                        <div className="mt-3 flex gap-2">
                          <button type="button" onClick={() => {
                            if (isModifying) { setModifyKey(null); }
                            else { setModifyKey(cardKey); setModSL(""); setModTP(""); setModLev(""); setModMsg(""); }
                          }}
                            className={`flex-1 rounded-xl border py-2 text-xs font-semibold ${isModifying ? "border-amber-500/40 bg-amber-950/60 text-amber-200" : "border-amber-800/60 bg-amber-950/40 text-amber-300 hover:bg-amber-950/70"}`}>
                            {isModifying ? "Gizle" : "Modify"}
                          </button>
                          <button type="button" onClick={() => closePos(a.alias, sym)}
                            className="flex-1 rounded-xl bg-rose-950/80 border border-rose-800/60 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-900/80">
                            Kapat
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {visibleAgents.length > 0 && !visibleAgents.some((a) => a.positions.length > 0) && (
                <p className="text-zinc-500 col-span-full text-center py-12 rounded-2xl border border-dashed border-zinc-800">
                  Bu görünümde açık pozisyon yok.
                </p>
              )}
            </div>
          </>
        )}

        {/* ================================================================ */}
        {/*  İŞLEMLER                                                       */}
        {/* ================================================================ */}
        {mainTab === "islemler" && (
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3 bg-zinc-950/50">
              <p className="text-sm text-zinc-400">İşlem geçmişi (Upstash Redis).</p>
              <button type="button" onClick={async () => { 
                await fetch("/api/activity/clear", { method: "POST" }); 
                bumpLog(); 
                showToast("info", "İşlem geçmişi temizlendi");
              }} className="text-xs text-rose-400 hover:text-rose-300">Logları temizle</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-800 text-xs uppercase tracking-wide">
                    <th className="px-4 py-3">Zaman</th>
                    <th className="px-4 py-3">İşlem</th>
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Parite</th>
                    <th className="px-4 py-3">Durum</th>
                    <th className="px-4 py-3">Detay</th>
                  </tr>
                </thead>
                <tbody>
                  {activityLog.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">Henüz kayıt yok.</td></tr>
                  )}
                  {activityLog.map((row: ActivityEntry) => {
                    const kl = KIND_LABELS[row.kind] ?? { text: row.kind, cls: "text-zinc-400" };
                    return (
                      <tr key={row.id} className="border-b border-zinc-800/60 hover:bg-zinc-800/30">
                        <td className="px-4 py-2 text-xs text-zinc-500 whitespace-nowrap">{new Date(row.at).toLocaleString()}</td>
                        <td className="px-4 py-2 font-mono text-xs"><span className={kl.cls}>{kl.text}</span></td>
                        <td className="px-4 py-2 font-mono text-amber-200/90">{row.alias}</td>
                        <td className="px-4 py-2 font-mono">{row.pair}</td>
                        <td className="px-4 py-2">{row.ok ? <span className="text-emerald-400">OK</span> : <span className="text-rose-400">Hata</span>}</td>
                        <td className="px-4 py-2 text-xs text-zinc-500 max-w-md truncate font-mono" title={row.detail}>{row.detail}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/*  AÇIK LİMİTLER                                                  */}
        {/* ================================================================ */}
        {mainTab === "acik-limitler" && (
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3 bg-zinc-950/50">
              <p className="text-sm text-zinc-400">
                Açık limit emirleri — üstteki trade formundaki <span className="font-mono text-zinc-300">agent</span> ve{" "}
                <span className="font-mono text-zinc-300">parite</span> ile aynı ağ (<code className="text-zinc-500">HYPERLIQUID_INFO_URL</code> / varsayılan mainnet).
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={cancellingAllPair || !alias || !pair.trim()}
                  onClick={async () => {
                    const p = pair.trim().toUpperCase();
                    if (!alias || !p) return;
                    setCancellingAllPair(true);
                    try {
                      const { ok, data } = await apiPost("/api/trade/cancel-open-orders", {
                        alias,
                        pair: p,
                      });
                      const err = (data as { error?: string })?.error;
                      const res = data as { cancelled?: number; oids?: number[]; errors?: string[] };
                      if (ok && !err) {
                        const n = res.cancelled ?? 0;
                        showToast(
                          "success",
                          n > 0
                            ? `${n} emir iptal edildi (${alias} · ${p})`
                            : `Açık emir yok (${alias} · ${p})`
                        );
                        bumpLog();
                        await loadOpenOrders();
                      } else {
                        showToast("error", err || "Toplu iptal başarısız");
                      }
                    } catch (e) {
                      showToast("error", e instanceof Error ? e.message : String(e));
                    } finally {
                      setCancellingAllPair(false);
                    }
                  }}
                  className="text-xs text-orange-300 hover:text-orange-200 border border-orange-500/35 px-2 py-1 rounded disabled:opacity-40"
                >
                  {cancellingAllPair ? "…" : `Tümünü iptal (${alias || "—"} · ${pair.trim().toUpperCase() || "—"})`}
                </button>
                <button type="button" onClick={loadOpenOrders} className="text-xs text-amber-400 hover:text-amber-300">
                  Yenile
                </button>
              </div>
            </div>
            {openOrdersErr && <p className="px-4 py-3 text-red-400 text-sm">{openOrdersErr}</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-800 text-xs uppercase tracking-wide">
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Parite</th>
                    <th className="px-4 py-3">Yön</th>
                    <th className="px-4 py-3">Limit Fiyat</th>
                    <th className="px-4 py-3">Miktar</th>
                    <th className="px-4 py-3">Zaman</th>
                    <th className="px-4 py-3">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {openOrders?.agents.every(a => a.orders.length === 0) && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500">Açık limit emri yok.</td></tr>
                  )}
                  {openOrders?.agents.flatMap(agent => 
                    agent.orders.map(order => (
                      <tr key={`${agent.alias}-${order.oid}`} className="border-b border-zinc-800/60 hover:bg-zinc-800/30">
                        <td className="px-4 py-2 font-mono text-amber-200/90">{agent.alias}</td>
                        <td className="px-4 py-2 font-mono">{order.coin}</td>
                        <td className="px-4 py-2">
                          <span className={order.side === "B" ? "text-emerald-400" : "text-rose-400"}>
                            {order.side === "B" ? "LONG" : "SHORT"}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-mono">{order.limitPx}</td>
                        <td className="px-4 py-2 font-mono">{order.sz}</td>
                        <td className="px-4 py-2 text-xs text-zinc-500 whitespace-nowrap">
                          {new Date(order.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-2">
                          <button 
                            type="button"
                            disabled={cancellingOrderKey === `${agent.alias}-${order.oid}`}
                            onClick={async () => {
                              const rowKey = `${agent.alias}-${order.oid}`;
                              setCancellingOrderKey(rowKey);
                              try {
                                const { ok, data } = await apiPost("/api/trade/cancel-limit", {
                                  alias: agent.alias,
                                  pair: order.coin,
                                  oid: order.oid,
                                });
                                const err = (data as { error?: string })?.error;
                                if (ok) {
                                  showToast("success", "Limit emri iptal edildi (HL v2)");
                                  bumpLog();
                                  await loadOpenOrders();
                                } else {
                                  showToast("error", err || "İptal başarısız");
                                }
                              } catch (e) {
                                showToast("error", e instanceof Error ? e.message : String(e));
                              } finally {
                                setCancellingOrderKey(null);
                              }
                            }}
                            className="text-xs text-rose-400 hover:text-rose-300 border border-rose-500/30 px-2 py-1 rounded disabled:opacity-40"
                          >
                            {cancellingOrderKey === `${agent.alias}-${order.oid}` ? "…" : "İptal"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/*  STRATEJİLER                                                    */}
        {/* ================================================================ */}
        {mainTab === "stratejiler" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/10 p-4">
              <h2 className="text-lg font-semibold text-cyan-300 mb-2">Trading Strategies</h2>
              <p className="text-sm text-zinc-400 mb-4">
                Manage automated trading strategies with technical indicators. 
                Strategies run every 15 minutes via Vercel Cron.
              </p>
              <button
                onClick={() => setShowStrategyCreator(true)}
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-sm shadow-lg shadow-cyan-500/20 transition-all"
              >
                + Create New Strategy
              </button>
            </div>

            <StrategyList />
          </div>
        )}

        {/* ================================================================ */}
        {/*  SIRALAMA                                                       */}
        {/* ================================================================ */}
        {mainTab === "siralama" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
              <h2 className="text-sm font-semibold text-zinc-300 mb-4">Senin agentlar</h2>
              {lbErr && <p className="text-red-400 text-sm">{lbErr}</p>}
              {lb?.ours && lb.ours.length > 0 && (
                <ul className="space-y-2">
                  {lb.ours.map((o) => (
                    <li key={o.alias}>
                      <button type="button" onClick={() => { setPositionFilter(o.alias); setMainTab("pozisyonlar"); }}
                        className="w-full text-left rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3 hover:border-amber-500/30">
                        <span className="font-mono text-amber-200">{o.alias}</span>
                        {o.label && <span className="text-xs text-zinc-500 ml-1">({o.label})</span>}
                        {o.rank != null ? <span className="text-zinc-400 text-sm"> · sıra #{o.rank}</span> : <span className="text-zinc-500 text-sm"> · listede yok</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
              <div className="flex justify-between mb-3">
                <h2 className="text-sm font-semibold text-zinc-300">İlk 15</h2>
                {lb?.season?.name && <span className="text-xs text-zinc-500">{lb.season.name}</span>}
              </div>
              <p className="text-xs text-zinc-500 mb-3">Toplam {lb?.total ?? "—"}</p>
              <div className="overflow-x-auto max-h-96 overflow-y-auto text-sm">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-zinc-500 border-b border-zinc-800 text-xs">
                      <th className="py-2 pr-2">#</th><th className="py-2 pr-2">Ad</th><th className="py-2">Skor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(lb?.rows ?? []).slice(0, 15).map((r, i) => (
                      <tr key={i} className="border-b border-zinc-800/50">
                        <td className="py-2 pr-2 font-mono text-zinc-500">{r.performance?.rank ?? i + 1}</td>
                        <td className="py-2 pr-2">{r.name ?? "—"}</td>
                        <td className="py-2 font-mono">{r.performance?.compositeScore ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================ */}
      {/*  CONFIRMATION DIALOG                                            */}
      {/* ================================================================ */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setConfirmAction(null)}>
          <div className="rounded-2xl border border-amber-500/30 bg-zinc-900 p-6 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-amber-100 mb-3">{confirmAction.title}</h3>
            <ul className="space-y-1 text-sm text-zinc-300 mb-5">
              {confirmAction.details.map((d, i) => <li key={i} className="font-mono text-xs">{d}</li>)}
            </ul>
            <div className="flex gap-3">
              <button type="button" onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }}
                className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-zinc-950 hover:bg-amber-400">
                Onayla
              </button>
              <button type="button" onClick={() => setConfirmAction(null)}
                className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-zinc-800">
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/*  TOAST NOTIFICATIONS                                            */}
      {/* ================================================================ */}
      <div className="fixed top-4 right-4 left-4 sm:left-auto z-50 space-y-2 sm:max-w-sm">
        {toasts.map((t) => {
          const colors = {
            success: "border-emerald-500/50 bg-emerald-950/90 text-emerald-200",
            error: "border-rose-500/50 bg-rose-950/90 text-rose-200",
            info: "border-sky-500/50 bg-sky-950/90 text-sky-200",
          };
          return (
            <div key={t.id} className={`rounded-xl border ${colors[t.type]} px-4 py-3 shadow-2xl backdrop-blur-sm animate-in slide-in-from-right`}>
              <p className="text-sm font-medium">{t.message}</p>
            </div>
          );
        })}
      </div>

      {/* ================================================================ */}
      {/*  STRATEGY CREATOR MODAL                                         */}
      {/* ================================================================ */}
      {showStrategyCreator && snap?.agents && (
        <StrategyCreator
          agents={snap.agents.map(a => ({ alias: a.alias, label: a.label }))}
          onClose={() => setShowStrategyCreator(false)}
        />
      )}
    </div>
  );
}

/* ---------- stat card ---------- */

function StatCard({ label, value, amber, cls, sub }: {
  label: string;
  value: string;
  amber?: boolean;
  cls?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 shadow-xl">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${cls ?? (amber ? "text-amber-200/90" : "text-zinc-100")}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
    </div>
  );
}
