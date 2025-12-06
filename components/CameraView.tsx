
import React, { useRef, useEffect, useState } from 'react';
import { CloseIcon } from './Icons';

interface CameraViewProps {
  onCapture: (base64Image: string) => void;
  onClose: () => void;
}

export const CameraView: React.FC<CameraViewProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        // Prefer environment (rear) camera for scanning objects
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera access denied:", err);
        setError("Can't access camera. Please allow permission!");
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const takePicture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // High quality jpeg
        const base64 = canvas.toDataURL('image/jpeg', 0.9);
        onCapture(base64);
      }
    }
  };

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-indigo-950 flex flex-col items-center justify-center text-white p-6 text-center">
        <div className="text-6xl mb-4">📷🚫</div>
        <p className="text-2xl font-display font-bold mb-6">{error}</p>
        <button 
          onClick={onClose} 
          className="px-8 py-3 bg-red-500 rounded-2xl font-bold shadow-[0_4px_0_rgba(185,28,28,1)] active:shadow-none active:translate-y-1 transition-all"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className="flex-1 w-full h-full object-cover"
      />
      
      {/* Canvas for capturing (hidden) */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Overlay UI */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-10">
        <button 
          onClick={onClose} 
          className="bg-black/40 hover:bg-black/60 p-4 rounded-full text-white backdrop-blur-md transition-all active:scale-95"
          aria-label="Close Camera"
        >
          <CloseIcon className="w-8 h-8" />
        </button>
      </div>

      {/* Viewfinder Guide (Decoration) */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[80%] h-[60%] border-4 border-white/30 rounded-3xl relative">
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl"></div>
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl"></div>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl"></div>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl"></div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-10 flex justify-center pb-16 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <button 
          onClick={takePicture}
          className="group relative"
          aria-label="Take Picture"
        >
          <div className="absolute inset-0 bg-white/30 rounded-full blur-md group-hover:bg-white/50 transition-all"></div>
          <div className="relative w-24 h-24 rounded-full bg-white border-4 border-indigo-500 shadow-xl flex items-center justify-center transition-transform group-active:scale-90">
             <div className="w-20 h-20 rounded-full bg-indigo-50 border-2 border-indigo-200 group-hover:bg-indigo-100"></div>
          </div>
        </button>
      </div>
    </div>
  );
};
