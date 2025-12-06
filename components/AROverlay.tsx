import React, { useState, useRef, useEffect } from 'react';
import { AnalysisResult, ObjectPart } from '../types';
import { CloseIcon, SparklesIcon, RefreshIcon } from './Icons';

interface AROverlayProps {
  imageSrc: string;
  data: AnalysisResult;
  onReset: () => void;
}

export const AROverlay: React.FC<AROverlayProps> = ({ imageSrc, data, onReset }) => {
  const [selectedPart, setSelectedPart] = useState<ObjectPart | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Resize handler to ensure boxes match image exactly
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setImageSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    
    window.addEventListener('resize', updateSize);
    updateSize(); // Initial
    
    // Safety timeout for image load
    const timer = setTimeout(updateSize, 100);
    return () => {
        window.removeEventListener('resize', updateSize);
        clearTimeout(timer);
    }
  }, [imageSrc]);

  // Convert Gemini 0-1000 coordinates to percentages
  const getStyle = (box: number[]) => {
    const [ymin, xmin, ymax, xmax] = box;
    return {
      top: `${ymin / 10}%`,
      left: `${xmin / 10}%`,
      height: `${(ymax - ymin) / 10}%`,
      width: `${(xmax - xmin) / 10}%`,
    };
  };

  const colors = [
    'border-pink-400 bg-pink-400/20 text-pink-400',
    'border-cyan-400 bg-cyan-400/20 text-cyan-400',
    'border-yellow-400 bg-yellow-400/20 text-yellow-400',
    'border-lime-400 bg-lime-400/20 text-lime-400',
  ];

  return (
    <div className="relative w-full h-full flex flex-col bg-indigo-950 overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 z-40 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent">
        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-3 shadow-lg border-2 border-white/50 max-w-[75%] animate-bounce-gentle">
           <h1 className="text-xl md:text-2xl font-display font-black text-indigo-600 leading-tight">
             {data.mainObject}
           </h1>
           <p className="text-indigo-900 font-bold text-sm md:text-base leading-snug">
             {data.summary}
           </p>
        </div>
        <button 
          onClick={onReset}
          className="bg-red-500 hover:bg-red-400 text-white rounded-2xl p-3 shadow-[0_4px_0_rgba(153,27,27,1)] active:shadow-none active:translate-y-1 transition-all border-2 border-red-600"
          aria-label="Close"
        >
          <CloseIcon className="w-8 h-8" />
        </button>
      </div>

      {/* Main AR Viewport */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-slate-900">
        <div ref={containerRef} className="relative max-w-full max-h-full">
          <img 
            src={imageSrc} 
            alt="Analyzed Object" 
            className="max-w-full max-h-[85vh] object-contain"
            onLoad={() => {
                if (containerRef.current) {
                    setImageSize({
                        width: containerRef.current.clientWidth,
                        height: containerRef.current.clientHeight
                    });
                }
            }}
          />

          {/* Render Bounding Boxes */}
          {data.parts.map((part, index) => {
            const colorClass = colors[index % colors.length];
            // Split color class to get just border/bg parts
            const borderColor = colorClass.split(' ')[0];
            const bgColor = colorClass.split(' ')[1];
            
            return (
              <button
                key={part.id}
                onClick={() => setSelectedPart(part)}
                className={`absolute transition-all duration-300 group rounded-xl border-4 border-dashed animate-pop-in
                  ${selectedPart?.id === part.id 
                    ? 'border-white shadow-[0_0_25px_rgba(255,255,255,0.6)] z-30 scale-105' 
                    : `${borderColor} ${bgColor} opacity-80 hover:opacity-100 z-10 hover:scale-105`}
                `}
                style={{
                  ...getStyle(part.box_2d),
                  animationDelay: `${index * 200}ms`
                }}
              >
                {/* Center Icon */}
                {selectedPart?.id !== part.id && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform transition-transform group-hover:scale-125">
                        <div className={`w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg animate-wiggle`}>
                          <span className="text-lg">✨</span>
                        </div>
                    </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Sheet / Explanation Card */}
      <div className={`
        absolute bottom-0 left-0 right-0 px-4 pb-6 pt-12
        transition-transform duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) z-50
        ${selectedPart ? 'translate-y-0' : 'translate-y-[120%]'}
      `}>
        <div className="mx-auto max-w-2xl bg-white border-4 border-b-8 border-indigo-500 rounded-3xl shadow-2xl p-6 relative">
           
           {/* Close Button specific for card */}
           <button 
             onClick={() => setSelectedPart(null)}
             className="absolute -top-6 right-4 bg-indigo-500 text-white p-2 rounded-full border-4 border-white shadow-lg hover:bg-indigo-600 transition-colors"
           >
             <CloseIcon className="w-6 h-6" />
           </button>

           <div className="flex items-start gap-4 mb-2">
             <div className="w-16 h-16 bg-yellow-100 rounded-2xl flex items-center justify-center border-4 border-yellow-300 flex-shrink-0">
               <span className="text-3xl">🤖</span>
             </div>
             <div>
               <h3 className="text-2xl font-display font-black text-indigo-600">
                 {selectedPart?.name}
               </h3>
               <p className="text-xl font-bold text-slate-700 leading-relaxed font-display">
                 {selectedPart?.explanation}
               </p>
             </div>
           </div>
        </div>
      </div>

      {/* Hint when nothing is selected */}
      {!selectedPart && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full px-4 flex justify-center pointer-events-none z-30">
          <div className="bg-black/60 backdrop-blur-md text-white px-6 py-4 rounded-3xl border-2 border-white/20 shadow-xl animate-bounce-gentle flex items-center gap-3">
             <span className="text-3xl">👆</span>
             <span className="font-display text-xl font-bold">Tap a <span className="text-yellow-400">sparkle</span> to learn!</span>
          </div>
        </div>
      )}
    </div>
  );
};