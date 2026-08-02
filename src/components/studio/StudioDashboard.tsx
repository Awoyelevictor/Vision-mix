import React, { useState, useEffect } from 'react';
import {
  Radio,
  Sliders,
  QrCode,
  Wifi,
  Disc,
  Play,
  Monitor,
  Smartphone,
  Sparkles,
  User,
  Clock,
  Video,
  MessageSquare,
} from 'lucide-react';
import { socketService } from '../../services/socketService';
import { recordingService } from '../../services/recordingService';
import { CameraNode, StudioConfig, DirectorMessage } from '../../types/visionmix';
import { LiveOutputMonitor } from './LiveOutputMonitor';
import { CameraCard } from './CameraCard';
import { QRCodeModal } from '../common/QRCodeModal';
import { SettingsModal } from '../common/SettingsModal';
import { OperatorMessageModal } from './OperatorMessageModal';

interface StudioDashboardProps {
  onSwitchToOperator: () => void;
  onSwitchToProjector: () => void;
}

export const StudioDashboard: React.FC<StudioDashboardProps> = ({
  onSwitchToOperator,
  onSwitchToProjector,
}) => {
  const [cameras, setCameras] = useState<CameraNode[]>([]);
  const [studioConfig, setStudioConfig] = useState<StudioConfig>({
    eventName: 'Sunday Morning Service',
    activeCameraId: null,
    recordingStatus: 'idle',
    recordingDurationSeconds: 0,
    targetResolution: '1080p',
    targetFps: 30,
    tallyEnabled: true,
    audioEnabled: true,
    activeAudioCameraId: null,
    projectorAlertMessage: '',
  });

  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [frameBlobs, setFrameBlobs] = useState<Map<string, string>>(new Map());
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Modals
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messageTargetId, setMessageTargetId] = useState<'global' | string>('global');
  const [sentMessages, setSentMessages] = useState<DirectorMessage[]>([]);

  // Live clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Socket Connection & Real-time Listeners
  useEffect(() => {
    const socket = socketService.connect();

    // Listen for WebRTC streams
    socketService.setOnRemoteStream((cameraId, stream) => {
      console.log(`[StudioDashboard] WebRTC MediaStream established for camera ID: ${cameraId}`);
      setRemoteStreams((prev) => new Map(prev).set(cameraId, stream));
    });

    // Listen for JPEG canvas frames (only used as fallback if WebRTC stream is NOT available)
    socketService.setOnFrameReceived((cameraId, imageBlob) => {
      setRemoteStreams((prevRemote) => {
        if (!prevRemote.has(cameraId)) {
          setFrameBlobs((prev) => new Map(prev).set(cameraId, imageBlob));
        }
        return prevRemote;
      });
    });

    // Listen for WebRTC state updates
    const unsubscribeWebRTC = socketService.onWebRTCStateChange((targetId, state) => {
      console.log(`[StudioDashboard] Camera ${targetId} WebRTC state: ${state}`);
    });

    // Listen for incoming director messages to log sent messages
    const unsubscribeMessages = socketService.onOperatorMessage((msg) => {
      setSentMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    socket.on('initial_state', (data: { cameras: CameraNode[]; config: StudioConfig }) => {
      setCameras(data.cameras);
      setStudioConfig(data.config);
    });

    socket.on('camera:list_updated', (updatedCameras: CameraNode[]) => {
      setCameras(updatedCameras);
    });

    socket.on('studio:state_changed', (updatedConfig: StudioConfig) => {
      setStudioConfig(updatedConfig);
    });

    socket.on('camera:telemetry_updated', (updatedCam: CameraNode) => {
      setCameras((prev) =>
        prev.map((cam) => (cam.id === updatedCam.id ? { ...cam, ...updatedCam } : cam))
      );
    });

    return () => {
      unsubscribeWebRTC();
      unsubscribeMessages();
      socket.off('initial_state');
      socket.off('camera:list_updated');
      socket.off('studio:state_changed');
      socket.off('camera:telemetry_updated');
    };
  }, []);

  // Auto-initiate low-latency WebRTC connection to connected cameras & retry if missing
  useEffect(() => {
    const checkAndConnect = () => {
      cameras.forEach((cam) => {
        if (!remoteStreams.has(cam.id) || !socketService.isWebRTCConnected(cam.id)) {
          console.log(`[StudioDashboard] Initiating WebRTC offer to camera ${cam.name} (${cam.id})...`);
          socketService.initiateWebRTCConnection(cam.id);
        }
      });
    };

    checkAndConnect();
    const retryInterval = setInterval(checkAndConnect, 3000);

    return () => clearInterval(retryInterval);
  }, [cameras, remoteStreams]);

  // Keyboard hotkeys (1-9 to switch cameras, R to record)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      // Numbers 1-9
      const keyNum = parseInt(e.key, 10);
      if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= cameras.length) {
        const targetCam = cameras[keyNum - 1];
        if (targetCam) {
          handleSelectLiveCamera(targetCam.id);
        }
      }

      // R for Record
      if (e.key === 'r' || e.key === 'R') {
        handleToggleRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cameras, isRecording]);

  const handleSelectLiveCamera = (cameraId: string) => {
    socketService.switchLiveCamera(cameraId);
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      recordingService.stopRecording(studioConfig.eventName);
      setIsRecording(false);
      setRecordingSeconds(0);
    } else {
      // Create stream from active canvas/video or canvas capture
      const activeStream = studioConfig.activeCameraId
        ? remoteStreams.get(studioConfig.activeCameraId)
        : null;

      if (!activeStream) {
        alert('Please connect and select a live camera before starting recording.');
        return;
      }

      const started = recordingService.startRecording(activeStream, (sec) => {
        setRecordingSeconds(sec);
      });

      if (started) {
        setIsRecording(true);
      }
    }
  };

  const handleSaveSettings = (updated: Partial<StudioConfig>) => {
    socketService.updateStudioConfig(updated);
    setStudioConfig((prev) => ({ ...prev, ...updated }));
  };

  const handleSendOperatorMessage = (
    targetId: 'global' | string,
    message: string,
    targetName?: string,
    urgent: boolean = false
  ) => {
    socketService.sendOperatorMessage(targetId, message, targetName, urgent);
  };

  const activeCamera = cameras.find((c) => c.id === studioConfig.activeCameraId) || null;
  const activeStream = activeCamera ? remoteStreams.get(activeCamera.id) || null : null;
  const activeFrameBlob = activeCamera ? frameBlobs.get(activeCamera.id) || null : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-zinc-900/90 backdrop-blur-xl border-b border-zinc-800/80 px-6 py-3 flex items-center justify-between">
        {/* Left: Brand Logo & Event Name */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center font-black text-white shadow-lg shadow-indigo-500/20 text-lg">
              V
            </div>
            <div>
              <span className="font-black text-base tracking-tight text-white block leading-none">
                VisionMix
              </span>
              <span className="text-[10px] font-medium text-indigo-400">Wireless Production</span>
            </div>
          </div>

          <div className="h-5 w-px bg-zinc-800 hidden md:block" />

          {/* Event Title & Logo */}
          <div className="hidden md:flex items-center gap-2 bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800/80 text-xs">
            {studioConfig.eventLogoUrl ? (
              <img src={studioConfig.eventLogoUrl} alt="Event Logo" className="w-5 h-5 object-contain rounded shrink-0" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            )}
            <span className="font-semibold text-zinc-200">{studioConfig.eventName}</span>
          </div>
        </div>

        {/* Center: Live Clock & Network Status */}
        <div className="hidden lg:flex items-center gap-5 text-xs">
          {/* Clock */}
          <div className="flex items-center gap-2 text-zinc-400 font-mono">
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            <span>{currentTime}</span>
          </div>

          {/* Connected Cameras Badge */}
          <div className="flex items-center gap-2 px-3 py-1 bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-300 font-medium">
            <Video className="w-3.5 h-3.5 text-emerald-400" />
            <span>{cameras.length} Cameras Connected</span>
          </div>

          {/* Network Status */}
          <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20 font-medium text-[11px]">
            <Wifi className="w-3.5 h-3.5" />
            <span>Local Wi-Fi Network • Active</span>
          </div>
        </div>

        {/* Right Navigation Controls */}
        <div className="flex items-center gap-3">
          {/* Message Operators button */}
          <button
            onClick={() => {
              setMessageTargetId('global');
              setIsMessageModalOpen(true);
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold border border-zinc-700/80 transition-all active:scale-95 shadow-sm"
            title="Send cue or message to camera operators"
          >
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Message Operators</span>
          </button>

          {/* Connect Mobile Camera QR button */}
          <button
            onClick={() => setIsQRModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all active:scale-95"
          >
            <QrCode className="w-4 h-4" />
            <span className="hidden sm:inline">Connect Camera</span>
          </button>

          {/* View Switcher dropdown/buttons */}
          <div className="flex items-center bg-zinc-950 p-1 rounded-xl border border-zinc-800 gap-1 text-xs font-medium">
            <button
              onClick={onSwitchToOperator}
              title="Open Mobile Camera Operator Interface"
              className="px-2.5 py-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors flex items-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden xl:inline">Mobile Operator</span>
            </button>
            <button
              onClick={onSwitchToProjector}
              title="Open Projector Screen Window"
              className="px-2.5 py-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors flex items-center gap-1.5"
            >
              <Monitor className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden xl:inline">Projector Window</span>
            </button>
          </div>

          {/* Settings button */}
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            title="Studio Settings"
            className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl border border-zinc-800 transition-colors"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* User Profile Avatar */}
          <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700/60 flex items-center justify-center text-zinc-300">
            <User className="w-4 h-4" />
          </div>
        </div>
      </header>

      {/* Main Studio Body Layout */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Main Live Output Monitor */}
        <section>
          <LiveOutputMonitor
            activeCamera={activeCamera}
            remoteStream={activeStream}
            frameBlob={activeFrameBlob}
            isRecording={isRecording}
            recordingDurationSeconds={recordingSeconds}
            eventName={studioConfig.eventName}
            eventLogoUrl={studioConfig.eventLogoUrl}
            resolution={studioConfig.targetResolution}
            fps={studioConfig.targetFps}
            onToggleRecording={handleToggleRecording}
          />
        </section>

        {/* Connected Cameras Section Header */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-indigo-400 animate-pulse" />
              <h3 className="font-semibold text-base text-white">Camera Feed Sources</h3>
              <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-400">
                {cameras.length} connected
              </span>
            </div>

            <button
              onClick={() => setIsQRModalOpen(true)}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1.5"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Show Join QR Code</span>
            </button>
          </div>

          {/* Camera Grid or Empty State */}
          {cameras.length === 0 ? (
            /* Empty State - No fake cards as instructed */
            <div className="w-full bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-10 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Smartphone className="w-8 h-8" />
              </div>
              <div className="max-w-md space-y-1">
                <h4 className="font-semibold text-white text-base">No cameras connected yet.</h4>
                <p className="text-xs text-zinc-400">
                  Scan the QR code or open VisionMix on an iPhone, Android, or laptop camera to start streaming wireless live video feeds.
                </p>
              </div>
              <button
                onClick={() => setIsQRModalOpen(true)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition-all active:scale-95"
              >
                <QrCode className="w-4 h-4" />
                <span>Connect Mobile Camera</span>
              </button>
            </div>
          ) : (
            /* Responsive Grid of Real Cameras */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cameras.map((camera) => (
                <CameraCard
                  key={camera.id}
                  camera={camera}
                  isLive={camera.id === studioConfig.activeCameraId}
                  remoteStream={remoteStreams.get(camera.id) || null}
                  frameBlob={frameBlobs.get(camera.id) || null}
                  onSelectLive={handleSelectLiveCamera}
                  onOpenMessage={(camId) => {
                    setMessageTargetId(camId);
                    setIsMessageModalOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Main Studio Controls Bar (Only Three Main Buttons) */}
      <footer className="sticky bottom-0 z-40 bg-zinc-900/90 backdrop-blur-xl border-t border-zinc-800 p-4">
        <div className="max-w-xl mx-auto flex items-center justify-center gap-4">
          {/* Button 1: Go Live / Cut */}
          <button
            onClick={() => {
              if (cameras.length > 0) {
                const nextCam = cameras.find((c) => c.id !== studioConfig.activeCameraId) || cameras[0];
                handleSelectLiveCamera(nextCam.id);
              } else {
                setIsQRModalOpen(true);
              }
            }}
            disabled={cameras.length === 0}
            className={`flex-1 py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl transition-all active:scale-95 ${
              cameras.length > 0
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/25'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Go Live</span>
          </button>

          {/* Button 2: Record */}
          <button
            onClick={handleToggleRecording}
            className={`flex-1 py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl transition-all active:scale-95 ${
              isRecording
                ? 'bg-red-950 border border-red-700 text-red-300 animate-pulse'
                : 'bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white'
            }`}
          >
            <Disc className={`w-4 h-4 ${isRecording ? 'animate-spin text-red-500' : 'text-zinc-400'}`} />
            <span>{isRecording ? 'Stop Recording' : 'Record'}</span>
          </button>

          {/* Button 3: Settings */}
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="flex-1 py-3.5 px-6 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl transition-all active:scale-95"
          >
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span>Settings</span>
          </button>
        </div>
      </footer>

      {/* Modals */}
      <QRCodeModal isOpen={isQRModalOpen} onClose={() => setIsQRModalOpen(false)} />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        config={studioConfig}
        onSaveConfig={handleSaveSettings}
      />
      <OperatorMessageModal
        isOpen={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
        cameras={cameras}
        initialTargetId={messageTargetId}
        sentMessages={sentMessages}
        onSendMessage={handleSendOperatorMessage}
      />
    </div>
  );
};
