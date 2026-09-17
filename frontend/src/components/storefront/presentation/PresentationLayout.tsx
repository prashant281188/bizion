'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDrag } from '@use-gesture/react';
import { ChevronLeft, ChevronRight, X, Filter, Info, ArrowUp, ArrowDown, Maximize, Minimize, Play, Pause } from 'lucide-react';

interface PresentationLayoutProps {
  products: any[];
  initialIndex?: number;
  onProductChange?: (index: number) => void;
  renderProduct: (product: any, isActive: boolean) => React.ReactNode;
  renderDetails: (product: any) => React.ReactNode;
  renderFilters: () => React.ReactNode;
}

export function PresentationLayout({
  products,
  initialIndex = 0,
  onProductChange,
  renderProduct,
  renderDetails,
  renderFilters
}: PresentationLayoutProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [direction, setDirection] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAutoPlay, setIsAutoPlay] = useState(true); // Enabled by default
  const [showControls, setShowControls] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    // Attempt to automatically enter fullscreen on mount
    if (containerRef.current && !document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.warn(`Auto-fullscreen blocked by browser: ${err.message}`);
      });
    }
    
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard shortcut for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // 'center' = image, 'left' = filters open, 'right' = details open
  const [activePanel, setActivePanel] = useState<'center' | 'left' | 'right'>('center');

  const activeProduct = products[currentIndex];

  useEffect(() => {
    if (onProductChange) {
      onProductChange(currentIndex);
    }
  }, [currentIndex, onProductChange]);

  useEffect(() => {
    if (products.length > 0 && currentIndex >= products.length) {
      setCurrentIndex(0);
    }
  }, [products.length, currentIndex]);

  const handleNextProduct = () => {
    if (products.length === 0) return;
    setDirection(1);
    setCurrentIndex(prev => (prev < products.length - 1 ? prev + 1 : 0));
  };

  const handlePrevProduct = () => {
    if (products.length === 0) return;
    setDirection(-1);
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : products.length - 1));
  };

  // Auto Play Effect
  useEffect(() => {
    if (!isAutoPlay || activePanel !== 'center' || products.length <= 1) return;
    
    const timer = setInterval(() => {
      setDirection(1);
      setCurrentIndex(prev => (prev < products.length - 1 ? prev + 1 : 0));
    }, 4000); // 4 seconds per slide
    
    return () => clearInterval(timer);
  }, [isAutoPlay, activePanel, products.length, currentIndex]); // Reset interval if user manually interacts

  // Keyboard Navigation for PC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key) || e.code === 'Space') {
        e.preventDefault(); // Prevent native browser scrolling when navigating
      }

      if (e.key === ' ' || e.code === 'Space') {
        setIsAutoPlay(prev => !prev);
      }

      if (e.key === 'ArrowUp') handlePrevProduct();
      if (e.key === 'ArrowDown') handleNextProduct();
      
      if (e.key === 'ArrowLeft') {
        if (activePanel === 'right') setActivePanel('center');
        else if (activePanel === 'center') setActivePanel('left');
      }
      if (e.key === 'ArrowRight') {
        if (activePanel === 'left') setActivePanel('center');
        else if (activePanel === 'center') setActivePanel('right');
      }
      if (e.key === 'Escape') {
        setActivePanel('center');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePanel, currentIndex, products.length, isAutoPlay]);

  // Wheel Navigation (Scroll to change products)
  const lastWheelTime = useRef(0);
  
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (activePanel !== 'center' || products.length <= 1) return;
      
      const now = Date.now();
      if (now - lastWheelTime.current < 600) return;
      
      if (Math.abs(e.deltaY) > 20) {
        if (e.deltaY > 0) {
          setDirection(1);
          setCurrentIndex(prev => (prev < products.length - 1 ? prev + 1 : 0));
        } else {
          setDirection(-1);
          setCurrentIndex(prev => (prev > 0 ? prev - 1 : products.length - 1));
        }
        lastWheelTime.current = now;
      }
    };
    
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [activePanel, products.length]);

  // Inactivity Timer to hide controls
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const resetIdle = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (activePanel === 'center') {
          setShowControls(false);
        }
      }, 2500);
    };

    resetIdle();
    const events = ['mousemove', 'keydown', 'touchstart', 'wheel', 'click'];
    events.forEach(e => window.addEventListener(e, resetIdle, { passive: true }));
    
    return () => {
      clearTimeout(timeout);
      events.forEach(e => window.removeEventListener(e, resetIdle));
    };
  }, [activePanel]);

  // Swipe Gestures
  const bind = useDrag(({ swipe: [swipeX, swipeY], active, movement: [mx, my], cancel }) => {
    // Thresholds
    const swipeThreshold = 50;

    if (swipeX === 1 || mx > swipeThreshold) {
      // Swiped Right -> Open Left Panel or Close Right Panel
      if (activePanel === 'right') setActivePanel('center');
      else if (activePanel === 'center') setActivePanel('left');
      cancel();
    } else if (swipeX === -1 || mx < -swipeThreshold) {
      // Swiped Left -> Open Right Panel or Close Left Panel
      if (activePanel === 'left') setActivePanel('center');
      else if (activePanel === 'center') setActivePanel('right');
      cancel();
    }

    // Vertical swipes for product change (only if center panel is active)
    if (activePanel === 'center') {
      if (swipeY === -1 || my < -swipeThreshold) {
        // Swiped Up
        handleNextProduct();
        cancel();
      } else if (swipeY === 1 || my > swipeThreshold) {
        // Swiped Down
        handlePrevProduct();
        cancel();
      }
    }
  }, {
    axis: 'lock',
    preventScroll: true,
  });

  return (
    <div 
      ref={containerRef}
      className={`relative w-full overflow-hidden bg-white touch-none ${isFullscreen ? 'h-screen' : 'h-[calc(100vh-73px)]'}`}
      {...bind()}
    >
      {/* TOP CONTROLS (Always Visible) */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-3 pointer-events-auto">
        <button
          onClick={() => setIsAutoPlay(!isAutoPlay)}
          className={`p-3 rounded-full transition-all ${isAutoPlay ? 'text-amber-700' : 'text-zinc-400 hover:text-amber-900'}`}
          title={isAutoPlay ? "Pause Auto-play" : "Start Auto-play"}
        >
          {isAutoPlay ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
        <button
          onClick={toggleFullscreen}
          className="p-3 rounded-full text-zinc-400 hover:text-amber-900 transition-all"
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </button>
      </div>

      {/* Product Counter Badge */}
      {products.length > 0 && activePanel === 'center' && (
        <div className="absolute top-5 left-5 z-30 pointer-events-none">
          <span className="text-xs font-semibold text-zinc-400 tracking-wider tabular-nums">
            {currentIndex + 1} / {products.length}
          </span>
        </div>
      )}

      {/* Preload Next/Prev Images for Slower Connections */}
      <div className="hidden" aria-hidden="true">
        {products.length > 1 && (
          <>
            {products[currentIndex + 1 < products.length ? currentIndex + 1 : 0]?.images?.[0]?.url && (
              <img src={products[currentIndex + 1 < products.length ? currentIndex + 1 : 0].images[0].url} alt="" loading="eager" decoding="async" />
            )}
            {products[currentIndex > 0 ? currentIndex - 1 : products.length - 1]?.images?.[0]?.url && (
              <img src={products[currentIndex > 0 ? currentIndex - 1 : products.length - 1].images[0].url} alt="" loading="eager" decoding="async" />
            )}
          </>
        )}
      </div>

      {/* BACKGROUND / CENTER PANEL: Product View */}
      <div className="absolute inset-0 z-0 flex flex-col justify-center items-center overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentIndex}
            variants={{
              enter: (d: number) => ({ y: `${d * 100}%`, opacity: 1 }),
              center: { y: 0, opacity: 1 },
              exit: (d: number) => ({ y: `${d * -100}%`, opacity: 1 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
            className="w-full h-full absolute inset-0"
          >
            {activeProduct ? renderProduct(activeProduct, activePanel === 'center') : (
              <div className="flex items-center justify-center h-full text-zinc-500">
                No products found
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* LEFT PANEL: Filters */}
      <AnimatePresence>
        {activePanel === 'left' && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute top-0 left-0 h-full w-4/5 max-w-sm bg-[#fdfaf6]/95 backdrop-blur-md z-20 shadow-2xl overflow-y-auto"
          >
            <div className="px-3 py-2 flex justify-end items-center">
              <button onClick={() => setActivePanel('center')} className="p-1.5 rounded-full text-amber-900/50 hover:text-amber-900 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-3 pb-4">
              {renderFilters()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RIGHT PANEL: Details */}
      <AnimatePresence>
        {activePanel === 'right' && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute top-0 right-0 h-full w-4/5 max-w-sm bg-[#fdfaf6]/95 backdrop-blur-md z-20 shadow-2xl overflow-y-auto"
          >
            <div className="p-4 flex justify-start items-center">
              <button onClick={() => setActivePanel('center')} className="p-2 rounded-full text-amber-900/50 hover:text-amber-900 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              {activeProduct && renderDetails(activeProduct)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OVERLAY for dimming when panels are open */}
      <AnimatePresence>
        {activePanel !== 'center' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={() => setActivePanel('center')}
            className="absolute inset-0 bg-black z-10"
          />
        )}
      </AnimatePresence>

      {/* DESKTOP CONTROLS */}
      <AnimatePresence>
        {showControls && activePanel === 'center' && (
          <>
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-y-0 left-4 flex flex-col justify-center z-10 hidden md:flex pointer-events-none"
            >
              <button 
                onClick={() => setActivePanel('left')} 
                className="pointer-events-auto p-4 rounded-full text-zinc-400 hover:text-amber-900 transition-all"
                title="Open Filters (Left Arrow)"
              >
                <Filter className="w-6 h-6" />
              </button>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-y-0 right-4 flex flex-col justify-center z-10 hidden md:flex pointer-events-none"
            >
              <button 
                onClick={() => setActivePanel('right')} 
                className="pointer-events-auto p-4 rounded-full text-zinc-400 hover:text-amber-900 transition-all"
                title="View Details (Right Arrow)"
              >
                <Info className="w-6 h-6" />
              </button>
            </motion.div>

            {currentIndex > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="absolute top-4 inset-x-0 flex justify-center z-10 hidden md:flex pointer-events-none"
              >
                <button 
                  onClick={handlePrevProduct} 
                  className="pointer-events-auto p-2 rounded-full text-zinc-400 hover:text-amber-900 transition-all"
                  title="Previous Product (Up Arrow)"
                >
                  <ArrowUp className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {currentIndex < products.length - 1 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
                className="absolute bottom-4 inset-x-0 flex justify-center z-10 hidden md:flex pointer-events-none"
              >
                <button 
                  onClick={handleNextProduct} 
                  className="pointer-events-auto p-2 rounded-full text-zinc-400 hover:text-amber-900 transition-all"
                  title="Next Product (Down Arrow)"
                >
                  <ArrowDown className="w-5 h-5" />
                </button>
              </motion.div>
            )}
            
            {/* MOBILE HINTS */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.3 }}
              className="absolute bottom-6 inset-x-0 flex justify-between px-6 pointer-events-none md:hidden text-amber-900/50 text-xs font-semibold uppercase tracking-wider"
            >
              <div className="flex items-center gap-1"><ChevronRight className="w-4 h-4"/> Filters</div>
              <div className="flex items-center gap-1">Details <ChevronLeft className="w-4 h-4"/></div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
