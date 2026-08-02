import React, { useRef, useEffect } from 'react';
import { Battery, BatteryCharging, Wifi, Play, Radio, MessageSquare } from 'lucide-react';
import { CameraNode } from '../../types/visionmix';

interface CameraCardProps {
  camera: CameraNode;
  isLive: boolean;
  remoteStream?: MediaStream | null;
  frameBlob?: string | null;
  onSelectLive: (cameraId: string) => void;
  onOpenMessage?: (cameraId: string) => void;
}

export const CameraCard: React.FC<CameraCardProps> = ({
  camera,
  isLive,
  remoteStream,
  frameBlob,
  onSelectLive,
  onOpenMessage,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (remoteStream) {
        if (videoRef.current.srcObject !== remoteStream) {
          videoRef.current.srcObject = remoteStream;
          videoRef.current.play().catch(() => {});
        }
        console.log(`[CameraCard] ${camera.name} (${camera.id}) rendering WebRTC MediaStream via srcObject`);
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [remoteStream, camera]);

  return (
    <div
      onClick={() => onSelectLive(camera.id)}
      className={`relative group cursor-pointer rounded-2xl overflow-hidden border transition-all duration-300 bg-zinc-900 ${
        isLive
          ? 'border-red-500 shadow-xl shadow-red-500/10 ring-2 ring-red-500/30'
          : 'border-zinc-800 hover:border-zinc-700 hover:shadow-lg'
      }`}
    >
      {/* Live Video Preview Box */}
      <div className="relative aspect-video w-full bg-zinc-950 flex items-center justify-center overflow-hidden">
        {remoteStream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain bg-zinc-950"
          />
        ) : frameBlob ? (
          <img src={frameBlob} alt={camera.name} className="w-full h-full object-contain bg-zinc-950" />
        ) : (
          <div className="flex flex-col items-center justify-center text-zinc-600 gap-2">
            <Radio className="w-6 h-6 animate-pulse text-zinc-500" />
            <span className="text-xs font-mono">Receiving Feed...</span>
          </div>
        )}

        {/* Top Badges: LIVE Badge + Protocol Mode */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {isLive ? (
              <span className="px-2.5 py-0.5 bg-red-600 text-white font-bold text-[10px] rounded-md tracking-wider uppercase flex items-center gap-1 shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                LIVE
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-zinc-900/80 backdrop-blur-md text-zinc-400 font-medium text-[10px] rounded-md uppercase border border-zinc-700/50">
                STANDBY
              </span>
            )}

            <span
              className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded uppercase border ${
                remoteStream
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                  : 'bg-amber-950/80 text-amber-300 border-amber-700'
              }`}
            >
              {remoteStream ? 'WebRTC' : 'JPEG'}
            </span>
          </div>

          {/* Quick Go Live Action overlay on hover */}
          {!isLive && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectLive(camera.id);
              }}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Play className="w-3 h-3 fill-current" />
              CUT
            </button>
          )}
        </div>
      </div>

      {/* Camera Card Footer Info */}
      <div className="p-3.5 flex items-center justify-between bg-zinc-900">
        <div className="flex items-center gap-2">
          <div>
            <h4 className="font-semibold text-sm text-white group-hover:text-indigo-300 transition-colors">
              {camera.name}
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">{camera.operatorName}</p>
          </div>

          {onOpenMessage && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenMessage(camera.id);
              }}
              title={`Send cue to ${camera.operatorName}`}
              className="p-1.5 bg-zinc-800 hover:bg-indigo-600 hover:text-white text-zinc-400 rounded-lg transition-colors ml-1"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Battery & Signal Strength Metrics */}
        <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono">
          {/* Battery */}
          {camera.batteryLevel !== null && (
            <div className="flex items-center gap-1" title={`Battery: ${camera.batteryLevel}%`}>
              {camera.isCharging ? (
                <BatteryCharging className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Battery
                  className={`w-3.5 h-3.5 ${
                    camera.batteryLevel < 20 ? 'text-red-400' : 'text-emerald-400'
                  }`}
                />
              )}
              <span className="text-[11px]">{camera.batteryLevel}%</span>
            </div>
          )}

          {/* Signal Quality */}
          <div className="flex items-center gap-1" title={`Latency: ${camera.latencyMs}ms`}>
            <Wifi className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px]">{camera.latencyMs}ms</span>
          </div>
        </div>
      </div>
    </div>
  );
};
