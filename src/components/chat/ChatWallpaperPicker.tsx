import { useState } from 'react';
import { X, Check, Paintbrush } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

const WALLPAPERS = [
  { id: 'none', label: 'Oddiy', preview: null },
  { id: 'bg-1', label: 'Doodle', preview: '/wallpapers/chat-bg-1.jpg' },
  { id: 'bg-2', label: 'Geometrik', preview: '/wallpapers/chat-bg-2.jpg' },
  { id: 'bg-3', label: 'Gradient', preview: '/wallpapers/chat-bg-3.jpg' },
  { id: 'bg-4', label: 'Bokeh', preview: '/wallpapers/chat-bg-4.jpg' },
  { id: 'bg-5', label: 'Aurora', preview: '/wallpapers/chat-bg-5.jpg' },
  { id: 'bg-6', label: 'Neon', preview: '/wallpapers/chat-bg-6.jpg' },
];

interface ChatWallpaperPickerProps {
  open: boolean;
  onClose: () => void;
  currentWallpaper: string;
  onSelect: (id: string) => void;
}

const ChatWallpaperPicker = ({ open, onClose, currentWallpaper, onSelect }: ChatWallpaperPickerProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-card/90 backdrop-blur-2xl border-t border-border/20 rounded-t-3xl p-5 pb-8 animate-in slide-in-from-bottom duration-300">
        {/* Handle */}
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
        
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Paintbrush className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground text-base">Chat foni</h3>
          </div>
          <button 
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-3 gap-3">
          {WALLPAPERS.map((wp) => (
            <button
              key={wp.id}
              onClick={() => {
                onSelect(wp.id);
                onClose();
              }}
              className={cn(
                "relative aspect-[3/4] rounded-2xl overflow-hidden border-2 transition-all duration-200",
                currentWallpaper === wp.id 
                  ? "border-primary shadow-lg shadow-primary/20 scale-[1.02]" 
                  : "border-border/20 hover:border-border/40"
              )}
            >
              {wp.preview ? (
                <img 
                  src={wp.preview} 
                  alt={wp.label}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-background flex items-center justify-center">
                  <span className="text-muted-foreground text-xs">Oddiy</span>
                </div>
              )}
              
              {/* Selected check */}
              {currentWallpaper === wp.id && (
                <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              
              {/* Label */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2 pt-4">
                <span className="text-[10px] font-medium text-white">{wp.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChatWallpaperPicker;
