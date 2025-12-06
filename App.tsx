
import React, { useState, useCallback } from 'react';
import { analyzeImage } from './services/geminiService';
import { AnalysisResult, AppState } from './types';
import { Loading } from './components/Loading';
import { AROverlay } from './components/AROverlay';
import { CameraView } from './components/CameraView';
import { CameraIcon, UploadIcon } from './components/Icons';

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reusable function to process an image (from file or camera)
  const processImage = useCallback(async (base64: string) => {
    setImageSrc(base64);
    setAppState(AppState.ANALYZING);
    setError(null);

    try {
      // Minimum loading time for UX (so the animation isn't too jarringly fast)
      const minLoadTime = new Promise(resolve => setTimeout(resolve, 2500));
      const analysisPromise = analyzeImage(base64);
      
      const [result] = await Promise.all([analysisPromise, minLoadTime]);
      
      setAnalysisResult(result);
      setAppState(AppState.RESULTS);
    } catch (err) {
      console.error(err);
      setError("Oops! The magical robot got confused. Try a clearer picture!");
      setAppState(AppState.ERROR);
    }
  }, []);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      await processImage(base64);
    };
    reader.readAsDataURL(file);
  }, [processImage]);

  const handleCameraCapture = useCallback(async (base64: string) => {
    // Transition from Camera directly to processing
    await processImage(base64);
  }, [processImage]);

  const resetApp = () => {
    setImageSrc(null);
    setAnalysisResult(null);
    setAppState(AppState.IDLE);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-indigo-950 text-white relative overflow-hidden font-display selection:bg-pink-500 selection:text-white">
      
      {/* Background decorations */}
      {appState === AppState.IDLE && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 text-6xl animate-float opacity-20">🪐</div>
          <div className="absolute bottom-40 right-10 text-6xl animate-float-delayed opacity-20">🚀</div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px]"></div>
          
          <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-400/10 rounded-full blur-[80px]"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-400/10 rounded-full blur-[80px]"></div>
        </div>
      )}

      {/* IDLE VIEW */}
      {appState === AppState.IDLE && (
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6 text-center">
          
          {/* Logo / Title Area */}
          <div className="mb-8 animate-bounce-gentle">
             <div className="inline-flex items-center justify-center p-4 bg-white rounded-3xl border-b-8 border-indigo-200 shadow-xl mb-4">
                <span className="text-4xl mr-2">✨</span>
                <span className="text-4xl mr-2">👀</span>
             </div>
             <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-pink-400 to-cyan-400 drop-shadow-sm tracking-tight leading-tight pb-2">
                Wonder<br/>Scanner
             </h1>
             <p className="text-indigo-200 text-xl font-bold mt-2">Find out how stuff works!</p>
          </div>

          <div className="max-w-md w-full bg-indigo-900/50 backdrop-blur-sm border-2 border-indigo-500/30 rounded-3xl p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">Hi there, explorer! 🤠</h2>
            <p className="text-indigo-200 text-lg">
              Take a photo of a <span className="text-pink-300 font-bold">toy</span>, a <span className="text-yellow-300 font-bold">flower</span>, or <span className="text-cyan-300 font-bold">anything</span> cool!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 w-full max-w-md">
            {/* Camera Button - Opens In-App Camera */}
            <button 
              onClick={() => setAppState(AppState.CAMERA)}
              className="flex-1 cursor-pointer group btn-3d"
            >
              <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-b from-cyan-400 to-cyan-500 border-b-8 border-cyan-700 rounded-3xl hover:brightness-110 transition-all h-full">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-2">
                   <CameraIcon className="w-8 h-8 text-white" />
                </div>
                <span className="font-black text-2xl text-white drop-shadow-md">Snap Photo</span>
              </div>
            </button>

            {/* Upload Button - Opens File Picker */}
            <label className="flex-1 cursor-pointer group btn-3d">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileChange}
                className="hidden" 
              />
              <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-b from-purple-500 to-purple-600 border-b-8 border-purple-800 rounded-3xl hover:brightness-110 transition-all h-full">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-2">
                   <UploadIcon className="w-8 h-8 text-white" />
                </div>
                <span className="font-black text-2xl text-white drop-shadow-md">Pick Photo</span>
              </div>
            </label>
          </div>
          
          <div className="mt-12 flex gap-3 opacity-50">
             <div className="w-3 h-3 rounded-full bg-white animate-bounce [animation-delay:-0.3s]"></div>
             <div className="w-3 h-3 rounded-full bg-white animate-bounce [animation-delay:-0.15s]"></div>
             <div className="w-3 h-3 rounded-full bg-white animate-bounce"></div>
          </div>
        </div>
      )}

      {/* CAMERA VIEW */}
      {appState === AppState.CAMERA && (
        <CameraView 
          onCapture={handleCameraCapture} 
          onClose={() => setAppState(AppState.IDLE)} 
        />
      )}

      {/* LOADING VIEW */}
      {appState === AppState.ANALYZING && <Loading />}

      {/* RESULTS VIEW */}
      {appState === AppState.RESULTS && imageSrc && analysisResult && (
        <AROverlay 
          imageSrc={imageSrc} 
          data={analysisResult} 
          onReset={resetApp} 
        />
      )}

      {/* ERROR VIEW */}
      {appState === AppState.ERROR && (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-indigo-950 relative overflow-hidden">
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-500/10 rounded-full blur-[100px] pointer-events-none"></div>
           
           <div className="w-32 h-32 bg-red-100 rounded-full flex items-center justify-center mb-6 border-8 border-red-200 animate-wiggle shadow-xl z-10">
             <span className="text-6xl">🙈</span>
           </div>
           
           <h3 className="text-4xl font-black mb-4 text-white z-10">Uh oh!</h3>
           <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 mb-8 max-w-sm z-10">
              <p className="text-xl text-white font-bold">{error}</p>
           </div>
           
           <button 
             onClick={resetApp}
             className="px-8 py-4 bg-yellow-400 text-yellow-900 rounded-2xl font-black text-xl hover:bg-yellow-300 transition-all border-b-8 border-yellow-600 active:border-b-0 active:translate-y-2 btn-3d z-10"
           >
             Try Again!
           </button>
        </div>
      )}
    </div>
  );
}

export default App;
