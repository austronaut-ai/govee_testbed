// Unit tests for SignalStrength component
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SignalStrength } from './SignalStrength';

describe('SignalStrength', () => {
  it('should display RSSI value', () => {
    render(<SignalStrength rssi={-50} />);
    expect(screen.getByText('-50 dBm')).toBeInTheDocument();
  });

  it('should display warning indicator for weak signal', () => {
    render(<SignalStrength rssi={-75} isWeak={true} />);
    
    // Check for warning icon (SVG)
    const warning = screen.getByTitle('Weak signal');
    expect(warning).toBeInTheDocument();
    expect(warning.tagName).toBe('svg');
  });

  it('should not display warning for strong signal', () => {
    render(<SignalStrength rssi={-50} isWeak={false} />);
    
    // Warning should not be present
    expect(screen.queryByTitle('Weak signal')).not.toBeInTheDocument();
  });

  it('should display out-of-range indicator', () => {
    render(<SignalStrength rssi={-95} isWeak={true} isOutOfRange={true} />);
    
    // Check for out-of-range icon (SVG)
    const outOfRange = screen.getByTitle('Out of range');
    expect(outOfRange).toBeInTheDocument();
    expect(outOfRange.tagName).toBe('svg');
  });

  it('should not display out-of-range indicator for normal signal', () => {
    render(<SignalStrength rssi={-50} isWeak={false} isOutOfRange={false} />);
    
    // Out-of-range indicator should not be present
    expect(screen.queryByTitle('Out of range')).not.toBeInTheDocument();
  });

  it('should display out-of-range instead of weak warning when out of range', () => {
    render(<SignalStrength rssi={-95} isWeak={true} isOutOfRange={true} />);
    
    // Should show out-of-range but not weak warning
    expect(screen.getByTitle('Out of range')).toBeInTheDocument();
    expect(screen.queryByTitle('Weak signal')).not.toBeInTheDocument();
  });

  it('should have appropriate ARIA role for warnings', () => {
    const { container } = render(<SignalStrength rssi={-75} isWeak={true} />);
    
    const warning = container.querySelector('[role="alert"]');
    expect(warning).toBeInTheDocument();
  });
});
