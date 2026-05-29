import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ExternalLink, Newspaper, RefreshCw } from "lucide-react";
import { api } from "@/api/client";
import { TickerLink } from "./TickerLink";
import { SkeletonCard } from "./Skeleton";
import type { NewsItem } from "@/types";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!t || Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface NewsCardProps {
  item: NewsItem;
  index: number;
}

function NewsCard({ item, index }: NewsCardProps) {
  return (
    <motion.a
      href={item.link || "#"}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.3) }}
      className="flex gap-3 p-3 rounded-xl bg-[#0e1726] border border-white/[0.07] hover:border-accent-blue/30 hover:bg-[#0f1e38] transition-all group"
    >
      {item.thumbnail ? (
        <img
          src={item.thumbnail}
          alt=""
          className="w-20 h-20 rounded-lg object-cover bg-slate-800 shrink-0"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
        />
      ) : (
        <div className="w-20 h-20 rounded-lg bg-slate-800/40 shrink-0 flex items-center justify-center">
          <Newspaper className="w-5 h-5 text-slate-700" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <TickerLink ticker={item.ticker} className="text-[10px] px-1.5 py-0.5 rounded bg-accent-blue/10 text-accent-blue no-underline hover:underline" />
          {item.publisher && (
            <span className="text-[10px] text-slate-600 truncate">{item.publisher}</span>
          )}
          {item.published && (
            <span className="text-[10px] text-slate-700 ml-auto shrink-0">{timeAgo(item.published)}</span>
          )}
        </div>
        <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-accent-blue transition-colors">
          {item.title}
        </h3>
        {item.summary && (
          <p className="text-[11px] text-slate-500 leading-snug mt-1 line-clamp-2">
            {item.summary}
          </p>
        )}
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-slate-700 group-hover:text-accent-blue shrink-0 mt-1" />
    </motion.a>
  );
}

export function PortfolioNews() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["portfolio-news"],
    queryFn: () => api.getPortfolioNews(40),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Portfolio News</h2>
          <p className="text-[11px] text-slate-500">Latest stories across every ticker you hold · refreshes every 5 min</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/[0.07] bg-white/[0.03] text-slate-400 hover:text-white text-sm transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : isError ? (
        <div className="text-center py-12 text-sm text-slate-500">
          Could not load news. <button onClick={() => refetch()} className="text-accent-blue hover:underline">Try again</button>.
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-sm text-slate-600">
          No news found across your holdings yet. Add positions or check back shortly.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((item, i) => (
            <NewsCard key={`${item.link}-${i}`} item={item} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
