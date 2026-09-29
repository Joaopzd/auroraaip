import { cn } from "@/lib/utils";

/**
 * Compact brand mark used by the assistant controls.
 * Uses a transparent PNG (no flat background) so it blends into
 * whatever surface it's placed on, instead of showing a mismatched box.
 */
export function AuroraIcon({ className }: { className?: string }) {
  return (
    <img
      src="/ditto-logo-transparent.png"
      alt=""
      className={cn("inline-block object-contain", className)}
      aria-hidden="true"
    />
  );
}
