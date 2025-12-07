import React from 'react';
import { useDebugMode, useAppDispatch } from '../context/AppContext';

export function DebugModeToggle() {
  const debugMode = useDebugMode();
  const dispatch = useAppDispatch();

  const handleToggle = () => {
    dispatch({ type: 'TOGGLE_DEBUG_MODE' });
  };

  return (
    <div className="debug-mode-toggle">
      <label className="toggle-label">
        <input
          type="checkbox"
          checked={debugMode}
          onChange={handleToggle}
          data-testid="debug-mode-checkbox"
        />
        <span className="toggle-text">Debug Mode</span>
      </label>
    </div>
  );
}
