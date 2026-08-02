import { io, Socket } from 'socket.io-client';
import { CameraNode, StudioConfig, CameraTelemetryUpdate, DirectorMessage } from '../types/visionmix';

class SocketService {
  private socket: Socket | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private peerConnectionStates: Map<string, RTCPeerConnectionState> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private localStream: MediaStream | null = null;
  private onRemoteStreamCallback?: (cameraId: string, stream: MediaStream) => void;
  private onFrameReceivedCallback?: (cameraId: string, imageBlob: string) => void;
  private onWebRTCStateCallbacks: Set<(targetId: string, state: RTCPeerConnectionState) => void> = new Set();

  public setLocalStream(stream: MediaStream | null) {
    this.localStream = stream;
    // Attach stream to any existing peer connections
    if (stream) {
      this.peerConnections.forEach((pc) => {
        stream.getTracks().forEach((track) => {
          // Avoid duplicate tracks
          const senders = pc.getSenders();
          if (!senders.some((s) => s.track === track)) {
            pc.addTrack(track, stream);
          }
        });
      });
    }
  }

  public onWebRTCStateChange(callback: (targetId: string, state: RTCPeerConnectionState) => void) {
    this.onWebRTCStateCallbacks.add(callback);
    return () => {
      this.onWebRTCStateCallbacks.delete(callback);
    };
  }

  private notifyWebRTCStateChange(targetId: string, state: RTCPeerConnectionState) {
    this.peerConnectionStates.set(targetId, state);
    console.log(`[VisionMix WebRTC] Target: ${targetId} -> State: ${state}`);
    this.onWebRTCStateCallbacks.forEach((cb) => cb(targetId, state));
  }

  public getWebRTCState(targetId: string): RTCPeerConnectionState | 'disconnected' {
    return this.peerConnectionStates.get(targetId) || 'disconnected';
  }

  public isWebRTCConnected(targetId?: string): boolean {
    if (targetId) {
      return this.peerConnectionStates.get(targetId) === 'connected';
    }
    return Array.from(this.peerConnectionStates.values()).some((s) => s === 'connected');
  }

  public connect(): Socket {
    if (!this.socket) {
      // Connect to current origin
      this.socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      this.setupWebRTCSignaling();
    }
    return this.socket;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public setOnRemoteStream(callback: (cameraId: string, stream: MediaStream) => void) {
    this.onRemoteStreamCallback = callback;
  }

  public setOnFrameReceived(callback: (cameraId: string, imageBlob: string) => void) {
    this.onFrameReceivedCallback = callback;
  }

  private setupWebRTCSignaling() {
    if (!this.socket) return;

    // Receive WebRTC offer
    this.socket.on('webrtc:offer', async ({ sdp, callerId }: { sdp: RTCSessionDescriptionInit; callerId: string }) => {
      try {
        const pc = this.createPeerConnection(callerId, this.localStream);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.socket?.emit('webrtc:answer', {
          targetId: callerId,
          sdp: answer,
          callerId: this.socket.id,
        });
      } catch (err) {
        console.error('Error handling WebRTC offer:', err);
      }
    });

    // Receive WebRTC answer
    this.socket.on('webrtc:answer', async ({ sdp, callerId }: { sdp: RTCSessionDescriptionInit; callerId: string }) => {
      try {
        const pc = this.peerConnections.get(callerId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        }
      } catch (err) {
        console.error('Error handling WebRTC answer:', err);
      }
    });

    // Receive ICE candidate
    this.socket.on('webrtc:ice_candidate', async ({ candidate, callerId }: { candidate: RTCIceCandidateInit; callerId: string }) => {
      try {
        const pc = this.peerConnections.get(callerId);
        if (pc && candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    });

    // Receive canvas frame broadcast fallback
    this.socket.on('frame:broadcast', ({ cameraId, imageBlob }: { cameraId: string; imageBlob: string }) => {
      if (this.onFrameReceivedCallback) {
        this.onFrameReceivedCallback(cameraId, imageBlob);
      }
    });
  }

  public createPeerConnection(targetId: string, streamOverride?: MediaStream | null): RTCPeerConnection {
    if (this.peerConnections.has(targetId)) {
      return this.peerConnections.get(targetId)!;
    }

    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    };

    const pc = new RTCPeerConnection(config);
    this.peerConnections.set(targetId, pc);

    const streamToSend = streamOverride || this.localStream;
    // Send local tracks if available
    if (streamToSend) {
      streamToSend.getTracks().forEach((track) => {
        pc.addTrack(track, streamToSend);
      });
    }

    // RTCPeerConnection State change listener
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      this.notifyWebRTCStateChange(targetId, state);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[VisionMix WebRTC] Camera ${targetId} ICE state: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        this.notifyWebRTCStateChange(targetId, 'connected');
      }
    };

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit('webrtc:ice_candidate', {
          targetId,
          candidate: event.candidate,
          callerId: this.socket.id,
        });
      }
    };

    // Track received
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        const remoteStream = event.streams[0];
        console.log(`[VisionMix WebRTC] Attached remote MediaStream track for camera ${targetId}`);
        this.remoteStreams.set(targetId, remoteStream);
        this.notifyWebRTCStateChange(targetId, 'connected');
        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(targetId, remoteStream);
        }
      }
    };

    return pc;
  }

  public async initiateWebRTCConnection(targetId: string, localStream?: MediaStream) {
    const pc = this.createPeerConnection(targetId, localStream);
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);

      this.socket?.emit('webrtc:offer', {
        targetId,
        sdp: offer,
        callerId: this.socket?.id,
      });
    } catch (err) {
      console.error('Failed to create WebRTC offer:', err);
    }
  }

  public sendFrameStream(cameraId: string, imageBlob: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('frame:stream', {
        cameraId,
        imageBlob,
        timestamp: Date.now(),
      });
    }
  }

  public sendTelemetry(telemetry: CameraTelemetryUpdate) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('camera:telemetry', telemetry);
    }
  }

  public switchLiveCamera(cameraId: string) {
    if (this.socket) {
      this.socket.emit('camera:switch_live', { cameraId });
    }
  }

  public updateStudioConfig(config: Partial<StudioConfig>) {
    if (this.socket) {
      this.socket.emit('studio:update_config', config);
    }
  }

  public sendOperatorMessage(
    targetCameraId: 'global' | string,
    message: string,
    targetCameraName?: string,
    urgent: boolean = false
  ) {
    if (this.socket) {
      const msgData: DirectorMessage = {
        id: Math.random().toString(36).substring(2, 9),
        senderName: 'Director / Studio',
        targetCameraId,
        targetCameraName,
        message,
        timestamp: Date.now(),
        urgent,
      };
      this.socket.emit('operator:send_message', msgData);
    }
  }

  public onOperatorMessage(callback: (msg: DirectorMessage) => void) {
    if (this.socket) {
      this.socket.on('operator:receive_message', callback);
      return () => {
        this.socket?.off('operator:receive_message', callback);
      };
    }
    return () => {};
  }

  public closePeerConnection(targetId: string) {
    const pc = this.peerConnections.get(targetId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(targetId);
    }
    this.remoteStreams.delete(targetId);
    this.notifyWebRTCStateChange(targetId, 'closed');
  }
}

export const socketService = new SocketService();
