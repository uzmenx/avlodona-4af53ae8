import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLottie, type LottieRefCurrentProps } from 'lottie-react';

export type LordIconTrigger = 'hover' | 'click' | 'loop' | 'morph';

export interface LordIconProps {
  animationData: object;
  size?: number;
  loop?: boolean;
  trigger?: LordIconTrigger;
  className?: string;

  /**
   * Required when trigger="morph".
   * The component will toggle between animationData and morphAnimationData.
   */
  morphAnimationData?: object;

  /** Controls the morph toggle initial state (default: false -> uses animationData). */
  morphStartOnSecond?: boolean;
}

export const LordIcon = ({
  animationData,
  size = 32,
  loop = false,
  trigger = 'hover',
  className,
  morphAnimationData,
  morphStartOnSecond = false,
}: LordIconProps) => {
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  const isLoopMode = trigger === 'loop';

  const [isMorphSecond, setIsMorphSecond] = useState<boolean>(morphStartOnSecond);

  useEffect(() => {
    setIsMorphSecond(morphStartOnSecond);
  }, [morphStartOnSecond]);

  const currentAnimationData = useMemo(() => {
    if (trigger !== 'morph') return animationData;
    return (isMorphSecond ? morphAnimationData : animationData) || animationData;
  }, [animationData, isMorphSecond, morphAnimationData, trigger]);

  const { View } = useLottie(
    {
      animationData: currentAnimationData,
      loop: isLoopMode ? true : loop,
      autoplay: isLoopMode,
      lottieRef,
    },
    {
      width: size,
      height: size,
    }
  );

  const style = useMemo<CSSProperties>(() => ({ width: size, height: size }), [size]);

  const playFromStart = () => {
    const inst = lottieRef.current;
    if (!inst) return;
    inst.goToAndStop(0, true);
    inst.play();
  };

  const stopAndReset = () => {
    const inst = lottieRef.current;
    if (!inst) return;
    inst.stop();
    inst.goToAndStop(0, true);
  };

  const handleMouseEnter = () => {
    if (trigger !== 'hover') return;
    playFromStart();
  };

  const handleMouseLeave = () => {
    if (trigger !== 'hover') return;
    stopAndReset();
  };

  const handleClick = () => {
    if (trigger === 'click') {
      playFromStart();
      return;
    }

    if (trigger === 'morph') {
      if (!morphAnimationData) {
        playFromStart();
        return;
      }
      setIsMorphSecond((v) => !v);
      return;
    }
  };

  // When switching morph state, play the new animation once.
  useEffect(() => {
    if (trigger !== 'morph') return;
    playFromStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMorphSecond, trigger]);

  return (
    <span
      className={className}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      role={trigger === 'click' || trigger === 'morph' ? 'button' : undefined}
      tabIndex={trigger === 'click' || trigger === 'morph' ? 0 : undefined}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        if (trigger === 'click' || trigger === 'morph') handleClick();
      }}
    >
      {View}
    </span>
  );
};
