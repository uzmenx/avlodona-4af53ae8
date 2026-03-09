import { supabase } from '@/integrations/supabase/client';

// Register service worker for push notifications
export async function registerPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push notifications not supported');
    return false;
  }

  try {
    // Register custom SW for push
    const registration = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
    console.log('Push SW registered:', registration.scope);
    
    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Push registration error:', error);
    return false;
  }
}

// Show local notification (when app is open but user is on different page)
export function showLocalCallNotification(callerName: string, callerId: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  // Play ringtone
  playRingtone();

  const notification = new Notification(`📹 ${callerName} qo'ng'iroq qilmoqda`, {
    body: "Video qo'ng'iroqqa javob bering",
    icon: '/pwa-192x192.png',
    tag: 'incoming-call',
    requireInteraction: true,
  } as NotificationOptions);

  notification.onclick = () => {
    window.focus();
    window.location.href = `/chat/${callerId}`;
    notification.close();
  };

  // Auto-close after 30s
  setTimeout(() => notification.close(), 30000);

  return notification;
}

// Ringtone management
const RINGTONE_KEY = 'avlodona_ringtone';

export interface RingtoneOption {
  id: string;
  name: string;
  frequency: number; // Hz for generated tone
  pattern: number[]; // duration pattern in ms
}

export const RINGTONE_OPTIONS: RingtoneOption[] = [
  { id: 'classic', name: '🔔 Klassik', frequency: 440, pattern: [400, 200, 400, 200, 400, 600] },
  { id: 'gentle', name: '🎵 Yumshoq', frequency: 523, pattern: [600, 300, 600, 300] },
  { id: 'urgent', name: '🔊 Shoshilinch', frequency: 660, pattern: [200, 100, 200, 100, 200, 100, 200, 400] },
  { id: 'melody', name: '🎶 Melodiya', frequency: 392, pattern: [300, 150, 350, 150, 400, 150, 450, 300] },
  { id: 'soft', name: '🌙 Tinch', frequency: 349, pattern: [800, 400, 800, 400] },
  { id: 'digital', name: '💫 Zamonaviy', frequency: 587, pattern: [150, 100, 150, 100, 300, 200, 150, 100, 150, 100, 300, 400] },
];

export function getSelectedRingtone(): string {
  return localStorage.getItem(RINGTONE_KEY) || 'classic';
}

export function setSelectedRingtone(id: string) {
  localStorage.setItem(RINGTONE_KEY, id);
}

let currentAudioContext: AudioContext | null = null;
let ringtoneTimeout: ReturnType<typeof setTimeout> | null = null;
let customAudioEl: HTMLAudioElement | null = null;

export function playRingtone(ringtoneId?: string) {
  stopRingtone();
  
  const id = ringtoneId || getSelectedRingtone();
  
  // Custom ringtone from local file
  if (id === 'custom') {
    const dataUrl = localStorage.getItem('custom_ringtone_data');
    if (dataUrl) {
      const audio = new Audio(dataUrl);
      audio.loop = true;
      customAudioEl = audio;
      audio.play().catch(() => {});
    }
    return;
  }
  
  const ringtone = RINGTONE_OPTIONS.find(r => r.id === id) || RINGTONE_OPTIONS[0];
  
  try {
    const ctx = new AudioContext();
    currentAudioContext = ctx;
    
    let time = ctx.currentTime;
    
    const playPattern = () => {
      if (!currentAudioContext || currentAudioContext.state === 'closed') return;
      
      let t = currentAudioContext.currentTime;
      
      for (let i = 0; i < ringtone.pattern.length; i++) {
        const duration = ringtone.pattern[i] / 1000;
        
        if (i % 2 === 0) {
          // Tone
          const osc = currentAudioContext.createOscillator();
          const gain = currentAudioContext.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(ringtone.frequency, t);
          
          // Add slight frequency variation for melody
          if (ringtone.id === 'melody') {
            const noteOffset = [0, 2, 4, 5][Math.floor(i / 2) % 4];
            osc.frequency.setValueAtTime(ringtone.frequency * Math.pow(2, noteOffset / 12), t);
          }
          
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
          gain.gain.linearRampToValueAtTime(0.3, t + duration - 0.02);
          gain.gain.linearRampToValueAtTime(0, t + duration);
          
          osc.connect(gain);
          gain.connect(currentAudioContext.destination);
          
          osc.start(t);
          osc.stop(t + duration);
        }
        
        t += duration;
      }
      
      // Repeat after pattern completes
      const totalDuration = ringtone.pattern.reduce((a, b) => a + b, 0);
      ringtoneTimeout = setTimeout(playPattern, totalDuration + 500);
    };
    
    playPattern();
  } catch (e) {
    console.error('Ringtone error:', e);
  }
}

export function stopRingtone() {
  if (ringtoneTimeout) {
    clearTimeout(ringtoneTimeout);
    ringtoneTimeout = null;
  }
  if (currentAudioContext) {
    currentAudioContext.close().catch(() => {});
    currentAudioContext = null;
  }
  if (customAudioEl) {
    customAudioEl.pause();
    customAudioEl.currentTime = 0;
    customAudioEl = null;
  }
}

export function previewRingtone(ringtoneId: string) {
  stopRingtone();
  
  const ringtone = RINGTONE_OPTIONS.find(r => r.id === ringtoneId) || RINGTONE_OPTIONS[0];
  
  try {
    const ctx = new AudioContext();
    currentAudioContext = ctx;
    
    let t = ctx.currentTime;
    
    for (let i = 0; i < ringtone.pattern.length; i++) {
      const duration = ringtone.pattern[i] / 1000;
      
      if (i % 2 === 0) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        
        if (ringtone.id === 'melody') {
          const noteOffset = [0, 2, 4, 5][Math.floor(i / 2) % 4];
          osc.frequency.setValueAtTime(ringtone.frequency * Math.pow(2, noteOffset / 12), t);
        } else {
          osc.frequency.setValueAtTime(ringtone.frequency, t);
        }
        
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
        gain.gain.linearRampToValueAtTime(0.3, t + duration - 0.02);
        gain.gain.linearRampToValueAtTime(0, t + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + duration);
      }
      
      t += duration;
    }
    
    // Close after pattern plays once
    const totalDuration = ringtone.pattern.reduce((a, b) => a + b, 0);
    setTimeout(() => {
      if (currentAudioContext === ctx) {
        ctx.close().catch(() => {});
        currentAudioContext = null;
      }
    }, totalDuration + 100);
  } catch (e) {
    console.error('Preview error:', e);
  }
}
