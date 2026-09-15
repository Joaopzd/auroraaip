import { cn } from "@/lib/utils";
import dittoLogo from "@/assets/ditto-logo.jpg.asset.json";

/**
 * Compact brand mark used by the assistant controls.
 */
export function AuroraIcon({ className }: { className?: string }) {
  return (
    <img
      src={dittoLogo.url}
      alt=""
      className={cn("inline-block object-contain", className)}
      aria-hidden="true"
    />
  );
}
