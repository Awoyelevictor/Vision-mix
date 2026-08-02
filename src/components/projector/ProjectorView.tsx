import React, { useEffect, useRef, useState } from 'react';
import { socketService } from '../../services/socketService';
import { CameraNode, StudioConfig } from '../../types/visionmix';

export const ProjectorView: React.FC = () => {
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [config, setConfig] = useState<StudioConfig | null>(null);
  const [frameBlob, setFrameBlob] = useState<string | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const socket = socketService.connect();

    // Setup Remote WebRTC stream callback
    socketService.setOnRemoteStream((cameraId, stream) => {
      setRemoteStream(stream);
    });

    // Setup JPEG frame fallback
    socketService.setOnFrameReceived((cameraId, imageBlob) => {
      setFrameBlob(imageBlob);
    });

    // Listen to initial state
    socket.on('initial_state', (data: { cameras: CameraNode[]; config: StudioConfig }) => {
      setConfig(data.config);
      if (data.config.activeCameraId) {
        setActiveCameraId(data.config.activeCameraId);
      }
    });

    socket.on('studio:state_changed', (updatedConfig: StudioConfig) => {
      setConfig(updatedConfig);
    });

    // Listen for live camera switches
    socket.on('live:camera_changed', ({ activeCameraId }: { activeCameraId: string }) => {
      setActiveCameraId(activeCameraId);
    });

    return () => {
      socket.off('initial_state');
      socket.off('studio:state_changed');
      socket.off('live:camera_changed');
    };
  }, []);

  // Auto-play video stream
  useEffect(() => {
    if (videoRef.current) {
      if (remoteStream) {
        if (videoRef.current.srcObject !== remoteStream) {
          videoRef.current.srcObject = remoteStream;
          videoRef.current.play().catch((err) => console.warn('Projector video play error:', err));
        }
        console.log(`[ProjectorView] Rendering live output via WebRTC MediaStream srcObject`);
      } else {
        videoRef.current.srcObject = null;
        if (frameBlob) {
          console.log(`[ProjectorView] Rendering live output via Fallback JPEG frame stream`);
        }
      }
    }
  }, [remoteStream, frameBlob]);

  // Click to toggle native fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div
      onClick={toggleFullscreen}
      className="fixed inset-0 w-screen h-screen bg-black flex items-center justify-center cursor-pointer overflow-hidden select-none relative"
    >
      {/* Optional Event Logo Watermark Overlay */}
      {(config?.eventLogoUrl || config?.eventName) && (
        <div className="absolute top-6 left-6 z-20 flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shadow-2xl pointer-events-none">
          {config.eventLogoUrl && (
            <img
              src={config.eventLogoUrl}
              alt="Logo"
              className="w-7 h-7 object-contain rounded shrink-0"
            />
          )}
          {config.eventName && (
            <span className="text-white font-semibold text-sm tracking-wide">
              {config.eventName}
            </span>
          )}
        </div>
      )}

      {remoteStream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-contain bg-black transition-opacity duration-300"
        />
      ) : frameBlob ? (
        <img
          src={frameBlob}
          alt="Live Stream"
          className="w-full h-full object-contain bg-black transition-opacity duration-300"
        />
      ) : (
        /* Clean minimal waiting screen for projector display */
        <div className="flex flex-col items-center justify-center gap-3 text-zinc-700 font-mono text-sm animate-pulse">
          <div className="w-12 h-12 rounded-full border border-zinc-800 flex items-center justify-center text-zinc-600 font-bold text-xl">
            V
          </div>
          <span>VISIONMIX • WAITING FOR LIVE CAMERA</span>
          <span className="text-xs text-zinc-800 font-sans">Click or press F for fullscreen</span>
        </div>
      )}
    </div>
  );
};
