import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCcw } from "lucide-react";

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export const ErrorFallback = ({ error, resetErrorBoundary }: ErrorFallbackProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full space-y-6 text-center animate-in fade-in zoom-in duration-300">
        <div className="flex justify-center">
          <div className="p-4 bg-destructive/10 rounded-full">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">Kutilmagan xatolik yuz berdi</h2>
          <p className="text-muted-foreground">
            Ilova ishida muammo paydo bo'ldi. Iltimos, sahifani yangilab ko'ring yoki birozdan so'ng qayta urinib ko'ring.
          </p>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="p-4 bg-muted rounded-lg text-left overflow-auto max-h-40 text-xs font-mono border border-border">
            <p className="font-bold text-destructive mb-1">{error.name}: {error.message}</p>
            <pre className="opacity-70">{error.stack}</pre>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Button 
            onClick={resetErrorBoundary}
            size="lg"
            className="w-full gap-2 rounded-xl"
          >
            <RefreshCcw className="h-4 w-4" />
            Qayta urinish
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => window.location.href = '/'}
            className="w-full rounded-xl"
          >
            Bosh sahifaga qaytish
          </Button>
        </div>
      </div>
    </div>
  );
};
