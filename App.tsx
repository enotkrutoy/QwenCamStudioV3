
import React, { useState, useEffect } from 'react';
import { GenerationSettings, ImageData, GenerationResult, CameraPreset } from './types';
import { DEFAULT_SETTINGS } from './constants';
import { useCameraControls } from './hooks/useCameraControls';
import { Camera3DControl } from './components/Camera3DControl';
import { ImageUploader } from './components/ImageUploader';
import { GenerationSettingsPanel } from './components/GenerationSettings';
import { PromptConsole } from './components/PromptConsole';
import { HistorySidebar } from './components/HistorySidebar';
import { CameraSliders } from './components/CameraSliders';
import { PresetGallery } from './components/PresetGallery';
import { geminiService } from './services/geminiService';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const App: React.FC = () => {
  const { 
    state: cameraState, 
    updateState: updateCamera, 
    reset: resetCamera, 
    generatedPrompt 
  } = useCameraControls();
  
  const [settings, setSettings] = useState<GenerationSettings>(DEFAULT_SETTINGS);
  const [sourceImage, setSourceImage] = useState<ImageData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<GenerationResult[]>([]);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Adaptive UI State
  const [activeView, setActiveView] = useState<'control' | 'result'>('control');
  const [activeTab, setActiveTab] = useState<'3d' | 'sliders'>('3d');
  const [activePreset, setActivePreset] = useState<CameraPreset | undefined>('default');
  const [apiKeyReady, setApiKeyReady] = useState<boolean | null>(null);
  
  const [isZoomed, setIsZoomed] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success'>('idle');

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setApiKeyReady(hasKey);
      } else {
        setApiKeyReady(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setApiKeyReady(true);
    }
  };

  const copyImageToClipboard = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const item = new ClipboardItem({ [blob.type]: blob });
      await navigator.clipboard.write([item]);
      setCopyStatus('success');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      setError("Clipboard access denied. Try downloading the image instead.");
    }
  };

  const downloadImage = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `qwencam-v3-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const shareImage = async (url: string) => {
    if (navigator.share) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const file = new File([blob], "reconstruction.png", { type: blob.type });
        await navigator.share({
          files: [file],
          title: 'QwenCam Reconstruction',
          text: 'AI-generated spatial perspective reconstruction.',
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError("Mobile sharing failed. Using clipboard fallback.");
          copyImageToClipboard(url);
        }
      }
    } else {
      copyImageToClipboard(url);
    }
  };

  const startGenerationFlow = async () => {
    if (!sourceImage) return;
    if (settings.quality === 'pro' && !apiKeyReady) {
      await handleSelectKey();
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const { imageUrl, groundingChunks } = await geminiService.generateImage(sourceImage, generatedPrompt, settings);
      const newResult: GenerationResult = {
        id: Math.random().toString(36).substring(7),
        imageUrl,
        prompt: generatedPrompt,
        timestamp: Date.now(),
        settings: { ...settings },
        cameraState: { ...cameraState },
        groundingChunks,
      };
      setResult(newResult);
      setHistory(prev => [newResult, ...prev]);
      // Intelligent view switching on mobile
      if (window.innerWidth < 1024) setActiveView('result');
    } catch (err: any) {
      if (err.message?.includes("Requested entity was not found.")) {
        setError("SYSTEM_FAULT: Invalid API Key project. Use a paid project in AI Studio.");
        setApiKeyReady(false);
      } else {
        setError(err.message || "Spatial reconstruction fault.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col font-sans selection:bg-orange-500/30 overflow-x-hidden">
      {/* Dynamic Header */}
      <header className="h-16 flex items-center justify-between px-6 lg:px-10 border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-[100]">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-orange-600 rounded-xl flex items-center justify-center font-black text-xs shadow-lg shadow-orange-600/30">QC</div>
          <h1 className="text-sm font-black uppercase tracking-[0.3em] hidden sm:block">QwenCam <span className="text-orange-500">V3</span></h1>
        </div>
        
        <div className="flex gap-6 lg:gap-10">
          <button 
            onClick={() => setActiveTab('3d')}
            className={`text-[10px] font-black uppercase tracking-[0.2em] pb-1 border-b-2 transition-all ${activeTab === '3d' ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            3D Control
          </button>
          <button 
            onClick={() => setActiveTab('sliders')}
            className={`text-[10px] font-black uppercase tracking-[0.2em] pb-1 border-b-2 transition-all ${activeTab === 'sliders' ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
          >
            Axis Logic
          </button>
        </div>

        <div className="flex items-center gap-4">
          {settings.quality === 'pro' && !apiKeyReady ? (
            <button onClick={handleSelectKey} className="text-[9px] bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-full font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 transition-all active:scale-90">
              Unlock Pro
            </button>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              <span className="text-[9px] font-black uppercase text-gray-400">System Ready</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col lg:grid lg:grid-cols-[1fr_420px] lg:h-[calc(100vh-64px)] overflow-hidden">
        
        {/* Interaction Canvas */}
        <section className={`flex-1 flex flex-col p-4 lg:p-10 gap-8 overflow-y-auto custom-scrollbar transition-opacity duration-300 ${activeView === 'result' ? 'hidden lg:flex' : 'flex opacity-100'}`}>
          <div className="relative aspect-[16/10] lg:aspect-auto lg:flex-1 min-h-[450px] bg-black rounded-[3rem] overflow-hidden shadow-2xl border border-white/5 group">
            {activeTab === '3d' ? (
              <Camera3DControl state={cameraState} sourceImage={sourceImage} onChange={updateCamera} activePreset={activePreset} />
            ) : (
              <div className="p-10 h-full overflow-y-auto">
                <CameraSliders state={cameraState} onChange={updateCamera} onReset={resetCamera} />
              </div>
            )}
            {!sourceImage && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#050505]/95 backdrop-blur-3xl p-6">
                <div className="w-full max-w-md scale-up-center"><ImageUploader onUpload={setSourceImage} /></div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-6 h-20">
            <button onClick={resetCamera} className="bg-white/5 border border-white/5 rounded-3xl text-[11px] font-black uppercase tracking-[0.3em] hover:bg-white/10 transition-all active:scale-95 group flex items-center justify-center gap-3">
              <span className="group-hover:rotate-180 transition-transform duration-700 opacity-50">↺</span>
              Reset Angle
            </button>
            <button 
              onClick={startGenerationFlow}
              disabled={!sourceImage || isGenerating}
              className={`rounded-3xl text-[11px] font-black uppercase tracking-[0.3em] transition-all shadow-2xl active:scale-95 flex items-center justify-center gap-3 ${(!sourceImage || isGenerating) ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-orange-600 text-white hover:bg-orange-500 hover:shadow-orange-600/30'}`}
            >
              {isGenerating ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <span className="animate-pulse">⚡</span>
                  Reconstruct
                </>
              )}
            </button>
          </div>

          <div className="hidden lg:block h-32"><PromptConsole prompt={generatedPrompt} /></div>
        </section>

        {/* Global Result Panel */}
        <aside className={`w-full lg:w-[420px] border-l border-white/5 bg-[#080808]/50 backdrop-blur-md flex flex-col p-4 lg:p-10 gap-10 overflow-y-auto custom-scrollbar transition-transform duration-500 ${activeView === 'control' ? 'hidden lg:flex' : 'flex translate-x-0'}`}>
          <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Output Frame</h2>
              {result && (
                 <span className="text-[8px] font-bold text-orange-500/60 font-mono tracking-widest">RES: 1024x1024</span>
              )}
            </div>
            <div className="relative aspect-square rounded-[3rem] bg-black border border-white/10 overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)] flex items-center justify-center group/img">
              {result ? (
                <>
                  <img 
                    src={result.imageUrl} 
                    className="w-full h-full object-cover cursor-zoom-in transition-transform duration-1000 group-hover/img:scale-110" 
                    alt="Resulting Perspective" 
                    onClick={() => setIsZoomed(true)} 
                  />
                  
                  {/* Floating Action Bar - Mobile Friendly */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <button 
                      onClick={() => downloadImage(result.imageUrl)} 
                      className="w-14 h-14 bg-black/80 backdrop-blur-2xl rounded-2xl flex items-center justify-center border border-white/10 hover:bg-orange-600 hover:scale-110 transition-all shadow-2xl active:scale-90"
                      title="Download Reconstruction"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </button>
                    <button 
                      onClick={() => setIsZoomed(true)} 
                      className="w-14 h-14 bg-black/80 backdrop-blur-2xl rounded-2xl flex items-center justify-center border border-white/10 hover:bg-orange-600 hover:scale-110 transition-all shadow-2xl active:scale-90"
                      title="Fullscreen Zoom"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                    </button>
                    <button 
                      onClick={() => shareImage(result.imageUrl)} 
                      className="w-14 h-14 bg-black/80 backdrop-blur-2xl rounded-2xl flex items-center justify-center border border-white/10 hover:bg-orange-600 hover:scale-110 transition-all shadow-2xl active:scale-90 lg:hidden"
                      title="Share / Save"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-6 opacity-20">
                  <div className="w-20 h-20 border-2 border-dashed border-gray-600 rounded-full flex items-center justify-center">
                    <div className="w-10 h-10 bg-gray-600/30 rounded-full" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.5em] text-center">Identity Logic Idle</p>
                </div>
              )}
              {isGenerating && (
                <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center gap-6 animate-in fade-in">
                  <div className="relative">
                    <div className="w-16 h-16 border-t-2 border-orange-500 rounded-full animate-spin shadow-[0_0_30px_rgba(249,115,22,0.4)]" />
                    <div className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-orange-500 animate-pulse">AI</div>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-[10px] font-mono font-black text-orange-500 uppercase tracking-[0.3em] animate-pulse">Preserving Identity...</p>
                    <p className="text-[7px] font-mono text-gray-600 uppercase tracking-widest">Reconstructing vanishing points</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <PresetGallery activePreset={activePreset} onSelect={(s, id) => { updateCamera(s); setActivePreset(id); }} />
          <GenerationSettingsPanel settings={settings} onChange={(u) => setSettings(s => ({...s, ...u}))} />
          <HistorySidebar history={history} onSelect={(i) => {setResult(i); updateCamera(i.cameraState);}} onClear={() => setHistory([])} />
        </aside>

        {/* Dynamic Navigation Switcher - Mobile */}
        <div className="lg:hidden fixed bottom-8 left-1/2 -translate-x-1/2 flex bg-black/80 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-2 shadow-2xl z-[200]">
          <button 
            onClick={() => setActiveView('control')}
            className={`px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${activeView === 'control' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30 scale-105' : 'text-gray-500'}`}
          >
            Stage
          </button>
          <button 
            onClick={() => setActiveView('result')}
            className={`px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all duration-500 ${activeView === 'result' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30 scale-105' : 'text-gray-500'}`}
          >
            Output
          </button>
        </div>
      </main>

      {/* Advanced Fullscreen Zoom Overlay */}
      {isZoomed && result && (
        <div 
          className="fixed inset-0 z-[500] bg-black/98 backdrop-blur-3xl flex flex-col items-center justify-center p-6 lg:p-12 animate-in fade-in zoom-in duration-500 overflow-hidden" 
          onClick={() => setIsZoomed(false)}
        >
          <div className="relative max-w-full max-h-full flex flex-col items-center gap-10" onClick={e => e.stopPropagation()}>
            <div className="relative group/zoom border border-white/5 rounded-[3rem] overflow-hidden shadow-[0_0_120px_rgba(0,0,0,1)]">
              <img 
                src={result.imageUrl} 
                className="max-h-[80vh] w-auto object-contain transition-transform duration-1000 group-hover/zoom:scale-105" 
                alt="Enlarged Reconstruction" 
              />
            </div>
            
            <div className="flex flex-wrap justify-center gap-4 animate-in slide-in-from-bottom-5 duration-700">
              <button 
                onClick={() => downloadImage(result.imageUrl)}
                className="bg-white/10 hover:bg-white/20 px-10 py-5 rounded-3xl flex items-center gap-4 font-black text-[11px] uppercase tracking-widest border border-white/10 transition-all active:scale-90 hover:shadow-xl group"
              >
                <svg className="group-hover:translate-y-1 transition-transform" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export PNG
              </button>
              
              <button 
                onClick={() => copyImageToClipboard(result.imageUrl)}
                className="bg-white/10 hover:bg-white/20 px-10 py-5 rounded-3xl flex items-center gap-4 font-black text-[11px] uppercase tracking-widest border border-white/10 transition-all active:scale-90 hover:shadow-xl"
              >
                {copyStatus === 'success' ? 'Frame Copied' : 'Copy to Clipboard'}
              </button>

              <button 
                onClick={() => shareImage(result.imageUrl)}
                className="bg-orange-600 hover:bg-orange-500 px-10 py-5 rounded-3xl flex items-center gap-4 font-black text-[11px] uppercase tracking-widest transition-all shadow-2xl shadow-orange-600/40 active:scale-90 group"
              >
                <svg className="group-hover:rotate-12 transition-transform" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                System Share
              </button>

              <button 
                onClick={() => setIsZoomed(false)}
                className="bg-white/5 hover:bg-white/10 px-10 py-5 rounded-3xl font-black text-[11px] uppercase tracking-widest border border-white/5 transition-colors"
              >
                Exit View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Notifications */}
      {error && (
        <div className="fixed bottom-28 lg:bottom-12 left-1/2 -translate-x-1/2 z-[600] bg-red-600 text-white px-8 py-5 rounded-3xl font-black text-[11px] tracking-widest shadow-2xl animate-in slide-in-from-bottom-12 duration-500 flex items-center gap-5 border border-white/10">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {error}
          <button onClick={() => setError(null)} className="opacity-50 hover:opacity-100 transition-opacity">CLOSE</button>
        </div>
      )}
      
      {copyStatus === 'success' && !isZoomed && (
        <div className="fixed bottom-28 lg:bottom-12 left-1/2 -translate-x-1/2 z-[600] bg-green-600 text-white px-10 py-5 rounded-3xl font-black text-[11px] tracking-widest shadow-2xl animate-in slide-in-from-bottom-12 duration-500 border border-white/10">
          Frame processed successfully!
        </div>
      )}
    </div>
  );
};

export default App;
