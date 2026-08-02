export type CameraStatus = 'standby' | 'live' | 'connecting' | 'disconnected';

export interface DirectorMessage {
  id: string;
  senderName: string;
  targetCameraId: 'global' | string; // 'global' for all operators, or specific camera ID
  targetCameraName?: string;
  message: string;
  timestamp: number;
  urgent?: boolean;
}

export interface CameraNode {
  id: string;
  name: string;
  operatorName: string;
  deviceType?: 'mobile' | 'desktop' | 'tablet';
  batteryLevel: number | null; // 0 to 100, or null if unsupported
  isCharging: boolean | null;
  signalQuality: 'excellent' | 'good' | 'fair' | 'poor';
  latencyMs: number;
  status: CameraStatus;
  facingMode: 'user' | 'environment' | string;
  resolution: string; // e.g. "1920x1080"
  fps: number;
  audioMuted: boolean;
  connectedAt: number;
  streamQuality: '1080p' | '720p' | '480p';
}

export interface StudioConfig {
  eventName: string;
  eventLogoUrl?: string | null;
  activeCameraId: string | null;
  recordingStatus: 'idle' | 'recording' | 'paused';
  recordingDurationSeconds: number;
  targetResolution: '1080p' | '720p' | '480p';
  targetFps: 30 | 60;
  tallyEnabled: boolean;
  audioEnabled: boolean;
  activeAudioCameraId: string | null; // Audio source (defaults to active camera or explicit mic)
  projectorAlertMessage?: string | null;
}

export interface WebRTCSignalData {
  targetId: string;
  callerId: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export interface FrameStreamData {
  cameraId: string;
  imageBlob: string; // Base64 data URL JPEG frame
  timestamp: number;
}

export interface CameraTelemetryUpdate {
  cameraId: string;
  batteryLevel: number | null;
  isCharging: boolean | null;
  latencyMs: number;
  fps: number;
  signalQuality?: 'excellent' | 'good' | 'fair' | 'poor';
}
