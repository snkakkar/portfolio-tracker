import { cn, REC_STYLES } from "@/lib/utils";
import type { Recommendation } from "@/types";

interface Props {
  rec: Recommendation;
  small?: boolean;
  reasons?: string[];
}

export function RecBadge({ rec, small = false, reasons }: Props) {
  return (
    <div className="group relative inline-block">
      <span
        className={cn(
          "inline-flex items-center rounded-full border font-semibold tracking-wide",
          small ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
          REC_STYLES[rec]
        )}
      >
        {rec}
      </span>
      {reasons && reasons.length > 0 && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-56">
          <div className="bg-[#03060f] border border-white/[0.1] rounded-xl p-3 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1.5">Analysis</p>
            <ul className="space-y-1">
              {reasons.map((r, i) => (
                <li key={i} className="text-xs text-slate-300 flex gap-1.5">
                  <span className="text-accent-blue mt-0.5">›</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
