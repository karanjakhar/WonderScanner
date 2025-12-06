import React from 'react';
import { SparklesIcon } from './Icons';

export const Loading = () => {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-indigo-950">
      
      {/* Background Shapes */}
      <div className="absolute inset-0 overflow-hidden opacity-30">
        <div className="absolute top-10 left-10 text-6xl animate-float">⭐</div>
        <div className="absolute bottom-20 right-10 text-6xl animate-float-delayed">🎈</div>
        <div className="absolute top-1/2 left-20 w-32 h-32 bg-yellow-400 rounded-full blur-[80px]"></div>
        <div className="absolute bottom-1/3 right-20 w-40 h-40 bg-pink-500 rounded-full blur-[80px]"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* Bouncing Character */}
        <div className="relative mb-8">
           <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.3)] animate-bounce">
              <span className="text-6xl">🤖</span>
           </div>
           <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-20 h-4 bg-black/20 rounded-[100%] blur-sm animate-pulse"></div>
           <div className="absolute -top-6 right-0">
             <SparklesIcon className="w-12 h-12 text-yellow-300 animate-spin-slow" />
           </div>
        </div>
        
        <h2 className="text-3xl font-display font-bold text-white tracking-wide animate-pulse text-center">
          Asking the<br/>
          <span className="text-cyan-300">Magic Robot!</span>
        </h2>
        
        <div className="mt-6 flex gap-3">
          <div className="w-4 h-4 bg-pink-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-4 h-4 bg-yellow-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-4 h-4 bg-cyan-400 rounded-full animate-bounce"></div>
        </div>

        <p className="mt-8 text-indigo-200 font-display text-xl bg-indigo-900/50 px-6 py-2 rounded-full border border-indigo-500/30">
          Looking at your picture...
        </p>
      </div>
    </div>
  );
};