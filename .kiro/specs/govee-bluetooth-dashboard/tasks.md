# Implementation Plan

- [ ] 1. Set up project structure and dependencies




  - Initialize Vite + React + TypeScript project
  - Install dependencies: Tailwind CSS, fast-check, vitest
  - Configure TypeScript with strict mode
  - Set up Tailwind CSS configuration
  - Create basic folder structure (components, services, utils, types, hooks)
  - _Requirements: All_

- [x] 2. Implement command encoder/decoder utilities













  - Create TypeScript types for commands and device state
  - Implement power command encoder
  - Implement brightness command encoder
  - Implement color command encoder
  - Implement checksum calculation function
  - Implement state parser for device responses
  - _Requirements: 4.1, 5.1, 6.2_

- [x] 2.1 Write property test for command checksum validity






  - **Property 3: Command checksum validity**
  - **Validates: Requirements 4.1, 5.1, 6.2**

- [x] 2.2 Write property test for input value bounds validation


  - **Property 4: Input value bounds validation**
  - **Validates: Requirements 5.3, 6.3**

- [x] 2.3 Write unit tests for command encoders


  - Test power command byte sequence
  - Test brightness command byte sequence
  - Test color command byte sequence
  - Test state parser with sample data
  - _Requirements: 4.1, 5.1, 6.2_

- [x] 3. Implement BLE communication service





  - Create BLEService class with Web Bluetooth API integration
  - Implement device scanning with Govee filter
  - Implement device connection logic
  - Implement device disconnection with cleanup
  - Implement characteristic read/write operations
  - Implement characteristic subscription mechanism
  - Add error handling for BLE operations
  - _Requirements: 1.1, 2.1, 2.2, 3.1, 3.4_

- [x] 3.1 Write property test for device discovery completeness


  - **Property 1: Device discovery completeness**
  - **Validates: Requirements 1.2, 9.1**

- [x] 3.2 Write unit tests for BLE service


  - Test scan initiation
  - Test connection error handling
  - Test disconnection cleanup
  - _Requirements: 1.1, 2.1, 3.1_

- [x] 4. Implement device manager





  - Create DeviceManager class
  - Implement device registry (Map-based storage)
  - Implement connection queue with FIFO ordering
  - Implement command sending with device lookup
  - Implement state reading after connection
  - Add connection state tracking
  - Integrate command encoder with BLE service
  - _Requirements: 2.4, 2.5, 3.2, 7.1, 8.1_

- [x] 4.1 Write property test for connection state consistency


  - **Property 2: Connection state consistency**
  - **Validates: Requirements 2.4, 3.2**

- [x] 4.2 Write property test for connection queue ordering


  - **Property 8: Connection queue ordering**
  - **Validates: Requirements 2.5**

- [x] 4.3 Write property test for disconnection cleanup


  - **Property 9: Disconnection cleanup**
  - **Validates: Requirements 3.4**

- [x] 4.4 Write unit tests for device manager


  - Test device registration
  - Test connection queue behavior
  - Test state updates
  - _Requirements: 2.4, 2.5, 8.1_

- [x] 5. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement state management





  - Create AppState interface and initial state
  - Implement reducer with all action types
  - Create React context for state
  - Implement context provider component
  - Create custom hooks for state access (useDevices, useScanning, useDebugMode)
  - _Requirements: 1.4, 2.4, 3.2, 8.2_

- [x] 6.1 Write unit tests for state reducer


  - Test SCAN_START action
  - Test SCAN_COMPLETE action
  - Test DEVICE_CONNECTED action
  - Test DEVICE_DISCONNECTED action
  - Test DEVICE_STATE_UPDATED action
  - Test DEVICE_ERROR action
  - _Requirements: 1.4, 2.4, 3.2_

- [x] 7. Implement device control logic with throttling





  - Create command throttling utility
  - Implement power toggle handler
  - Implement brightness change handler with throttling
  - Implement color change handler
  - Add error recovery for failed commands
  - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 6.2_

- [x] 7.1 Write property test for command throttling preservation


  - **Property 7: Command throttling preservation**
  - **Validates: Requirements 5.2**

- [x] 7.2 Write property test for error state recovery


  - **Property 10: Error state recovery**
  - **Validates: Requirements 4.3**

- [x] 7.3 Write unit tests for control handlers


  - Test power toggle
  - Test brightness throttling
  - Test error recovery
  - _Requirements: 4.1, 4.3, 5.2_

- [x] 8. Build UI components - DeviceScanner





  - Create ScanButton component with loading state
  - Create DeviceScanner component
  - Integrate with device manager scan function
  - Display scanning feedback
  - Show device count after scan
  - _Requirements: 1.1, 1.3, 1.5_

