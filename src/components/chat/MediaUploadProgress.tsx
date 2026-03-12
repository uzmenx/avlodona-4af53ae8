import { cn } from '@/lib/utils';

interface MediaUploadProgressProps {
  progress: number;
  size?: number;
  className?: string;
  showText?: boolean;
}

export const MediaUploadProgress = ({ 
  progress, 
  size = 28, 
  className,
  showText = false
}: MediaUploadProgressProps) => {
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div 
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Background circle */}
        <circle
          className="text-white/20"
          strokeWidth="2"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress circle */}
        <circle
          className="text-[hsl(142,76%,45%)] transition-all duration-300 ease-out"
          strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          style={{ 
            filter: 'drop-shadow(0 0 4px rgba(34, 197, 94, 0.6))',
          }}
        />
      </svg>
      {showText && (
        <span className="absolute text-[8px] font-bold text-white tabular-nums">
          {Math.round(progress)}
        </span>
      )}
    </div>
  );
};
