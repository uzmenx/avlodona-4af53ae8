import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Maximize2, Minimize2, SwitchCamera } from 'lucide-react';
import { DailyCall, DailyParticipant } from '@daily-co/daily-js';
import { cn } from '@/lib/utils';

type LayoutMode = 'pip' | 'split';

interface VideoCallUIProps {
  callObject: DailyCall;
  remoteParticipant: DailyParticipant | null;
  cameraOn: boolean;
  micOn: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onEndCall: () => void;
}

export const VideoCallUI = ({
  callObject,
  remoteParticipant,
  cameraOn,
  micOn,
  onToggleCamera,
  onToggleMic,
  onEndCall,
}: VideoCallUIProps) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('pip');
  const [showControls, setShowControls] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // PiP drag state
  const [pipPosition, setPipPosition] = useState({ x: 16, y: 16 });
  const [pipSize, setPipSize] = useState({ w: 120, h: 170 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, px: 0, py: 0 });
  
  // Swapped: false = local in PiP (small), remote fullscreen; true = remote in PiP, local fullscreen
  const [swapped, setSwapped] = useState(false);

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, []);

  // Attach local video track
  useEffect(() => {
    if (!callObject) return;

    const attachLocal = () => {
      const lp = callObject.participants()?.local;
      if (lp?.videoTrack && localVideoRef.current) {
        const stream = new MediaStream([lp.videoTrack]);
        if (localVideoRef.current.srcObject !== stream) {
          localVideoRef.current.srcObject = stream;
        }
      } else if (localVideoRef.current && !lp?.video) {
        localVideoRef.current.srcObject = null;
      }
    };

    attachLocal();
    
    const handler = (evt: any) => {
      if (evt?.participant?.local) attachLocal();
    };
    
    callObject.on('participant-updated', handler);
    return () => { callObject.off('participant-updated', handler); };
  }, [callObject]);

  // Attach remote video + audio tracks
  useEffect(() => {
    if (remoteParticipant?.videoTrack && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = new MediaStream([remoteParticipant.videoTrack]);
    } else if (remoteVideoRef.current && !remoteParticipant?.video) {
      remoteVideoRef.current.srcObject = null;
    }
    
    if (remoteParticipant?.audioTrack) {
      let audioEl = document.getElementById('remote-audio') as HTMLAudioElement;
      if (!audioEl) {
        audioEl = document.createElement('audio');
        audioEl.id = 'remote-audio';
        audioEl.autoplay = true;
        document.body.appendChild(audioEl);
      }
      audioEl.srcObject = new MediaStream([remoteParticipant.audioTrack]);
    }

    return () => {
      const el = document.getElementById('remote-audio');
      if (el) el.remove();
    };
  }, [remoteParticipant?.videoTrack, remoteParticipant?.audioTrack]);

  // PiP Drag
  const handlePipPointerDown = (e: React.PointerEvent) => {
    if (layoutMode !== 'pip') return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, px: pipPosition.x, py: pipPosition.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePipPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const maxX = window.innerWidth - pipSize.w - 8;
    const maxY = window.innerHeight - pipSize.h - 8;
    setPipPosition({
      x: Math.max(8, Math.min(maxX, dragStartRef.current.px + dx)),
      y: Math.max(8, Math.min(maxY, dragStartRef.current.py + dy)),
    });
  };

  const handlePipPointerUp = () => setIsDragging(false);

  const handleFlipCamera = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!callObject) return;
    try {
      // Daily.co cycleCamera switches between front/back
      const devices = await callObject.enumerateDevices();
      const videoDevices = devices?.devices?.filter((d: any) => d.kind === 'videoinput') || [];
      if (videoDevices.length < 2) return;
      
      const currentDevice = callObject.getInputDevices?.() as any;
      const currentCamId = currentDevice?.camera?.deviceId || '';
      const nextCam = videoDevices.find((d: any) => d.deviceId !== currentCamId) || videoDevices[0];
      if (nextCam) {
        await callObject.setInputDevicesAsync({ videoDeviceId: nextCam.deviceId });
      }
    } catch (err) {
      console.error('Camera flip error:', err);
    }
  }, [callObject]);

  // Who is fullscreen vs PiP
  const fullscreenIsRemote = !swapped;
  const fullscreenHasVideo = fullscreenIsRemote ? !!remoteParticipant?.video : cameraOn;
  const pipHasVideo = fullscreenIsRemote ? cameraOn : !!remoteParticipant?.video;

  const renderVideoElement = (
    isLocal: boolean,
    hasVideo: boolean,
    className: string,
    label?: string
  ) => {
    const ref = isLocal ? localVideoRef : remoteVideoRef;
    return (
      <div className={cn("bg-muted flex items-center justify-center overflow-hidden", className)}>
        {hasVideo ? (
          <video
            ref={ref}
            autoPlay
            playsInline
            muted={isLocal}
            className={cn("w-full h-full object-cover", isLocal && "scale-x-[-1]")}
          />
        ) : (
          <div className="text-center text-muted-foreground">
            <div className="w-16 h-16 bg-muted-foreground/20 rounded-full flex items-center justify-center mx-auto mb-2">
              <VideoOff className="h-8 w-8" />
            </div>
            {label && <p className="text-xs">{label}</p>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-background" 
      onClick={resetHideTimer}
      onTouchStart={resetHideTimer}
    >
      {layoutMode === 'split' ? (
        <div className="flex flex-col h-full">
          {renderVideoElement(!fullscreenIsRemote, fullscreenIsRemote ? !!remoteParticipant?.video : cameraOn, "flex-1", fullscreenIsRemote ? "Kutilmoqda..." : undefined)}
          <div className="h-px bg-border" />
          {renderVideoElement(fullscreenIsRemote, fullscreenIsRemote ? cameraOn : !!remoteParticipant?.video, "flex-1", !fullscreenIsRemote ? "Kutilmoqda..." : undefined)}
        </div>
      ) : (
        <>
          {/* Fullscreen */}
          {renderVideoElement(!fullscreenIsRemote, fullscreenHasVideo, "absolute inset-0", fullscreenIsRemote ? "Kutilmoqda..." : undefined)}

          {/* PiP Window */}
          <div
            className="absolute rounded-2xl overflow-hidden shadow-2xl border-2 border-background/50 cursor-grab active:cursor-grabbing touch-none"
            style={{
              left: pipPosition.x,
              top: pipPosition.y,
              width: pipSize.w,
              height: pipSize.h,
              zIndex: 10,
            }}
            onPointerDown={handlePipPointerDown}
            onPointerMove={handlePipPointerMove}
            onPointerUp={handlePipPointerUp}
          >
            {renderVideoElement(fullscreenIsRemote, pipHasVideo, "w-full h-full")}
          </div>
        </>
      )}

      {/* Controls */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 right-0 transition-all duration-300",
          showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        <div className="bg-gradient-to-t from-black/60 to-transparent pt-16 pb-8 px-4">
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-12 w-12 rounded-full backdrop-blur-md",
                cameraOn ? "bg-white/20 text-white" : "bg-red-500/80 text-white"
              )}
              onClick={(e) => { e.stopPropagation(); onToggleCamera(); }}
            >
              {cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-12 w-12 rounded-full backdrop-blur-md",
                micOn ? "bg-white/20 text-white" : "bg-red-500/80 text-white"
              )}
              onClick={(e) => { e.stopPropagation(); onToggleMic(); }}
            >
              {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-14 w-14 rounded-full bg-destructive text-destructive-foreground"
              onClick={(e) => { e.stopPropagation(); onEndCall(); }}
            >
              <PhoneOff className="h-6 w-6" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 rounded-full bg-white/20 text-white backdrop-blur-md"
              onClick={(e) => {
                e.stopPropagation();
                setLayoutMode(prev => prev === 'pip' ? 'split' : 'pip');
              }}
            >
              {layoutMode === 'pip' ? <Maximize2 className="h-5 w-5" /> : <Minimize2 className="h-5 w-5" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 rounded-full bg-white/20 text-white backdrop-blur-md"
              onClick={handleFlipCamera}
            >
              <SwitchCamera className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