- [x] 8.1 Write unit tests for DeviceScanner


  - Test scan button renders
  - Test loading state display
  - Test device count display
  - _Requirements: 1.1, 1.3_

- [x] 9. Build UI components - DeviceCard





  - Create ConnectionStatus indicator component
  - Create SignalStrength display component
  - Create PowerToggle component
  - Create BrightnessSlider component
  - Create ColorPicker component
  - Create DeviceControls container component
  - Create DeviceCard component integrating all controls
  - Implement conditional rendering based on device capabilities
  - Implement control enable/disable based on connection state
  - _Requirements: 1.2, 1.4, 4.1, 4.4, 5.1, 5.4, 6.1, 9.1_

- [x] 9.1 Write property test for UI control availability


  - **Property 12: UI control availability**
  - **Validates: Requirements 4.4, 5.4, 6.1**

- [x] 9.2 Write unit tests for DeviceCard components


  - Test PowerToggle disabled when disconnected
  - Test BrightnessSlider conditional rendering
  - Test ColorPicker conditional rendering
  - Test ConnectionStatus display
  - _Requirements: 4.4, 5.4, 6.1_

- [x] 10. Build UI components - DeviceList





  - Create DeviceList component
  - Implement device iteration and rendering
  - Add connect/disconnect buttons
  - Integrate with device manager
  - _Requirements: 1.2, 2.1, 3.1, 8.2_

- [x] 10.1 Write property test for multi-device independence


  - **Property 5: Multi-device independence**
  - **Validates: Requirements 8.3**

- [x] 10.2 Write unit tests for DeviceList


  - Test empty list rendering
  - Test multiple device rendering
  - Test connect button functionality
  - _Requirements: 8.2_

- [x] 11. Implement state synchronization





  - Add device state polling after connection
  - Implement state update propagation to UI
  - Add timeout handling for state updates
  - Display unknown state indicator on read failure
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 11.1 Write property test for device state reading completeness


  - **Property 11: Device state reading completeness**
  - **Validates: Requirements 7.1, 7.2, 7.3**

- [x] 11.2 Write property test for state update propagation


  - **Property 6: State update propagation**
  - **Validates: Requirements 4.2, 6.4, 7.4**

- [x] 11.3 Write unit tests for state synchronization


  - Test state reading after connection
  - Test state update timeout
  - Test unknown state display
  - _Requirements: 7.1, 7.4, 7.5_

- [x] 12. Checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement debug panel





  - Create DebugPanel component with conditional rendering
  - Display BLE services and characteristics
  - Implement characteristic value logging
  - Add raw read/write controls
  - Add command byte logging
  - Create debug mode toggle
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 13.1 Write unit tests for debug panel


  - Test debug panel conditional rendering
  - Test service/characteristic display
  - Test debug mode toggle
  - _Requirements: 10.1, 10.3_

- [x] 14. Build main App component





  - Create App component structure
  - Integrate state provider
  - Add DeviceScanner
  - Add DeviceList
  - Add DebugPanel
  - Implement responsive layout
  - Add error boundary
  - _Requirements: All_

- [x] 14.1 Write integration tests


  - Test full scan-connect-control flow
  - Test multi-device scenario
  - Test error recovery flow
  - _Requirements: 1.1, 2.1, 4.1, 5.1, 6.2_

- [x] 15. Add connection quality monitoring





  - Implement RSSI monitoring for connected devices
  - Add signal strength threshold detection
  - Display warning indicator for weak signals
  - Detect and handle out-of-range disconnections
  - _Requirements: 9.2, 9.3, 9.4_

- [x] 15.1 Write unit tests for connection quality


  - Test RSSI monitoring
  - Test threshold detection
  - Test warning display
  - _Requirements: 9.2, 9.3_

- [x] 16. Implement error handling and recovery





  - Add BLEError class with error codes
  - Implement retry logic for transient errors
  - Add user-friendly error messages
  - Implement graceful degradation
  - Add browser compatibility check
  - _Requirements: 2.3, 4.3_

- [x] 16.1 Write unit tests for error handling


  - Test error classification
  - Test retry logic
  - Test error message display
  - _Requirements: 2.3, 4.3_

- [x] 17. Add styling and polish





  - Apply Tailwind CSS styling to all components
  - Implement responsive design
  - Add loading states and transitions
  - Add icons for connection status
  - Ensure accessibility (ARIA labels, keyboard navigation)
  - _Requirements: All_

- [x] 18. Final checkpoint - Ensure all tests pass





  - Ensure all tests pass, ask the user if questions arise.
