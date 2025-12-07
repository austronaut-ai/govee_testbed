import React, { Component, type ReactNode } from 'react';
import { AppProvider } from './context/AppContext';
import { DeviceScanner } from './components/DeviceScanner';
import { DeviceList } from './components/DeviceList';
import { DebugPanel } from './components/DebugPanel';
import { DebugModeToggle } from './components/DebugModeToggle';
import { BrowserCompatibilityCheck } from './components/BrowserCompatibilityCheck';
import { BLEService } from './services/ble.service';
import { DeviceManager } from './services/device-manager';
import './App.css';

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert">
          <h1>Something went wrong</h1>
          <p>{this.state.error?.message || 'An unexpected error occurred'}</p>
          <button onClick={() => window.location.reload()}>
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

import { useDashboardMode, useAppDispatch } from './context/AppContext';
import { WiFiDashboard } from './components/WiFiDashboard';

// Create singleton instances
const bleService = new BLEService();
const deviceManager = new DeviceManager(bleService);

function AppContent() {
  const dashboardMode = useDashboardMode();
  const dispatch = useAppDispatch();

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="flex items-center gap-4">
          <h1>Govee Dashboard</h1>
          <div className="flex bg-gray-700 rounded p-1 text-sm">
            <button
              onClick={() => dashboardMode !== 'ble' && dispatch({ type: 'TOGGLE_DASHBOARD_MODE' })}
              className={`px-3 py-1 rounded ${dashboardMode === 'ble' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}
            >
              Bluetooth
            </button>
            <button
              onClick={() => dashboardMode !== 'wifi' && dispatch({ type: 'TOGGLE_DASHBOARD_MODE' })}
              className={`px-3 py-1 rounded ${dashboardMode === 'wifi' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}
            >
              WiFi
            </button>
          </div>
        </div>
        <DebugModeToggle />
      </header>

      <main className="app-main">
        <BrowserCompatibilityCheck />

        {dashboardMode === 'ble' ? (
          <>
            <section className="scanner-section">
              <DeviceScanner deviceManager={deviceManager} />
            </section>

            <section className="devices-section">
              <DeviceList deviceManager={deviceManager} />
            </section>

            <section className="debug-section">
              <DebugPanel bleService={bleService} />
            </section>
          </>
        ) : (
          <section className="wifi-section p-4">
            <WiFiDashboard />
          </section>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
