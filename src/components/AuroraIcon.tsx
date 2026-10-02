import { cn } from "@/lib/utils";

/**
 * Compact brand mark used by the assistant controls.
 *
 * Rendered as a CSS mask (not a flat-color <img>) so its color follows
 * whatever `bg-*` class is applied — by default the brand "gold" accent,
 * which already flips between light and dark themes via --gold in
 * styles.css. Pass a different `bg-*` class to recolor it per instance.
 */
export function AuroraIcon({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label=""
      aria-hidden="true"
      className={cn(
        "inline-block bg-gold",
        "[mask-image:url(/ditto-logo-transparent.png)] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]",
        "[-webkit-mask-image:url(/ditto-logo-transparent.png)] [-webkit-mask-position:center] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:contain]",
        className,
      )}
    />
  );
}
