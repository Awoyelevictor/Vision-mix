import React, { useRef, useEffect, useState } from 'react';
import { Radio, Maximize2, Camera, Volume2, VolumeX, Disc, Monitor, Sparkles } from 'lucide-react';
import { CameraNode } from '../../types/visionmix';
import { AudioMeter } from '../common/AudioMeter';

interface LiveOutputMonitorProps {
  activeCamera: CameraNode | null;
  remoteStream: MediaStream | null;
  frameBlob: string | null;
  isRecording: boolean;
  recordingDurationSeconds: number;
  eventName: string;
  eventLogoUrl?: string | null;
  resolution: string;
  fps: number;
  onToggleRecording: () => void;
}

export const LiveOutputMonitor: React.FC<LiveOutputMonitorProps> = ({
  activeCamera,
  remoteStream,
  frameBlob,
  isRecording,
  recordingDurationSeconds,
  eventName,
  eventLogoUrl,
  resolution,
  fps,
  onToggleRecording,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(false);
  const [snapshotSuccess, setSnapshotSuccess] = useState(false);
  const [objectFitMode, setObjectFitMode] = useState<'contain' | 'cover'>('contain');

  // Format recording time hh:mm:ss
  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (videoRef.current) {
      if (remoteStream) {
        if (videoRef.current.srcObject !== remoteStream) {
          videoRef.current.srcObject = remoteStream;
          videoRef.current.play().catch((err) => console.warn('Auto play video error:', err));
        }
        console.log(`[LiveOutputMonitor] Active camera ${activeCamera?.name || ''} rendering via WebRTC MediaStream srcObject`);
      } else {
        videoRef.current.srcObject = null;
        if (frameBlob) {
          console.log(`[LiveOutputMonitor] Active camera ${activeCamera?.name || ''} rendering via Fallback JPEG frame stream`);
        }
      }
    }
  }, [remoteStream, frameBlob, activeCamera]);

  const handleTakeSnapshot = () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 1920;
      canvas.height = videoRef.current.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `VisionMix_Snapshot_${Date.now()}.png`;
        a.click();
        setSnapshotSuccess(true);
        setTimeout(() => setSnapshotSuccess(false), 2000);
      }
    } catch (e) {
      console.warn('Snapshot failed:', e);
    }
  };

  const handleFullscreen = () => {
    const monitorEl = document.getElementById('live-monitor-container');
    if (monitorEl) {
      if (!document.fullscreenElement) {
        monitorEl.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  return (
    <div
      id="live-monitor-container"
      className="relative w-full aspect-video bg-black rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden group flex items-center justify-center"
    >
      {/* Video Content / Frame stream / Waiting state */}
      {remoteStream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={`w-full h-full bg-zinc-950 transition-all duration-300 ${
            objectFitMode === 'contain' ? 'object-contain' : 'object-cover'
          }`}
        />
      ) : frameBlob ? (
        <img
          src={frameBlob}
          alt="Live Stream Frame"
          className={`w-full h-full bg-zinc-950 transition-all duration-300 ${
            objectFitMode === 'contain' ? 'object-contain' : 'object-cover'
          }`}
        />
      ) : activeCamera ? (
        <div className="flex flex-col items-center justify-center gap-3 text-zinc-400">
          <div className="w-12 h-12 rounded-full border-2 border-indigo-500/40 border-t-indigo-500 animate-spin flex items-center justify-center">
            <Radio className="w-5 h-5 text-indigo-400" />
          </div>
          <p className="text-sm font-medium text-zinc-300">
            Connecting stream from <span className="text-indigo-400">{activeCamera.name}</span>...
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 text-center p-6 text-zinc-500">
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
            <Monitor className="w-8 h-8 text-zinc-600" />
          </div>
          <div>
            <h4 className="text-zinc-300 font-semibold text-base">NO LIVE STREAM SELECTED</h4>
            <p className="text-xs text-zinc-500 max-w-sm mt-1">
              Connect a camera on mobile device or select a camera below to push live output.
            </p>
          </div>
        </div>
      )}

      {/* Top Banner Overlay */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between text-xs pointer-events-none">
        {/* Left: LIVE Badge + Event Name */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-red-600 text-white font-bold rounded-md tracking-wider shadow-lg shadow-red-600/30 uppercase text-[11px]">
            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
            <span>LIVE OUTPUT</span>
          </div>

          <div className="flex items-center gap-2 bg-zinc-900/80 backdrop-blur-md px-3 py-1 rounded-md border border-zinc-700/50 text-zinc-200">
            {eventLogoUrl ? (
              <img src={eventLogoUrl} alt="Event Logo" className="w-4 h-4 object-contain rounded shrink-0" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            )}
            <span className="font-semibold text-white">{eventName}</span>
          </div>

          {activeCamera && (
            <div
              className={`px-2.5 py-1 rounded-md font-mono text-[11px] uppercase font-bold border flex items-center gap-1.5 ${
                remoteStream
                  ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                  : 'bg-amber-950/80 border-amber-700 text-amber-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  remoteStream ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span>{remoteStream ? 'WebRTC (Low Latency)' : 'Fallback JPEG'}</span>
            </div>
          )}
        </div>

        {/* Right: Resolution + Recording Timer */}
        <div className="flex items-center gap-3 pointer-events-auto">
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-950/80 border border-red-800/80 text-red-300 font-mono rounded-md text-xs font-semibold animate-pulse">
              <Disc className="w-3.5 h-3.5 text-red-500 animate-spin" />
              <span>REC {formatTime(recordingDurationSeconds)}</span>
            </div>
          )}

          <div className="bg-zinc-900/80 backdrop-blur-md px-2.5 py-1 rounded-md border border-zinc-700/50 text-zinc-300 font-mono text-[11px]">
            {resolution} • {fps}FPS
          </div>
        </div>
      </div>

      {/* Bottom Overlay Info & Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-end justify-between transition-opacity duration-300">
        {/* Left: Active Camera & Operator details */}
        {activeCamera && (
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 bg-zinc-900/90 backdrop-blur-md rounded-xl border border-zinc-700/50 text-xs">
              <span className="text-zinc-400 block text-[10px] uppercase font-semibold">Active Camera</span>
              <span className="font-bold text-white text-sm">{activeCamera.name}</span>
            </div>

            <div className="px-3 py-1.5 bg-zinc-900/90 backdrop-blur-md rounded-xl border border-zinc-700/50 text-xs">
              <span className="text-zinc-400 block text-[10px] uppercase font-semibold">Operator</span>
              <span className="font-medium text-zinc-200">{activeCamera.operatorName}</span>
            </div>

            {/* Audio Meter */}
            <div className="px-3 py-1.5 bg-zinc-900/90 backdrop-blur-md rounded-xl border border-zinc-700/50 flex items-center gap-2">
              <span className="text-[10px] text-zinc-400 font-semibold uppercase">AUDIO</span>
              <AudioMeter stream={remoteStream} muted={muted} />
            </div>
          </div>
        )}

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setObjectFitMode((prev) => (prev === 'contain' ? 'cover' : 'contain'))}
            title={objectFitMode === 'contain' ? 'Fit (Letterbox)' : 'Fill (Crop)'}
            className="px-2.5 py-1 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 rounded-xl border border-zinc-700/50 transition-colors text-xs font-semibold flex items-center gap-1"
          >
            <span className="text-indigo-400">{objectFitMode === 'contain' ? 'Fit' : 'Fill'}</span>
          </button>

          <button
            onClick={() => setMuted(!muted)}
            title={muted ? 'Unmute Audio' : 'Mute Audio'}
            className="p-2 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 rounded-xl border border-zinc-700/50 transition-colors"
          >
            {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            onClick={handleTakeSnapshot}
            title="Take Photo Snapshot"
            className="p-2 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 rounded-xl border border-zinc-700/50 transition-colors relative"
          >
            <Camera className="w-4 h-4" />
            {snapshotSuccess && (
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded font-medium shadow">
                Saved!
              </span>
            )}
          </button>

          <button
            onClick={handleFullscreen}
            title="Fullscreen Monitor"
            className="p-2 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 rounded-xl border border-zinc-700/50 transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
