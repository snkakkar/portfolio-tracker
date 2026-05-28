import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:400%_100%]",
        className
      )}
      style={{ animation: "skeleton-shimmer 1.6s ease-in-out infinite" }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-elevated p-5 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
