import { Server as SocketIOServer, Socket } from 'socket.io';
import { CameraNode, StudioConfig, CameraTelemetryUpdate, DirectorMessage } from '../types/visionmix.js';

let connectedCameras: Map<string, CameraNode> = new Map();
let studioConfig: StudioConfig = {
  eventName: 'Live Broadcast',
  eventLogoUrl: null,
  activeCameraId: null,
  recordingStatus: 'idle',
  recordingDurationSeconds: 0,
  targetResolution: '1080p',
  targetFps: 30,
  tallyEnabled: true,
  audioEnabled: true,
  activeAudioCameraId: null,
};

export function setupSocketHandlers(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    // Send current initial state on connection
    socket.emit('initial_state', {
      cameras: Array.from(connectedCameras.values()),
      config: studioConfig,
    });

    // Register a new camera node (mobile or browser camera)
    socket.on('camera:register', (data: Partial<CameraNode>) => {
      const cameraId = data.id || socket.id;
      const newCamera: CameraNode = {
        id: cameraId,
        name: data.name || 'Camera ' + (connectedCameras.size + 1),
        operatorName: data.operatorName || 'Operator',
        deviceType: data.deviceType || 'mobile',
        batteryLevel: data.batteryLevel !== undefined ? data.batteryLevel : null,
        isCharging: data.isCharging !== undefined ? data.isCharging : null,
        signalQuality: data.signalQuality || 'excellent',
        latencyMs: data.latencyMs || 15,
        status: studioConfig.activeCameraId === cameraId ? 'live' : 'standby',
        facingMode: data.facingMode || 'environment',
        resolution: data.resolution || '1920x1080',
        fps: data.fps || 30,
        audioMuted: !!data.audioMuted,
        connectedAt: Date.now(),
        streamQuality: data.streamQuality || '1080p',
      };

      connectedCameras.set(cameraId, newCamera);
      socket.data.cameraId = cameraId;
      socket.data.isCamera = true;

      // Automatically set as active live camera if no camera was live yet
      if (!studioConfig.activeCameraId) {
        studioConfig.activeCameraId = cameraId;
        newCamera.status = 'live';
      }

      io.emit('camera:list_updated', Array.from(connectedCameras.values()));
      io.emit('studio:state_changed', studioConfig);
    });

    // Switch active LIVE camera
    socket.on('camera:switch_live', ({ cameraId }: { cameraId: string }) => {
      if (connectedCameras.has(cameraId) || cameraId === null) {
        studioConfig.activeCameraId = cameraId;
        
        // Update status for all cameras
        connectedCameras.forEach((cam, id) => {
          cam.status = id === cameraId ? 'live' : 'standby';
        });

        io.emit('live:camera_changed', { activeCameraId: cameraId });
        io.emit('camera:list_updated', Array.from(connectedCameras.values()));
        io.emit('studio:state_changed', studioConfig);
      }
    });

    // Camera Telemetry updates (battery, signal, fps, latency)
    socket.on('camera:telemetry', (telemetry: CameraTelemetryUpdate) => {
      const camera = connectedCameras.get(telemetry.cameraId || socket.id);
      if (camera) {
        if (telemetry.batteryLevel !== undefined) camera.batteryLevel = telemetry.batteryLevel;
        if (telemetry.isCharging !== undefined) camera.isCharging = telemetry.isCharging;
        if (telemetry.latencyMs !== undefined) camera.latencyMs = telemetry.latencyMs;
        if (telemetry.fps !== undefined) camera.fps = telemetry.fps;
        if (telemetry.signalQuality) camera.signalQuality = telemetry.signalQuality;

        io.emit('camera:telemetry_updated', camera);
      }
    });

    // Update studio config (e.g. Event Name, Target Resolution, FPS)
    socket.on('studio:update_config', (partialConfig: Partial<StudioConfig>) => {
      studioConfig = { ...studioConfig, ...partialConfig };
      io.emit('studio:state_changed', studioConfig);
    });

    // Operator Messaging (Global Broadcast or Specific Camera Operator)
    socket.on('operator:send_message', (msgData: DirectorMessage) => {
      console.log(`[SocketServer] Operator message target [${msgData.targetCameraId}]: "${msgData.message}"`);
      if (msgData.targetCameraId === 'global') {
        // Global broadcast to all connected clients
        io.emit('operator:receive_message', msgData);
      } else {
        // Send to specific target socket room
        io.to(msgData.targetCameraId).emit('operator:receive_message', msgData);
        // Echo back to sender so sender can confirm delivery in their log
        socket.emit('operator:receive_message', msgData);
      }
    });

    // WebRTC Signaling relays
    socket.on('webrtc:offer', (payload: { targetId: string; sdp: any; callerId: string }) => {
      io.to(payload.targetId).emit('webrtc:offer', {
        sdp: payload.sdp,
        callerId: payload.callerId || socket.id,
      });
    });

    socket.on('webrtc:answer', (payload: { targetId: string; sdp: any; callerId: string }) => {
      io.to(payload.targetId).emit('webrtc:answer', {
        sdp: payload.sdp,
        callerId: payload.callerId || socket.id,
      });
    });

    socket.on('webrtc:ice_candidate', (payload: { targetId: string; candidate: any; callerId: string }) => {
      io.to(payload.targetId).emit('webrtc:ice_candidate', {
        candidate: payload.candidate,
        callerId: payload.callerId || socket.id,
      });
    });

    // Frame stream relay (Canvas JPEG frame fallback broadcast)
    socket.on('frame:stream', (data: { cameraId: string; imageBlob: string; timestamp: number }) => {
      socket.broadcast.emit('frame:broadcast', data);
    });

    // Handle Disconnection
    socket.on('disconnect', () => {
      const cameraId = socket.data.cameraId || socket.id;
      if (connectedCameras.has(cameraId)) {
        connectedCameras.delete(cameraId);

        // If disconnected camera was live, clear or pick next available
        if (studioConfig.activeCameraId === cameraId) {
          const remainingIds = Array.from(connectedCameras.keys());
          studioConfig.activeCameraId = remainingIds.length > 0 ? remainingIds[0] : null;
          if (studioConfig.activeCameraId) {
            const nextCam = connectedCameras.get(studioConfig.activeCameraId);
            if (nextCam) nextCam.status = 'live';
          }
        }

        io.emit('camera:list_updated', Array.from(connectedCameras.values()));
        io.emit('studio:state_changed', studioConfig);
      }
    });
  });
}
