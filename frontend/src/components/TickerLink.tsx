import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Props {
  ticker: string;
  className?: string;
  children?: React.ReactNode;
}

export function TickerLink({ ticker, className, children }: Props) {
  return (
    <Link
      to={`/equity/${ticker}`}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "font-mono font-bold text-white hover:text-accent-blue transition-colors underline-offset-2 hover:underline",
        className,
      )}
    >
      {children ?? ticker}
    </Link>
  );
}
