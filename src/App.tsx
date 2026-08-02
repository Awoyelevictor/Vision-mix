import React, { useState, useEffect } from 'react';
import { StudioDashboard } from './components/studio/StudioDashboard';
import { CameraOperatorView } from './components/operator/CameraOperatorView';
import { ProjectorView } from './components/projector/ProjectorView';

type AppMode = 'studio' | 'operator' | 'projector';

export default function App() {
  const [mode, setMode] = useState<AppMode>('studio');

  useEffect(() => {
    // Check URL query parameters or hash route (e.g. ?mode=operator or ?mode=projector)
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode') as AppMode | null;

    if (modeParam === 'operator' || modeParam === 'projector') {
      setMode(modeParam);
    }
  }, []);

  const handleSetMode = (newMode: AppMode) => {
    setMode(newMode);
    const url = new URL(window.location.href);
    url.searchParams.set('mode', newMode);
    window.history.pushState({}, '', url.toString());
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {mode === 'studio' && (
        <StudioDashboard
          onSwitchToOperator={() => handleSetMode('operator')}
          onSwitchToProjector={() => handleSetMode('projector')}
        />
      )}

      {mode === 'operator' && (
        <CameraOperatorView onReturnToStudio={() => handleSetMode('studio')} />
      )}

      {mode === 'projector' && <ProjectorView />}
    </div>
  );
}
