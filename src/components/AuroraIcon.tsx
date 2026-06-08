import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Aurora brand mark: cursive italic "A" in the brand indigo with a small
 * gold star tucked in the negative space of the letter.
 */
export function AuroraIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center text-[#1D2344] dark:text-[#1D2344]",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" className="h-full w-full">
        <text
          x="16"
          y="25"
          textAnchor="middle"
          fontFamily="'Brush Script MT','Lucida Handwriting','Segoe Script',cursive"
          fontSize="30"
          fontStyle="italic"
          fontWeight={700}
          fill="currentColor"
        >
          A
        </text>
      </svg>
      <Star
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 fill-gold text-gold drop-shadow-[0_0_4px_rgba(247,197,52,0.6)]"
        strokeWidth={0}
        style={{ width: "32%", height: "32%" }}
      />
    </span>
  );
}
