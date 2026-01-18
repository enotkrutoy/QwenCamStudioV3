
import React, { useState, useEffect, useCallback } from 'react';
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
  
  const [activeView, setActiveView] = useState<'control' | 'result'>('control');
  const [activeTab, setActiveTab] = useState<'3d' | 'sliders'>('3d');
  const [activePreset, setActivePreset] = useState<CameraPreset | undefined>('default');
  const [apiKeyReady, setApiKeyReady] = useState<boolean | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);

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
      // Assume success as per instructions
      setApiKeyReady(true);
    }
  };

  const startGenerationFlow = useCallback(async () => {
    if (!sourceImage) return;
    
    setIsGenerating(true);
    setError(null);

    try {
      const { imageUrl, groundingChunks } = await geminiService.generateImage(sourceImage, generatedPrompt, settings);
      
      const newResult: GenerationResult = {
        id: crypto.randomUUID(),
        imageUrl,
        prompt: generatedPrompt,
        timestamp: Date.now(),
        settings: { ...settings },
        cameraState: { ...cameraState },
        groundingChunks,
      };

      setResult(newResult);
      setHistory(prev => [newResult, ...prev]);
      
      // Auto-switch to result on mobile
      if (window.innerWidth < 1024) setActiveView('result');
    } catch (err: any) {
      if (err.message?.includes("Requested entity was not found.")) {
        setError("Invalid project or key. Please re-select a paid API key.");
        setApiKeyReady(false);
        handleSelectKey();
      } else {
        setError(err.message || "Engine Error: Perspective reconstruction failed.");
      }
    } finally {
      setIsGenerating(false);
    }
  }, [sourceImage, generatedPrompt, settings, cameraState]);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col font-sans selection:bg-orange-500/30 overflow-hidden">
      {/* Universal Header */}
      <header className="h-16 flex items-center justify-between px-6 lg:px-10 border-b border-white/5 bg-black/40 backdrop-blur-xl shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-orange-600 rounded-xl flex items-center justify-center font-black text-xs shadow-lg shadow-orange-600/30">QC</div>
          <h1 className="text-sm font-black uppercase tracking-[0.3em] hidden sm:block">QwenCam <span className="text-orange-500">V3</span></h1>
        </div>
        
        <div className="flex gap-8">
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
            Axis Settings
          </button>
        </div>

        <div className="flex items-center gap-4">
          {!apiKeyReady && (
            <button onClick={handleSelectKey} className="text-[9px] bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-full font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 transition-all">
              Authorize AI
            </button>
          )}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
            <div className={`w-1.5 h-1.5 rounded-full ${apiKeyReady ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
            <span className="text-[9px] font-black uppercase text-gray-400">Node Status</span>
          </div>
        </div>
      </header>

      {/* Main Adaptive Layout */}
      <main className="flex-1 flex flex-col lg:grid lg:grid-cols-[1fr_450px] overflow-hidden">
        
        {/* Interaction Stage */}
        <section className={`flex-1 flex flex-col p-4 lg:p-10 gap-6 overflow-y-auto ${activeView === 'result' ? 'hidden lg:flex' : 'flex'}`}>
          <div className="relative flex-1 min-h-[400px] bg-black rounded-[3rem] overflow-hidden border border-white/5 shadow-2xl">
            {activeTab === '3d' ? (
              <Camera3DControl state={cameraState} sourceImage={sourceImage} onChange={updateCamera} activePreset={activePreset} />
            ) : (
              <div className="p-8 h-full overflow-y-auto scrollbar-hide">
                <CameraSliders state={cameraState} onChange={updateCamera} onReset={resetCamera} />
              </div>
            )}
            {!sourceImage && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#050505]/95 backdrop-blur-3xl p-6">
                <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
                  <ImageUploader onUpload={setSourceImage} />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 h-16 lg:h-20">
            <button onClick={resetCamera} className="bg-white/5 border border-white/5 rounded-3xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95">
              Reset View
            </button>
            <button 
              onClick={startGenerationFlow}
              disabled={!sourceImage || isGenerating}
              className={`rounded-3xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${(!sourceImage || isGenerating) ? 'bg-gray-800 text-gray-600' : 'bg-orange-600 text-white hover:bg-orange-500'}`}
            >
              {isGenerating ? 'Computing...' : 'Reconstruct Frame'}
            </button>
          </div>

          <div className="hidden lg:block h-32 shrink-0"><PromptConsole prompt={generatedPrompt} /></div>
        </section>

        {/* Global Output Sidebar */}
        <aside className={`w-full lg:w-[450px] border-l border-white/5 bg-[#080808]/80 backdrop-blur-xl flex flex-col p-6 lg:p-10 gap-8 overflow-y-auto scrollbar-hide ${activeView === 'control' ? 'hidden lg:flex' : 'flex'}`}>
          <div className="space-y-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 px-2">Processed Output</h2>
            <div className="relative aspect-square rounded-[2.5rem] bg-black border border-white/10 overflow-hidden group">
              {result ? (
                <img 
                  src={result.imageUrl} 
                  className="w-full h-full object-cover cursor-zoom-in group-hover:scale-110 transition-transform duration-1000" 
                  alt="AI Reconstruction" 
                  onClick={() => setIsZoomed(true)} 
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center opacity-20 gap-4">
                  <div className="w-16 h-16 border-2 border-dashed border-gray-600 rounded-full" />
                  <p className="text-[9px] font-black uppercase tracking-[0.5em]">Waiting for data</p>
                </div>
              )}
              {isGenerating && (
                <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-6">
                  <div className="w-12 h-12 border-t-2 border-orange-500 rounded-full animate-spin" />
                  <p className="text-[10px] font-mono text-orange-500 animate-pulse uppercase tracking-widest">Applying Identity Lock...</p>
                </div>
              )}
            </div>
          </div>

          <PresetGallery activePreset={activePreset} onSelect={(s, id) => { updateCamera(s); setActivePreset(id); }} />
          <GenerationSettingsPanel settings={settings} onChange={(u) => setSettings(s => ({...s, ...u}))} />
          <HistorySidebar history={history} onSelect={(i) => {setResult(i); updateCamera(i.cameraState);}} onClear={() => setHistory([])} />
        </aside>

        {/* Mobile Navigation Hub */}
        <nav className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-2 flex shadow-2xl z-50">
          <button 
            onClick={() => setActiveView('control')}
            className={`px-8 py-3 rounded-full text-[10px] font-black uppercase transition-all ${activeView === 'control' ? 'bg-orange-600 text-white' : 'text-gray-500'}`}
          >
            Stage
          </button>
          <button 
            onClick={() => setActiveView('result')}
            className={`px-8 py-3 rounded-full text-[10px] font-black uppercase transition-all ${activeView === 'result' ? 'bg-orange-600 text-white' : 'text-gray-500'}`}
          >
            Output
          </button>
        </nav>
      </main>

      {/* Global Toast */}
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl z-[100] animate-in slide-in-from-top-4">
          {error}
          <button onClick={() => setError(null)} className="ml-4 opacity-50">Dismiss</button>
        </div>
      )}
    </div>
  );
};

export default App;
