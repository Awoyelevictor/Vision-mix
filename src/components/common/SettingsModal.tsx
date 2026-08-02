import React, { useState, useRef } from 'react';
import { X, Sliders, Monitor, Radio, Volume2, Keyboard, Sparkles, Upload, Image as ImageIcon, Trash2 } from 'lucide-react';
import { StudioConfig } from '../../types/visionmix';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: StudioConfig;
  onSaveConfig: (updated: Partial<StudioConfig>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [eventName, setEventName] = useState(config.eventName);
  const [projectorAlertMessage, setProjectorAlertMessage] = useState(config.projectorAlertMessage || '');
  const [eventLogoUrl, setEventLogoUrl] = useState<string | null>(config.eventLogoUrl || null);
  const [targetResolution, setTargetResolution] = useState(config.targetResolution);
  const [targetFps, setTargetFps] = useState<30 | 60>(config.targetFps);
  const [tallyEnabled, setTallyEnabled] = useState(config.tallyEnabled);
  const [audioEnabled, setAudioEnabled] = useState(config.audioEnabled);
  const [activeTab, setActiveTab] = useState<'general' | 'video' | 'audio' | 'hotkeys'>('general');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds 5MB limit. Please upload a smaller image.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setEventLogoUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    onSaveConfig({
      eventName,
      projectorAlertMessage,
      eventLogoUrl,
      targetResolution,
      targetFps,
      tallyEnabled,
      audioEnabled,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 border border-zinc-700/50 rounded-xl text-zinc-300">
              <Sliders className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">Studio Settings</h3>
              <p className="text-xs text-zinc-400">Configure event details, resolution & hotkeys</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 px-5 bg-zinc-950/40 gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('general')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'general'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            General
          </button>
          <button
            onClick={() => setActiveTab('video')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'video'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Monitor className="w-4 h-4" />
            Video & Tally
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'audio'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            Audio
          </button>
          <button
            onClick={() => setActiveTab('hotkeys')}
            className={`py-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'hotkeys'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            Shortcuts
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto max-h-[60vh]">
          {activeTab === 'general' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                  Event / Service Title
                </label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="e.g. Sunday Morning Live Stream"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <p className="mt-1.5 text-xs text-zinc-500">
                  This title appears on top of the live output monitor and projector screen.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                  Projector Marquee Alert
                </label>
                <input
                  type="text"
                  value={projectorAlertMessage}
                  onChange={(e) => setProjectorAlertMessage(e.target.value)}
                  placeholder="e.g. Please silient your mobile phones during the service."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <p className="mt-1.5 text-xs text-zinc-500">
                  Scrolling message that appears at the bottom of the projector output.
                </p>
              </div>

              {/* Event / Brand Logo Upload */}
              <div className="pt-3 border-t border-zinc-800/60">
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                  Event / Brand Logo
                </label>
                <div className="flex items-center gap-4 bg-zinc-950 p-3.5 border border-zinc-800 rounded-xl">
                  <div className="w-14 h-14 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                    {eventLogoUrl ? (
                      <img src={eventLogoUrl} alt="Brand Logo Preview" className="w-full h-full object-contain p-1" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-zinc-600" />
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleLogoUpload}
                        accept="image/png, image/jpeg, image/svg+xml, image/webp"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{eventLogoUrl ? 'Change Logo' : 'Upload Logo'}</span>
                      </button>

                      {eventLogoUrl && (
                        <button
                          type="button"
                          onClick={() => setEventLogoUrl(null)}
                          className="px-2.5 py-1.5 bg-zinc-900 hover:bg-red-950/60 hover:text-red-300 text-zinc-400 text-xs font-medium rounded-lg border border-zinc-800 hover:border-red-800 flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Upload PNG, SVG, or JPG logo (max 5MB). Displays next to event title on studio controller and projector output.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-800/60">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-white">Local Network Connection Mode</h4>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Operates over WebSockets & peer-to-peer WebRTC over local Wi-Fi without cloud dependencies.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium">
                    Local Active
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'video' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                  Target Stream Quality
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['1080p', '720p', '480p'] as const).map((res) => (
                    <button
                      key={res}
                      type="button"
                      onClick={() => setTargetResolution(res)}
                      className={`py-2.5 px-4 rounded-xl text-sm font-medium border transition-all ${
                        targetResolution === res
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      {res} HD
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                  Target Frame Rate
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {([30, 60] as const).map((fps) => (
                    <button
                      key={fps}
                      type="button"
                      onClick={() => setTargetFps(fps)}
                      className={`py-2.5 px-4 rounded-xl text-sm font-medium border transition-all ${
                        targetFps === fps
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      {fps} FPS
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-white">Mobile Camera Tally Border Glow</h4>
                  <p className="text-xs text-zinc-400">
                    Flash camera phone screen edges bright red when the camera is designated LIVE.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={tallyEnabled}
                  onChange={(e) => setTallyEnabled(e.target.checked)}
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          {activeTab === 'audio' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl">
                <div>
                  <h4 className="text-sm font-medium text-white">Enable Audio Passthrough</h4>
                  <p className="text-xs text-zinc-400">
                    Pass camera microphone audio to the main live stream output monitor and recorder.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={audioEnabled}
                  onChange={(e) => setAudioEnabled(e.target.checked)}
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-300 flex items-start gap-3">
                <Radio className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block text-indigo-200">Automatic Audio Switching</span>
                  VisionMix automatically switches the active audio source to match the current LIVE camera source, or maintains master audio feed when selected.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'hotkeys' && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-400">
                Use physical keyboard numerical shortcuts on the Studio Controller dashboard to switch cameras instantly:
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg">
                  <span className="text-zinc-300">Switch to Camera 1 - 9</span>
                  <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 font-mono text-xs">
                    1 - 9
                  </kbd>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg">
                  <span className="text-zinc-300">Toggle Recording</span>
                  <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 font-mono text-xs">
                    R
                  </kbd>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-zinc-950 border border-zinc-800 rounded-lg">
                  <span className="text-zinc-300">Toggle Projector Fullscreen</span>
                  <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 font-mono text-xs">
                    F
                  </kbd>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium shadow-lg shadow-indigo-600/20 transition-all"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
