import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Download, FileText, CheckCircle2, XCircle,
  AlertTriangle, ArrowRight, RefreshCw, Table2, FileSpreadsheet,
  Info, Trash2,
} from "lucide-react";
import { api } from "@/api/client";
import type { ImportRow } from "@/types";

const PORTFOLIO_LABELS: Record<string, string> = {
  stocks:             "Brokerage Stocks",
  etfs:               "Brokerage ETFs",
  retirement_stocks:  "Retirement Stocks",
  retirement_etfs:    "Retirement ETFs",
  watchlist:          "Watchlist",
};

const PORTFOLIO_COLORS: Record<string, string> = {
  stocks:             "bg-blue-500/20 text-blue-300",
  etfs:               "bg-violet-500/20 text-violet-300",
  retirement_stocks:  "bg-emerald-500/20 text-emerald-300",
  retirement_etfs:    "bg-teal-500/20 text-teal-300",
  watchlist:          "bg-amber-500/20 text-amber-300",
};

type Step = "idle" | "preview" | "success";
type ImportMode = "merge" | "replace";

export default function ImportExportPage() {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [mode, setMode] = useState<ImportMode>("merge");
  const [preview, setPreview] = useState<{ rows: ImportRow[]; errors: string[]; total: number } | null>(null);
  const [result, setResult] = useState<{ added: string[]; skipped: string[]; errors: string[]; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext ?? "")) {
      setError("Only CSV and Excel (.xlsx) files are supported.");
      return;
    }
    setError(null);
    setFile(f);
    setStep("idle");
    setPreview(null);
    setResult(null);
    setLoading(true);
    try {
      const data = await api.importPreview(f);
      setPreview(data);
      setStep("preview");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to parse file.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleConfirm = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.importConfirm(file, mode);
      setResult(data);
      setStep("success");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Import failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setStep("idle");
    setPreview(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  // Group preview rows by portfolio for the summary badge
  const portfolioCounts = preview?.rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.portfolio] = (acc[r.portfolio] ?? 0) + 1;
    return acc;
  }, {}) ?? {};

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-10">

        {/* ── Header ───────────────────────────────────────────── */}
        <div>
          <h1 className="text-3xl font-bold text-white">Import &amp; Export</h1>
          <p className="text-slate-400 mt-1">
            Bring in positions from any brokerage via CSV or Excel, or download your current holdings.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Left: Import ─────────────────────────────────── */}
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-400" /> Import Positions
            </h2>

            {/* Drop zone */}
            <AnimatePresence mode="wait">
              {step === "idle" && (
                <motion.div
                  key="dropzone"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                  className={`
                    relative rounded-xl border-2 border-dashed cursor-pointer transition-all
                    flex flex-col items-center justify-center gap-3 py-12 px-6 text-center
                    ${dragOver
                      ? "border-blue-400 bg-blue-500/10"
                      : "border-slate-600 bg-slate-800/40 hover:border-slate-400 hover:bg-slate-800/60"}
                  `}
                >
                  <div className="p-3 rounded-full bg-blue-500/15">
                    <Upload className="w-7 h-7 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-200">Drop your CSV or Excel file here</p>
                    <p className="text-sm text-slate-400 mt-0.5">or click to browse</p>
                  </div>
                  <p className="text-xs text-slate-500">.csv · .xlsx supported</p>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </motion.div>
              )}

              {step === "preview" && preview && (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden"
                >
                  {/* Preview header */}
                  <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-200 truncate max-w-[200px]">
                        {file?.name}
                      </span>
                    </div>
                    <button onClick={reset} className="text-slate-500 hover:text-slate-300">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Portfolio breakdown */}
                  <div className="px-5 py-3 flex flex-wrap gap-2 border-b border-slate-700">
                    {Object.entries(portfolioCounts).map(([k, n]) => (
                      <span key={k} className={`text-xs px-2 py-0.5 rounded-full font-medium ${PORTFOLIO_COLORS[k] ?? "bg-slate-500/20 text-slate-300"}`}>
                        {PORTFOLIO_LABELS[k] ?? k}: {n}
                      </span>
                    ))}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-600/40 text-slate-300 font-medium">
                      Total: {preview.total}
                    </span>
                  </div>

                  {/* Rows table */}
                  <div className="overflow-y-auto max-h-56">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-900/60 sticky top-0">
                        <tr className="text-slate-400">
                          <th className="text-left px-4 py-2 font-medium">Ticker</th>
                          <th className="text-left px-3 py-2 font-medium">Portfolio</th>
                          <th className="text-left px-3 py-2 font-medium">Brokerage</th>
                          <th className="text-right px-3 py-2 font-medium">Shares</th>
                          <th className="text-right px-3 py-2 font-medium">Cost</th>
                          <th className="text-left px-3 py-2 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row, i) => (
                          <tr key={i} className="border-t border-slate-700/50 hover:bg-slate-700/20">
                            <td className="px-4 py-1.5 font-mono font-semibold text-blue-300">{row.ticker}</td>
                            <td className="px-3 py-1.5 text-slate-300">{PORTFOLIO_LABELS[row.portfolio] ?? row.portfolio}</td>
                            <td className="px-3 py-1.5 text-slate-400">{row.brokerage || "—"}</td>
                            <td className="px-3 py-1.5 text-right text-slate-200">{row.shares.toLocaleString()}</td>
                            <td className="px-3 py-1.5 text-right text-slate-200">${row.cost_per_share.toFixed(2)}</td>
                            <td className="px-3 py-1.5 text-slate-400">{row.purchase_date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Errors */}
                  {preview.errors.length > 0 && (
                    <div className="px-5 py-3 border-t border-amber-700/30 bg-amber-500/5">
                      <p className="text-xs font-semibold text-amber-400 flex items-center gap-1 mb-1">
                        <AlertTriangle className="w-3 h-3" /> {preview.errors.length} row(s) skipped
                      </p>
                      {preview.errors.map((e, i) => (
                        <p key={i} className="text-xs text-amber-300/80">{e}</p>
                      ))}
                    </div>
                  )}

                  {/* Mode + confirm */}
                  <div className="px-5 py-4 border-t border-slate-700 space-y-3">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Import mode</p>
                    <div className="flex gap-3">
                      {(["merge", "replace"] as ImportMode[]).map((m) => (
                        <button
                          key={m}
                          onClick={() => setMode(m)}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                            mode === m
                              ? "border-blue-500 bg-blue-500/20 text-blue-300"
                              : "border-slate-600 text-slate-400 hover:border-slate-400"
                          }`}
                        >
                          {m === "merge" ? "Merge (add new)" : "Replace (overwrite)"}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-start gap-2 bg-slate-900/40 rounded-lg px-3 py-2">
                      <Info className="w-3.5 h-3.5 mt-0.5 text-slate-500 shrink-0" />
                      <p className="text-xs text-slate-400">
                        {mode === "merge"
                          ? "Adds positions not already present. Existing tickers in the same portfolio are skipped."
                          : "Clears the affected portfolios first, then loads all rows from the file."}
                      </p>
                    </div>
                    <button
                      onClick={handleConfirm}
                      disabled={loading}
                      className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 
                                 text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all"
                    >
                      {loading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>Confirm Import <ArrowRight className="w-4 h-4" /></>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}

              {step === "success" && result && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-xl border border-emerald-700/40 bg-emerald-500/5 p-6 space-y-4"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                    <div>
                      <p className="font-semibold text-emerald-300">Import Successful</p>
                      <p className="text-sm text-slate-400">{result.message}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg bg-slate-800/60 py-3">
                      <p className="text-xl font-bold text-emerald-300">{result.added.length}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Added</p>
                    </div>
                    <div className="rounded-lg bg-slate-800/60 py-3">
                      <p className="text-xl font-bold text-amber-300">{result.skipped.length}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Skipped</p>
                    </div>
                    <div className="rounded-lg bg-slate-800/60 py-3">
                      <p className="text-xl font-bold text-red-400">{result.errors.length}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Errors</p>
                    </div>
                  </div>
                  {result.errors.length > 0 && (
                    <div className="bg-red-500/5 border border-red-700/30 rounded-lg p-3 space-y-1">
                      {result.errors.map((e, i) => (
                        <p key={i} className="text-xs text-red-300">{e}</p>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={reset}
                    className="w-full py-2 rounded-lg border border-slate-600 text-slate-300 text-sm 
                               hover:border-slate-400 transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" /> Import Another File
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error banner */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 bg-red-500/10 border border-red-700/30 rounded-xl px-4 py-3"
              >
                <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </motion.div>
            )}

            {loading && step === "idle" && (
              <div className="flex items-center gap-3 text-slate-400 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                Parsing file…
              </div>
            )}
          </div>

          {/* ── Right: Export & Template ──────────────────────── */}
          <div className="space-y-5">

            {/* Download Template */}
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-violet-400" /> Templates &amp; Export
            </h2>

            <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-5 space-y-4">
              <div>
                <p className="font-medium text-slate-200">Import Template</p>
                <p className="text-sm text-slate-400 mt-1">
                  Download a blank template pre-filled with sample rows showing the correct format.
                  Works with multiple brokerages — just fill in the Brokerage column.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => api.exportTemplate("xlsx")}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg 
                             bg-violet-600/20 border border-violet-600/40 text-violet-300 text-sm 
                             font-medium hover:bg-violet-600/30 transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Excel (.xlsx)
                </button>
                <button
                  onClick={() => api.exportTemplate("csv")}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg 
                             bg-slate-700/40 border border-slate-600 text-slate-300 text-sm 
                             font-medium hover:bg-slate-700/60 transition-all"
                >
                  <FileText className="w-4 h-4" /> CSV
                </button>
              </div>
            </div>

            {/* Export Current Holdings */}
            <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-5 space-y-4">
              <div>
                <p className="font-medium text-slate-200">Export Current Holdings</p>
                <p className="text-sm text-slate-400 mt-1">
                  Download all your current positions in a format compatible with re-importing.
                  Use this as a backup or to migrate between devices.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => api.exportCurrent("xlsx")}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg 
                             bg-emerald-600/20 border border-emerald-600/40 text-emerald-300 text-sm 
                             font-medium hover:bg-emerald-600/30 transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Excel (.xlsx)
                </button>
                <button
                  onClick={() => api.exportCurrent("csv")}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg 
                             bg-slate-700/40 border border-slate-600 text-slate-300 text-sm 
                             font-medium hover:bg-slate-700/60 transition-all"
                >
                  <FileText className="w-4 h-4" /> CSV
                </button>
              </div>
            </div>

            {/* Format guide */}
            <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-5 space-y-3">
              <p className="font-medium text-slate-300 flex items-center gap-2">
                <Table2 className="w-4 h-4 text-slate-400" /> Required Columns
              </p>
              <div className="space-y-1.5 text-sm">
                {[
                  { col: "portfolio", desc: "Stocks · ETFs · Retirement Stocks · Retirement ETFs · Watchlist" },
                  { col: "brokerage", desc: "Optional — e.g. Fidelity, Schwab, Robinhood" },
                  { col: "ticker",    desc: "Stock or ETF symbol (e.g. AAPL, VOO)" },
                  { col: "shares",    desc: "Number of shares held" },
                  { col: "cost_per_share", desc: "Your average purchase price" },
                  { col: "purchase_date",  desc: "Date purchased — YYYY-MM-DD or MM/DD/YYYY" },
                ].map(({ col, desc }) => (
                  <div key={col} className="flex gap-3">
                    <code className="text-blue-300 bg-slate-900/60 rounded px-1.5 py-0.5 text-xs w-32 shrink-0">
                      {col}
                    </code>
                    <span className="text-slate-400 text-xs">{desc}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 pt-1">
                Column order doesn't matter. Headers are matched by name, not position.
                Extra columns are ignored.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
