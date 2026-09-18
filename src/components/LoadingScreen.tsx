export function LoadingScreen({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-6 px-4">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inline-flex h-full w-full rounded-full bg-gold/25 animate-ditto-ping [animation-delay:0ms]" />
        <span className="absolute inline-flex h-full w-full rounded-full bg-gold/25 animate-ditto-ping [animation-delay:600ms]" />
        <span className="absolute inline-flex h-full w-full rounded-full bg-gold/25 animate-ditto-ping [animation-delay:1200ms]" />
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gold shadow-[var(--shadow-gold)]">
          <span className="h-2.5 w-2.5 rounded-full bg-gold-foreground animate-ditto-breathe" />
        </span>
      </div>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground animate-ditto-breathe">
        {label}
      </p>
    </div>
  );
}
