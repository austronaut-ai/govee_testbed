import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DebugModeToggle } from './DebugModeToggle';
import * as AppContext from '../context/AppContext';

// Mock the context hooks
vi.mock('../context/AppContext', () => ({
  useDebugMode: vi.fn(),
  useAppDispatch: vi.fn(),
}));

describe('DebugModeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the toggle with correct label', () => {
    vi.mocked(AppContext.useDebugMode).mockReturnValue(false);
    vi.mocked(AppContext.useAppDispatch).mockReturnValue(vi.fn());

    render(<DebugModeToggle />);

    expect(screen.getByText('Debug Mode')).toBeInTheDocument();
    expect(screen.getByTestId('debug-mode-checkbox')).toBeInTheDocument();
  });

  it('should reflect debug mode state in checkbox', () => {
    vi.mocked(AppContext.useDebugMode).mockReturnValue(true);
    vi.mocked(AppContext.useAppDispatch).mockReturnValue(vi.fn());

    render(<DebugModeToggle />);

    const checkbox = screen.getByTestId('debug-mode-checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('should dispatch TOGGLE_DEBUG_MODE action when clicked', async () => {
    const mockDispatch = vi.fn();
    vi.mocked(AppContext.useDebugMode).mockReturnValue(false);
    vi.mocked(AppContext.useAppDispatch).mockReturnValue(mockDispatch);

    render(<DebugModeToggle />);

    const checkbox = screen.getByTestId('debug-mode-checkbox');
    await userEvent.click(checkbox);

    expect(mockDispatch).toHaveBeenCalledWith({ type: 'TOGGLE_DEBUG_MODE' });
  });

  it('should toggle from checked to unchecked', async () => {
    const mockDispatch = vi.fn();
    vi.mocked(AppContext.useDebugMode).mockReturnValue(true);
    vi.mocked(AppContext.useAppDispatch).mockReturnValue(mockDispatch);

    render(<DebugModeToggle />);

    const checkbox = screen.getByTestId('debug-mode-checkbox');
    await userEvent.click(checkbox);

    expect(mockDispatch).toHaveBeenCalledWith({ type: 'TOGGLE_DEBUG_MODE' });
  });
});
