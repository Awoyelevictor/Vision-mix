import React, { useEffect, useRef } from 'react';

interface AudioMeterProps {
  stream: MediaStream | null;
  muted?: boolean;
}

export const AudioMeter: React.FC<AudioMeterProps> = ({ stream, muted = false }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!stream || muted) return;

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack || !audioTrack.enabled) return;

    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let animationFrameId: number;

    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      const draw = () => {
        if (!ctx || !analyser) return;

        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalized = Math.min(1, average / 128); // 0 to 1

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw 5 audio bars
        const numBars = 6;
        const barGap = 2;
        const barWidth = (canvas.width - (numBars - 1) * barGap) / numBars;

        for (let i = 0; i < numBars; i++) {
          const val = (dataArray[i * 2] || 0) / 255;
          const height = Math.max(3, val * canvas.height);
          const x = i * (barWidth + barGap);
          const y = canvas.height - height;

          // Color gradient from green to yellow to red
          let color = '#22c55e'; // green
          if (val > 0.7) color = '#ef4444'; // red
          else if (val > 0.4) color = '#eab308'; // yellow

          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, height, 1);
          ctx.fill();
        }

        animationFrameId = requestAnimationFrame(draw);
      };

      draw();
    } catch (err) {
      console.warn('AudioContext setup error:', err);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
      }
    };
  }, [stream, muted]);

  if (muted || !stream) {
    return (
      <div className="flex items-center gap-0.5 h-3 opacity-40">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="w-1 h-1 bg-zinc-600 rounded-full" />
        ))}
      </div>
    );
  }

  return <canvas ref={canvasRef} width={28} height={14} className="block" />;
};
