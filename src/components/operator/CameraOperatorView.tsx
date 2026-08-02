import React, { useState, useEffect, useRef } from 'react';
import { Camera, RefreshCw, Power, Battery, BatteryCharging, Wifi, Radio, Shield, Check, User, MessageSquare, AlertTriangle, X, Send, Bell } from 'lucide-react';
import { socketService } from '../../services/socketService';
import { BatteryService, BatteryInfo } from '../../services/batteryService';
import { CameraNode, StudioConfig, DirectorMessage } from '../../types/visionmix';

interface CameraOperatorViewProps {
  onReturnToStudio?: () => void;
}

const CAMERA_PRESETS = [
  'Altar View',
  'Audience View',
  'Choir',
  'Keyboard',
  'Pastor',
  'Entrance',
  'Wide Stage',
  'Podium',
];

export const CameraOperatorView: React.FC<CameraOperatorViewProps> = ({ onReturnToStudio }) => {
  const [cameraName, setCameraName] = useState('Altar View');
  const [operatorName, setOperatorName] = useState('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isConnected, setIsConnected] = useState(false);
  const [cameraNode, setCameraNode] = useState<CameraNode | null>(null);
  const [batteryInfo, setBatteryInfo] = useState<BatteryInfo | null>(null);
  const [latencyMs, setLatencyMs] = useState(12);

  // Director Messaging States
  const [messagesHistory, setMessagesHistory] = useState<DirectorMessage[]>([]);
  const [activeMessage, setActiveMessage] = useState<DirectorMessage | null>(null);
  const [isMessageLogOpen, setIsMessageLogOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<any>(null);

  // Subscribe to Battery
  useEffect(() => {
    BatteryService.getBatteryInfo().then((info) => {
      if (info) setBatteryInfo(info);
    });

    const unsubscribe = BatteryService.subscribeToBattery((info) => {
      setBatteryInfo(info);
    });

    return () => unsubscribe();
  }, []);

  // Listen to socket studio state changes for Tally LIVE status
  useEffect(() => {
    const socket = socketService.connect();

    const handleCameraList = (cameras: CameraNode[]) => {
      if (socket.id) {
        const myCam = cameras.find((c) => c.id === socket.id);
        if (myCam) setCameraNode(myCam);
      }
    };

    const handleLiveChanged = ({ activeCameraId }: { activeCameraId: string }) => {
      if (socket.id) {
        setCameraNode((prev) =>
          prev ? { ...prev, status: activeCameraId === socket.id ? 'live' : 'standby' } : null
        );
      }
    };

    socket.on('camera:list_updated', handleCameraList);
    socket.on('live:camera_changed', handleLiveChanged);

    // Listen for incoming director messages
    const unsubscribeMessages = socketService.onOperatorMessage((msg) => {
      // Check if this message is for us (global broadcast OR matching our socket id)
      if (msg.targetCameraId === 'global' || msg.targetCameraId === socket.id) {
        setMessagesHistory((prev) => [...prev, msg]);
        setActiveMessage(msg);

        // Play audio cue tone
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = msg.urgent ? 'sawtooth' : 'sine';
          osc.frequency.setValueAtTime(msg.urgent ? 880 : 587.33, ctx.currentTime);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.6);
        } catch (e) {
          // Autoplay restricted or unsupported
        }

        // Haptic feedback
        if ('vibrate' in navigator) {
          try {
            navigator.vibrate(msg.urgent ? [300, 100, 300, 100, 300] : [200, 100, 200]);
          } catch (e) {}
        }
      }
    });

    return () => {
      unsubscribeMessages();
      socket.off('camera:list_updated', handleCameraList);
      socket.off('live:camera_changed', handleLiveChanged);
    };
  }, []);

  // State for WebRTC vs Fallback stream mode
  const [isWebRTCConnected, setIsWebRTCConnected] = useState(false);
  const isWebRTCConnectedRef = useRef(false);

  useEffect(() => {
    isWebRTCConnectedRef.current = isWebRTCConnected;
  }, [isWebRTCConnected]);

  // Subscribe to WebRTC connection state
  useEffect(() => {
    const unsubscribe = socketService.onWebRTCStateChange((targetId, state) => {
      const connected = state === 'connected';
      setIsWebRTCConnected(connected);
      if (connected) {
        console.log(`[CameraOperatorView] WebRTC connected with ${targetId}! Stopping fallback JPEG transmission.`);
        if (frameIntervalRef.current) {
          cancelAnimationFrame(frameIntervalRef.current);
          frameIntervalRef.current = null;
        }
      } else {
        console.log(`[CameraOperatorView] WebRTC state: ${state}. Fallback JPEG enabled if needed.`);
      }
    });

    return () => unsubscribe();
  }, []);

  // State for aspect ratio mode (auto / landscape / portrait)
  const [aspectMode, setAspectMode] = useState<'auto' | 'landscape' | 'portrait'>('auto');
  const [isVideoPortrait, setIsVideoPortrait] = useState(false);

  // Send periodic telemetry & lightweight canvas video frame stream fallback (only while WebRTC is NOT connected)
  useEffect(() => {
    if (!isConnected) return;

    const socket = socketService.connect();

    // Telemetry ping interval
    const telemetryInterval = setInterval(() => {
      const socketId = socket.id;
      if (socketId) {
        socketService.sendTelemetry({
          cameraId: socketId,
          batteryLevel: batteryInfo ? batteryInfo.level : null,
          isCharging: batteryInfo ? batteryInfo.charging : null,
          latencyMs: isWebRTCConnectedRef.current ? 4 : latencyMs, // Low WebRTC latency
          fps: 30,
        });
      }
    }, 3000);

    // Canvas frame fallback loop (runs ONLY when WebRTC is not connected)
    let lastFrameTime = 0;
    const FRAME_INTERVAL_MS = 1000 / 12;

    const sendFrame = (now: number) => {
      // STOP immediately if WebRTC has connected
      if (isWebRTCConnectedRef.current) {
        if (frameIntervalRef.current) {
          cancelAnimationFrame(frameIntervalRef.current);
          frameIntervalRef.current = null;
        }
        return;
      }

      if (now - lastFrameTime >= FRAME_INTERVAL_MS) {
        lastFrameTime = now;
        if (videoRef.current && canvasRef.current && socket.id) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            const vWidth = video.videoWidth || 640;
            const vHeight = video.videoHeight || 360;
            const portrait = vHeight > vWidth;
            setIsVideoPortrait(portrait);

            if (portrait) {
              canvas.width = 270;
              canvas.height = 480;
            } else {
              canvas.width = 480;
              canvas.height = 270;
            }

            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
              socketService.sendFrameStream(socket.id, dataUrl);
            }
          }
        }
      }
      frameIntervalRef.current = requestAnimationFrame(sendFrame);
    };

    if (!isWebRTCConnected) {
      frameIntervalRef.current = requestAnimationFrame(sendFrame);
    }

    return () => {
      clearInterval(telemetryInterval);
      if (frameIntervalRef.current) cancelAnimationFrame(frameIntervalRef.current);
    };
  }, [isConnected, isWebRTCConnected, batteryInfo, latencyMs]);

  // Handle camera start
  const startCamera = async (mode: 'user' | 'environment') => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: true,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      // Register local stream with socket service for low-latency WebRTC streaming
      socketService.setLocalStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      return stream;
    } catch (err) {
      console.error('Failed to acquire camera stream:', err);
      alert('Camera access error. Please grant camera and microphone permissions.');
      return null;
    }
  };

  const handleConnect = async () => {
    const stream = await startCamera(facingMode);
    if (!stream) return;

    const socket = socketService.connect();

    const newCam: Partial<CameraNode> = {
      id: socket.id,
      name: cameraName,
      operatorName: operatorName || 'Operator',
      batteryLevel: batteryInfo ? batteryInfo.level : null,
      isCharging: batteryInfo ? batteryInfo.charging : null,
      facingMode,
      status: 'standby',
      latencyMs: 12,
    };

    socket.emit('camera:register', newCam);
    setIsConnected(true);
  };

  const handleDisconnect = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);

    const socket = socketService.connect();
    socket.disconnect();
    socket.connect(); // reconnect as non-camera observer

    setIsConnected(false);
    setCameraNode(null);
  };

  const handleSwitchCameraFacing = async () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    if (isConnected) {
      await startCamera(newMode);
    }
  };

  const isLiveOnAir = cameraNode?.status === 'live';

  return (
    <div
      className={`min-h-screen w-full bg-zinc-950 text-white flex flex-col items-center justify-between transition-all duration-300 ${
        isLiveOnAir ? 'ring-8 ring-red-600' : ''
      }`}
    >
      {/* Hidden canvas for JPEG frame rendering */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top Header */}
      <header className="w-full max-w-md p-4 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-md">
            V
          </div>
          <div>
            <h2 className="font-bold text-sm leading-tight text-white">VisionMix</h2>
            <span className="text-[10px] text-zinc-400">Mobile Camera Unit</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Bell / Director Messages History Button */}
          {isConnected && (
            <button
              onClick={() => setIsMessageLogOpen(!isMessageLogOpen)}
              className="relative p-2 text-zinc-300 hover:text-white bg-zinc-800 border border-zinc-700/80 rounded-xl transition-colors"
              title="Director Messages History"
            >
              <Bell className="w-4 h-4 text-indigo-400" />
              {messagesHistory.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-600 text-white font-bold text-[9px] rounded-full flex items-center justify-center">
                  {messagesHistory.length}
                </span>
              )}
            </button>
          )}

          {onReturnToStudio && (
            <button
              onClick={onReturnToStudio}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg"
            >
              Studio View
            </button>
          )}
        </div>
      </header>

      {/* Main Body */}
      <main className="w-full max-w-md flex-1 p-4 flex flex-col justify-center">
        {!isConnected ? (
          /* Connect Form */
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5 animate-fade-in">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-3">
                <Camera className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-lg text-white">Join as Camera</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Select location & name to start streaming to VisionMix
              </p>
            </div>

            {/* Camera Name Presets */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                Camera Name / Location
              </label>
              <input
                type="text"
                value={cameraName}
                onChange={(e) => setCameraName(e.target.value)}
                placeholder="e.g. Altar View"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors mb-2"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {CAMERA_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCameraName(preset)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                      cameraName === preset
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Operator Name */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                Operator Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  placeholder="e.g. Sarah"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {/* Connect Button */}
            <button
              onClick={handleConnect}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Radio className="w-4 h-4" />
              <span>Connect Camera</span>
            </button>
          </div>
        ) : (
          /* Live Camera Viewfinder State */
          <div className="flex flex-col gap-4">
            {/* Status Banner */}
            <div
              className={`p-3.5 rounded-2xl flex items-center justify-between border shadow-xl transition-colors ${
                isLiveOnAir
                  ? 'bg-red-600 border-red-500 text-white animate-pulse'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-3 h-3 rounded-full ${
                    isLiveOnAir ? 'bg-white animate-ping' : 'bg-zinc-500'
                  }`}
                />
                <div>
                  <h4 className="font-bold text-sm tracking-wide">
                    {isLiveOnAir ? 'LIVE ON AIR' : 'STANDBY'}
                  </h4>
                  <p className="text-[11px] opacity-80">{cameraName}</p>
                </div>
              </div>

              {/* Battery & Signal */}
              <div className="flex items-center gap-3 text-xs font-mono">
                {batteryInfo && (
                  <div className="flex items-center gap-1">
                    {batteryInfo.charging ? (
                      <BatteryCharging className="w-4 h-4 text-amber-300" />
                    ) : (
                      <Battery className="w-4 h-4 text-emerald-300" />
                    )}
                    <span>{batteryInfo.level}%</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Wifi className="w-4 h-4" />
                  <span>{latencyMs}ms</span>
                </div>
              </div>
            </div>

            {/* Active Director Cue Overlay Banner */}
            {activeMessage && (
              <div
                className={`p-4 rounded-2xl border shadow-2xl transition-all ${
                  activeMessage.urgent
                    ? 'bg-red-950/95 border-red-500 text-white ring-4 ring-red-500/30'
                    : 'bg-indigo-950/95 border-indigo-500 text-white shadow-indigo-500/20'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2">
                    {activeMessage.urgent ? (
                      <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 animate-pulse" />
                    ) : (
                      <MessageSquare className="w-5 h-5 text-indigo-400 shrink-0" />
                    )}
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                        {activeMessage.targetCameraId === 'global' ? 'Global Broadcast Cue' : 'Direct Instruction'}
                      </span>
                      <span className="text-xs font-semibold">{activeMessage.senderName}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveMessage(null)}
                    className="p-1 hover:bg-white/10 rounded-lg text-white/70 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-base font-black text-white my-2 tracking-wide leading-snug">
                  "{activeMessage.message}"
                </p>

                {/* Quick Reply Chips */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-white/10">
                  {['Copy that!', 'In position', 'Need 5s'].map((reply) => (
                    <button
                      key={reply}
                      type="button"
                      onClick={() => {
                        socketService.sendOperatorMessage(
                          'global',
                          `[${cameraName}] ${reply}`,
                          cameraName
                        );
                        setActiveMessage(null);
                      }}
                      className="px-2.5 py-1 bg-white/15 hover:bg-white/25 border border-white/20 text-white rounded-lg text-[11px] font-semibold transition-colors"
                    >
                      {reply}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setActiveMessage(null)}
                    className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white/80 rounded-lg text-[11px] font-medium ml-auto"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Messages History Drawer */}
            {isMessageLogOpen && (
              <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Bell className="w-4 h-4 text-indigo-400" />
                    <span>Director Cue History ({messagesHistory.length})</span>
                  </div>
                  <button
                    onClick={() => setIsMessageLogOpen(false)}
                    className="text-zinc-400 hover:text-white text-xs"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {messagesHistory.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-2 text-center">No messages received yet.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {messagesHistory.slice().reverse().map((msg) => (
                      <div
                        key={msg.id}
                        className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px] text-zinc-400">
                          <span className="font-semibold text-indigo-400">
                            {msg.targetCameraId === 'global' ? 'Global' : 'Direct'} • {msg.senderName}
                          </span>
                          <span className="font-mono">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-white font-medium">{msg.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Viewfinder Video Element */}
            <div
              className={`relative w-full bg-black rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl flex items-center justify-center transition-all duration-300 ${
                aspectMode === 'portrait' || (aspectMode === 'auto' && isVideoPortrait)
                  ? 'aspect-[9/16] max-h-[60vh]'
                  : 'aspect-video'
              }`}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Overlay Info */}
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-medium border border-white/10 flex items-center gap-2">
                <span>{cameraName} ({operatorName || 'Operator'})</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 rounded">
                  {isVideoPortrait ? 'Portrait 9:16' : 'Landscape 16:9'}
                </span>
                <span
                  className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded font-bold ${
                    isWebRTCConnected
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {isWebRTCConnected ? 'WebRTC (Low Latency)' : 'Fallback JPEG'}
                </span>
              </div>
            </div>

            {/* Camera Operator Controls */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handleSwitchCameraFacing}
                className="py-3 px-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors active:scale-95"
              >
                <RefreshCw className="w-4 h-4 text-indigo-400" />
                <span>Switch Lens</span>
              </button>

              <button
                onClick={() =>
                  setAspectMode((prev) =>
                    prev === 'auto' ? 'portrait' : prev === 'portrait' ? 'landscape' : 'auto'
                  )
                }
                className="py-3 px-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors active:scale-95"
              >
                <span className="text-indigo-400 font-bold">
                  {aspectMode === 'auto' ? 'Auto' : aspectMode === 'portrait' ? '9:16' : '16:9'}
                </span>
                <span>Aspect</span>
              </button>

              <button
                onClick={handleDisconnect}
                className="py-3 px-3 bg-red-950/60 hover:bg-red-900/80 border border-red-800/80 text-red-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors active:scale-95"
              >
                <Power className="w-4 h-4 text-red-400" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer info */}
      <footer className="w-full max-w-md p-3 text-center text-[11px] text-zinc-500 border-t border-zinc-900">
        VisionMix Mobile Node • Local Network Mode
      </footer>
    </div>
  );
};
