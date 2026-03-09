export const EndOfFeed = () => {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="w-full max-w-sm px-6">
        <div className="rounded-2xl border border-border/40 bg-muted/20 p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
            <div className="flex-1">
              <div className="h-3 w-28 bg-muted rounded animate-pulse" />
              <div className="h-3 w-40 bg-muted rounded mt-2 animate-pulse" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full bg-muted rounded animate-pulse" />
            <div className="h-3 w-5/6 bg-muted rounded animate-pulse" />
            <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-center">
          <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60 animate-spin" aria-hidden />
        </div>
      </div>
    </div>
  );

};