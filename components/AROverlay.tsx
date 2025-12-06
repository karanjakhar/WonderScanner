import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AnalysisResult, ObjectPart } from '../types';
import { CloseIcon, MicIcon, StopIcon, SpeakerIcon } from './Icons';
import { askQuestion, speakText } from '../services/geminiService';

interface AROverlayProps {
  imageSrc: string;
  data: AnalysisResult;
  onReset: () => void;
}

type AudioState = 'IDLE' | 'RECORDING' | 'THINKING' | 'ANSWERING';

export const AROverlay: React.FC<AROverlayProps> = ({ imageSrc, data, onReset }) => {
  const [selectedPart, setSelectedPart] = useState<ObjectPart | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Audio / Q&A State
  const [audioState, setAudioState] = useState<AudioState>('IDLE');
  const [answer, setAnswer] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Text to Speech State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  
  // Cache for pre-loaded audio buffers: Map<ID or Text, Promise<AudioBuffer>>
  const audioPromisesRef = useRef<Map<string, Promise<AudioBuffer>>>(new Map());

  // Initialize Audio Context helper
  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  };

  // Helper to convert raw PCM (Gemini TTS output) to AudioBuffer
  const pcmToAudioBuffer = (buffer: ArrayBuffer, ctx: AudioContext): AudioBuffer => {
    const byteLength = buffer.byteLength - (buffer.byteLength % 2);
    const pcm16 = new Int16Array(buffer.slice(0, byteLength));
    const sampleRate = 24000; // Gemini TTS standard output rate
    
    const audioBuffer = ctx.createBuffer(1, pcm16.length, sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    
    for (let i = 0; i < pcm16.length; i++) {
        channelData[i] = pcm16[i] / 32768.0;
    }
    
    return audioBuffer;
  };

  // Pre-load logic
  const ensureAudioLoaded = (id: string, text: string) => {
    if (audioPromisesRef.current.has(id)) return audioPromisesRef.current.get(id)!;
    
    const promise = (async () => {
      try {
        const arrayBuffer = await speakText(text);
        const ctx = getAudioContext();
        // We can create the buffer even if context is suspended
        return pcmToAudioBuffer(arrayBuffer, ctx);
      } catch (err) {
        console.error(`Failed to load audio for ${id}`, err);
        throw err;
      }
    })();

    audioPromisesRef.current.set(id, promise);
    return promise;
  };

  // Pre-load all audio on mount
  useEffect(() => {
    const loadAll = async () => {
      // 1. Load Summary
      if (data.summary) {
        ensureAudioLoaded('SUMMARY', data.summary);
      }
      // 2. Load all parts
      data.parts.forEach(part => {
        ensureAudioLoaded(part.id, part.explanation);
      });
    };
    loadAll();
  }, [data]);

  const playAudio = async (text: string, id?: string) => {
    try {
      stopAudio(); // Stop any currently playing audio
      setIsSpeaking(true);

      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      let audioBuffer: AudioBuffer;

      // Check cache first if ID provided
      if (id && audioPromisesRef.current.has(id)) {
        audioBuffer = await audioPromisesRef.current.get(id)!;
      } else {
        // If not in cache (e.g. Q&A answer), fetch it
        // Check if we accidentally cached it by text (unlikely for Q&A but good practice)
        if (audioPromisesRef.current.has(text)) {
           audioBuffer = await audioPromisesRef.current.get(text)!;
        } else {
           const arrayBuffer = await speakText(text);
           audioBuffer = pcmToAudioBuffer(arrayBuffer, ctx);
        }
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      
      source.onended = () => setIsSpeaking(false);
      
      source.start(0);
      sourceNodeRef.current = source;
    } catch (error) {
      console.error("Playback failed", error);
      setIsSpeaking(false);
    }
  };

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
      sourceNodeRef.current = null;
    }
    setIsSpeaking(false);
  };

  // Play summary on mount (wait for pre-load)
  useEffect(() => {
    if (data.summary) {
      const timer = setTimeout(() => {
         playAudio(data.summary, 'SUMMARY');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [data.summary]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Handle selected part speech
  useEffect(() => {
    if (selectedPart) {
      playAudio(selectedPart.explanation, selectedPart.id);
    } else {
      stopAudio();
    }
  }, [selectedPart]);

  // Handle Recording
  const startRecording = async () => {
    stopAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          setAudioState('THINKING');
          
          const responseText = await askQuestion(imageSrc, base64Audio, mimeType);
          setAnswer(responseText);
          setAudioState('ANSWERING');
          
          playAudio(responseText);
        };

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setAudioState('RECORDING');
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("I need your microphone to hear your question! 🎤");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const closeAnswer = () => {
    stopAudio();
    setAudioState('IDLE');
    setAnswer(null);
  };

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

  // Sort parts by Area (Largest to Smallest) to determine Z-Index hierarchy
  // Smallest items need to be rendered last (or have highest z-index) to be clickable
  const sortedParts = useMemo(() => {
    return [...data.parts].sort((a, b) => {
      const areaA = (a.box_2d[2] - a.box_2d[0]) * (a.box_2d[3] - a.box_2d[1]);
      const areaB = (b.box_2d[2] - b.box_2d[0]) * (b.box_2d[3] - b.box_2d[1]);
      return areaB - areaA; // Descending: Big -> Small
    });
  }, [data.parts]);

  const colors = [
    'border-pink-400 bg-pink-400/20 text-pink-400',
    'border-cyan-400 bg-cyan-400/20 text-cyan-400',
    'border-yellow-400 bg-yellow-400/20 text-yellow-400',
    'border-lime-400 bg-lime-400/20 text-lime-400',
  ];

  return (
    <div className="relative w-full h-full flex flex-col bg-indigo-950 overflow-hidden">
      {/* Header - Only visible when not in immersive audio modes */}
      {audioState === 'IDLE' && (
        <div className="absolute top-0 left-0 right-0 p-4 z-40 flex justify-between items-start pointer-events-none">
          <div className="bg-white/90 backdrop-blur-md rounded-2xl p-3 shadow-lg border-4 border-white pointer-events-auto animate-bounce-gentle max-w-[70%]">
             <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl md:text-2xl font-display font-black text-indigo-600 leading-tight">
                  {data.mainObject}
                </h1>
                {isSpeaking && !selectedPart && <SpeakerIcon className="w-5 h-5 text-indigo-400 animate-pulse" />}
             </div>
             <p className="text-indigo-900 font-bold text-sm md:text-base leading-snug">
               {data.summary}
             </p>
          </div>
          <button 
            onClick={() => { stopAudio(); onReset(); }}
            className="pointer-events-auto bg-red-500 hover:bg-red-400 text-white rounded-full p-3 shadow-[0_4px_0_rgba(153,27,27,1)] active:shadow-none active:translate-y-1 transition-all border-2 border-red-600"
            aria-label="Close"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Main AR Viewport */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-slate-900">
        <div ref={containerRef} className="relative max-w-full max-h-full">
          <img 
            src={imageSrc} 
            alt="Analyzed Object" 
            className="max-w-full max-h-[100dvh] object-contain"
          />

          {/* Render Bounding Boxes */}
          {audioState === 'IDLE' && sortedParts.map((part, index) => {
            const originalIndex = data.parts.findIndex(p => p.id === part.id);
            const colorClass = colors[originalIndex % colors.length];
            const borderColor = colorClass.split(' ')[0];
            const bgColor = colorClass.split(' ')[1];
            const isSelected = selectedPart?.id === part.id;
            
            // Calculate z-index: Smallest items (last in sorted array) get highest z-index
            const zIndex = 10 + index; 

            return (
              <button
                key={part.id}
                onClick={() => setSelectedPart(part)}
                className={`absolute transition-all duration-300 group rounded-xl border-4 border-dashed animate-pop-in
                  ${isSelected
                    ? 'border-white shadow-[0_0_25px_rgba(255,255,255,0.6)] scale-105' 
                    : `${borderColor} ${bgColor} opacity-60 hover:opacity-100 hover:scale-105`}
                `}
                style={{
                  ...getStyle(part.box_2d),
                  zIndex: zIndex,
                  animationDelay: `${index * 100}ms`
                }}
              >
                {/* Sparkle Icon for unselected items */}
                {!isSelected && (
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

      {/* 
        ========================================
        INTERACTIVE ELEMENTS
        ========================================
      */}

      {/* 1. Mic Button */}
      {!selectedPart && audioState === 'IDLE' && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 w-full flex flex-col items-center gap-4">
           <div className="bg-black/60 backdrop-blur-md text-white px-6 py-3 rounded-full border-2 border-white/20 shadow-xl animate-bounce-gentle flex items-center gap-2 mb-2">
             <span className="text-2xl">👇</span>
             <span className="font-display text-lg font-bold">Tap a ✨ or ask me!</span>
           </div>

           <button 
              onClick={startRecording}
              className="group relative"
           >
              <div className="absolute inset-0 bg-cyan-400 rounded-full blur-xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative w-20 h-20 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full flex items-center justify-center shadow-[0_8px_0_rgba(0,0,0,0.3)] border-4 border-white active:translate-y-2 active:shadow-none transition-all">
                <MicIcon className="w-10 h-10 text-white drop-shadow-md" />
              </div>
           </button>
        </div>
      )}

      {/* 2. Recording Overlay */}
      {audioState === 'RECORDING' && (
         <div className="absolute inset-0 z-50 bg-indigo-900/95 backdrop-blur-sm flex flex-col items-center justify-center animate-pop-in">
            <h2 className="text-white font-display text-3xl font-black mb-10 animate-pulse">I'm Listening...</h2>
            <div className="flex items-center gap-2 h-24 mb-12">
               {[...Array(5)].map((_, i) => (
                 <div 
                   key={i} 
                   className="w-4 bg-gradient-to-t from-pink-500 to-yellow-400 rounded-full animate-wave"
                   style={{ animationDelay: `${i * 0.1}s`, animationDuration: '0.8s' }}
                 ></div>
               ))}
            </div>
            <button 
              onClick={stopRecording}
              className="w-24 h-24 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(239,68,68,0.6)] border-8 border-white/50 transition-transform hover:scale-110 active:scale-95"
            >
              <StopIcon className="w-12 h-12 text-white" />
            </button>
            <p className="text-indigo-200 font-bold mt-6 text-xl">Tap to Finish</p>
         </div>
      )}

      {/* 3. Thinking Overlay */}
      {audioState === 'THINKING' && (
         <div className="absolute inset-0 z-50 bg-indigo-900/90 backdrop-blur-sm flex flex-col items-center justify-center">
             <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.3)] animate-bounce">
                <span className="text-6xl">🤖</span>
             </div>
             <div className="mt-8 flex gap-3">
               <div className="w-5 h-5 bg-pink-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
               <div className="w-5 h-5 bg-yellow-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
               <div className="w-5 h-5 bg-cyan-400 rounded-full animate-bounce"></div>
             </div>
             <p className="mt-6 text-2xl font-display font-bold text-white">Thinking...</p>
         </div>
      )}

      {/* 4. Answer Modal */}
      {audioState === 'ANSWERING' && answer && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
           <div className="bg-white rounded-[2rem] p-8 shadow-2xl max-w-lg w-full relative animate-pop-in border-4 border-indigo-200">
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-gradient-to-br from-cyan-300 to-blue-500 rounded-full flex items-center justify-center border-8 border-white shadow-xl">
                 <span className="text-5xl">{isSpeaking ? '🗣️' : '🤖'}</span>
              </div>
              <div className="mt-10 text-center">
                 <p className="text-2xl md:text-3xl font-display font-bold text-slate-800 leading-normal">"{answer}"</p>
              </div>
              <div className="mt-8 flex justify-center gap-4">
                 <button 
                  onClick={() => playAudio(answer)}
                  className="px-6 py-4 bg-yellow-400 text-yellow-900 rounded-2xl font-bold shadow-md hover:bg-yellow-300 transition-all flex items-center gap-2"
                 >
                    <SpeakerIcon className="w-6 h-6" /> Replay
                 </button>
                <button 
                  onClick={closeAnswer}
                  className="px-8 py-4 bg-indigo-600 text-white text-xl font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-[0_6px_0_rgba(55,48,163,1)] active:shadow-none active:translate-y-2 btn-3d"
                >
                   Got it! 👍
                </button>
              </div>
           </div>
        </div>
      )}

      {/* 5. Part Details Card */}
      <div className={`
        absolute bottom-0 left-0 right-0 p-4 pt-12 pointer-events-none
        transition-transform duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) z-50
        ${selectedPart ? 'translate-y-0' : 'translate-y-[120%]'}
      `}>
        <div className="pointer-events-auto mx-auto max-w-2xl bg-white border-4 border-indigo-500 rounded-[2rem] shadow-2xl p-6 relative">
           <button 
             onClick={() => setSelectedPart(null)}
             className="absolute -top-5 -right-2 bg-indigo-500 text-white w-12 h-12 flex items-center justify-center rounded-full border-4 border-white shadow-lg hover:bg-indigo-600 active:scale-95 transition-all"
           >
             <CloseIcon className="w-6 h-6" />
           </button>
           <div className="flex flex-col gap-3">
             <div className="flex items-center gap-4">
               <div className="w-14 h-14 bg-yellow-100 rounded-full flex items-center justify-center border-2 border-yellow-300 flex-shrink-0 text-3xl">
                 {isSpeaking ? '🗣️' : '🔍'}
               </div>
               <h3 className="text-2xl md:text-3xl font-display font-black text-indigo-800">
                 {selectedPart?.name}
               </h3>
               {isSpeaking && <SpeakerIcon className="w-6 h-6 text-indigo-400 animate-pulse ml-auto" />}
             </div>
             <div className="bg-indigo-50 p-4 rounded-xl border-2 border-indigo-100">
                <p className="text-xl font-bold text-slate-700 leading-relaxed font-display">
                  {selectedPart?.explanation}
                </p>
             </div>
           </div>
        </div>
      </div>

    </div>
  );
};