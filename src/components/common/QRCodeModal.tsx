import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, QrCode, Smartphone, Wifi, Camera } from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Build current operator URL
  const operatorUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/?mode=operator`
    : '';

  const handleCopy = () => {
    if (operatorUrl) {
      navigator.clipboard.writeText(operatorUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">Connect Camera</h3>
              <p className="text-xs text-zinc-400">Scan on iPhone or Android</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="mt-6 flex flex-col items-center">
          {/* QR Container */}
          <div className="p-4 bg-white rounded-2xl shadow-inner border border-zinc-200 flex items-center justify-center">
            {operatorUrl ? (
              <QRCodeSVG
                value={operatorUrl}
                size={200}
                bgColor="#FFFFFF"
                fgColor="#09090b"
                level="M"
                includeMargin={false}
              />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-zinc-400 text-sm">
                Generating QR...
              </div>
            )}
          </div>

          <p className="mt-4 text-xs text-center text-zinc-400 max-w-xs">
            Open camera app on mobile device and scan this QR code to start streaming live video to VisionMix.
          </p>

          {/* Steps */}
          <div className="w-full mt-6 space-y-2.5 text-xs text-zinc-300 bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800/80">
            <div className="flex items-center gap-2.5">
              <Wifi className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>1. Ensure device is on the same Wi-Fi network.</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>2. Scan QR code or copy join link below.</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Camera className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>3. Enter camera name and press Connect.</span>
            </div>
          </div>

          {/* Copy Link Input */}
          <div className="w-full mt-5 flex items-center gap-2 bg-zinc-950 p-1.5 rounded-xl border border-zinc-800">
            <input
              type="text"
              readOnly
              value={operatorUrl}
              className="flex-1 bg-transparent px-2 text-xs text-zinc-300 focus:outline-none truncate"
            />
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
