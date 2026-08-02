import React, { useState } from 'react';
import { X, Send, Radio, User, AlertTriangle, MessageSquare, CheckCircle2, Sparkles } from 'lucide-react';
import { CameraNode, DirectorMessage } from '../../types/visionmix';

interface OperatorMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  cameras: CameraNode[];
  initialTargetId?: string | 'global';
  sentMessages: DirectorMessage[];
  onSendMessage: (targetId: 'global' | string, message: string, targetName?: string, urgent?: boolean) => void;
}

const PRESET_CUES = [
  'Zoom in close',
  'Wide angle shot',
  'Pan left',
  'Pan right',
  'Focus on main speaker',
  'Standby for LIVE in 10s',
  'Hold steady',
  'Great shot! Keep it here',
];

export const OperatorMessageModal: React.FC<OperatorMessageModalProps> = ({
  isOpen,
  onClose,
  cameras,
  initialTargetId = 'global',
  sentMessages,
  onSendMessage,
}) => {
  const [targetId, setTargetId] = useState<'global' | string>(initialTargetId);
  const [customMessage, setCustomMessage] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [sentNotice, setSentNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const getTargetName = (id: string) => {
    if (id === 'global') return 'All Operators (Global)';
    const cam = cameras.find((c) => c.id === id);
    return cam ? `${cam.name} (${cam.operatorName})` : 'Specific Operator';
  };

  const handleSend = (msgText: string) => {
    if (!msgText.trim()) return;
    const name = getTargetName(targetId);
    onSendMessage(targetId, msgText.trim(), name, isUrgent);
    setCustomMessage('');
    setSentNotice(`Sent to ${name}`);
    setTimeout(() => setSentNotice(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Message Camera Operators</h3>
              <p className="text-xs text-zinc-400">Send director cues to all operators or specific camera</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Target Selector */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              Select Recipient
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Global Option */}
              <button
                type="button"
                onClick={() => setTargetId('global')}
                className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                  targetId === 'global'
                    ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-md shadow-indigo-500/10'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    targetId === 'global' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold leading-tight">Global Broadcast</div>
                  <div className="text-[10px] text-zinc-500">All {cameras.length} connected operators</div>
                </div>
              </button>

              {/* Specific Cameras */}
              {cameras.map((cam) => (
                <button
                  key={cam.id}
                  type="button"
                  onClick={() => setTargetId(cam.id)}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                    targetId === cam.id
                      ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-md shadow-indigo-500/10'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      targetId === cam.id ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    <User className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold truncate">{cam.name}</div>
                    <div className="text-[10px] text-zinc-500 truncate">{cam.operatorName}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Preset Director Cues */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              Quick Director Cues
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_CUES.map((cue) => (
                <button
                  key={cue}
                  type="button"
                  onClick={() => handleSend(cue)}
                  className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-medium rounded-xl transition-all active:scale-95"
                >
                  {cue}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Message Input */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Custom Director Message
            </label>
            <div className="relative">
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder={`Type message to ${getTargetName(targetId)}...`}
                rows={3}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(customMessage);
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setIsUrgent(!isUrgent)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isUrgent
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-white'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Urgent Priority</span>
              </button>

              <button
                type="button"
                onClick={() => handleSend(customMessage)}
                disabled={!customMessage.trim()}
                className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all ${
                  customMessage.trim()
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 active:scale-95'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Cue</span>
              </button>
            </div>
          </div>

          {/* Toast Notice */}
          {sentNotice && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-700 text-emerald-300 rounded-xl text-xs flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{sentNotice}</span>
            </div>
          )}

          {/* Sent Messages History */}
          {sentMessages.length > 0 && (
            <div className="pt-3 border-t border-zinc-800/80 space-y-2">
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Recent Sent Messages
              </label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {sentMessages.slice(-6).reverse().map((msg) => (
                  <div
                    key={msg.id}
                    className="p-2.5 bg-zinc-950 border border-zinc-800/80 rounded-xl text-xs flex items-start justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{msg.message}</span>
                        {msg.urgent && (
                          <span className="px-1.5 py-0.2 text-[9px] bg-red-500/20 text-red-400 border border-red-500/30 rounded font-bold uppercase">
                            Urgent
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        Target:{' '}
                        <span className="text-zinc-300">
                          {msg.targetCameraId === 'global' ? 'Global Broadcast' : msg.targetCameraName || 'Camera'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-600 shrink-0">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
