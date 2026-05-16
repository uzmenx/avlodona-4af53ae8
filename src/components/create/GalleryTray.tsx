/**
 * GalleryTray — Camera ekrani pastidagi gallery tray.
 *
 * Holatlari:
 *  • peek  — 4 ta oxirgi rasm + chapga suring (kamera holatida ko'rinadi)
 *  • full  — to'liq ekranli GalleryPicker (swipe-up bilan ochiladi)
 *
 * Ishlatish:
 *   <GalleryTray
 *     open={trayOpen}
 *     onOpenChange={setTrayOpen}
 *     onSelect={handleGallerySelect}
 *     peekAssets={recentAssets}
 *     maxSelection={maxItems - currentCount}
 *     canAdd={canAddMore}
 *   />
 */
import { useCallback, useRef } from 'react';
import { motion, AnimatePresence, PanInfo, useAnimation } from 'framer-motion';
import { ChevronUp, ImagePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import GalleryPicker, { GalleryPickerProps } from './GalleryPicker';
import { GalleryAsset } from '@/hooks/useGallery';

interface GalleryTrayProps {
  /** Tray to'liq ochiqmi */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Peek holatidagi 4 ta oxirgi rasm (useGallery'dan) */
  peekAssets: GalleryAsset[];
  /** Bir rasm tanlanganda (peek yoki full) */
  onSelect: (assets: GalleryAsset[]) => void;
  /** Tanlash chegarasi */
  maxSelection?: number;
  /** Yana qo'shish mumkinmi */
  canAdd?: boolean;
  /** peek tray balandligi — parent bilan sinxronizatsiya uchun */
  peekHeight?: string;
}

const DRAG_THRESHOLD = -80; // px: tepaga tortish uchun zarur

export default function GalleryTray({
  open,
  onOpenChange,
  peekAssets,
  onSelect,
  maxSelection = 5,
  canAdd = true,
  peekHeight = '5.25rem',
}: GalleryTrayProps) {
  const dragY = useRef(0);

  const handlePanEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y < DRAG_THRESHOLD) {
      // Tepaga sudrab tashlaganda — to'liq ochish
      onOpenChange(true);
    }
  }, [onOpenChange]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleConfirm = useCallback((assets: GalleryAsset[]) => {
    onSelect(assets);
    onOpenChange(false);
  }, [onSelect, onOpenChange]);

  return (
    <>
      {/* ── Peek Tray (kamera holatida ko'rinadigan pastki lenta) ──────────── */}
      <AnimatePresence>
        {!open && (
          <motion.div
            key="peek"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            drag={canAdd ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.4, bottom: 0 }}
            onDragEnd={handlePanEnd}
            className="absolute bottom-0 left-0 right-0 z-30 touch-none"
            style={{ height: peekHeight }}
          >
            <div
              className="h-full px-3 flex items-center gap-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent"
            >
              {/* Galereya tugmasi */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => { if (canAdd) onOpenChange(true); }}
                disabled={!canAdd}
                className={cn(
                  'flex-shrink-0 w-14 h-14 rounded-[14px] border overflow-hidden flex items-center justify-center relative',
                  canAdd
                    ? 'border-white/25 bg-black/40 active:scale-90 transition-transform'
                    : 'border-white/10 opacity-40'
                )}
                aria-label="Galereyani ochish"
              >
                {peekAssets.length > 0 ? (
                  <>
                    <img
                      src={peekAssets[0].webUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-t from-black/50 to-transparent flex items-end justify-center pb-0.5">
                      <ChevronUp className="w-3 h-3 text-white/80" />
                    </div>
                  </>
                ) : (
                  <ImagePlus className="w-6 h-6 text-white/70" />
                )}
              </motion.button>

              {/* Son preview rasmlar */}
              {peekAssets.slice(1, 4).map((asset, i) => (
                <motion.button
                  key={asset.identifier}
                  whileTap={{ scale: 0.9 }}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => { if (canAdd) onSelect([asset]); }}
                  disabled={!canAdd}
                  className="flex-shrink-0 w-14 h-14 rounded-[10px] border border-white/15 overflow-hidden bg-white/5"
                >
                  <img
                    src={asset.webUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </motion.button>
              ))}

              {/* Swipe ko'rsatgichi */}
              {canAdd && peekAssets.length > 0 && (
                <motion.button
                  onClick={() => onOpenChange(true)}
                  className="ml-auto flex flex-col items-center gap-0.5 pr-1"
                  animate={{ y: [0, -3, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                >
                  <ChevronUp className="w-5 h-5 text-white/50" />
                  <span className="text-white/30 text-[9px] font-medium">Ko'proq</span>
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Full Gallery Sheet ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={handleClose}
            />

            {/* Sheet */}
            <motion.div
              key="sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.3 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120) handleClose();
              }}
              className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl overflow-hidden bg-zinc-950 border-t border-white/10 shadow-2xl"
              style={{ height: '90dvh', maxHeight: '90dvh' }}
            >
              {/* Drag handle */}
              <div className="flex-shrink-0 flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              {/* GalleryPicker */}
              <div className="flex-1 min-h-0">
                <GalleryPicker
                  maxSelection={maxSelection}
                  onConfirm={handleConfirm}
                  onClose={handleClose}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
