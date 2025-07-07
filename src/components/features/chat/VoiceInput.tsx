'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { Button } from '../../ui/Button';
import { audioService, AudioTranscription, RecordingStatus } from '../../../services/audio-service';

interface VoiceInputProps {
  onTranscription: (text: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
}

interface VoiceInputState {
  isRecording: boolean;
  isProcessing: boolean;
  hasPermission: boolean;
  isSupported: boolean;
  error: string | null;
  volume: number;
  transcription: string;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({
  onTranscription,
  onError,
  disabled = false,
  className = ''
}) => {
  const [state, setState] = useState<VoiceInputState>({
    isRecording: false,
    isProcessing: false,
    hasPermission: false,
    isSupported: audioService.isRecordingSupported(),
    error: null,
    volume: 0,
    transcription: ''
  });

  const recordingTimeoutRef = useRef<NodeJS.Timeout>();
  const volumeIntervalRef = useRef<NodeJS.Timeout>();

  // Check for browser support and permissions on mount
  useEffect(() => {
    checkPermissions();
    
    return () => {
      // Cleanup on unmount
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
      if (volumeIntervalRef.current) {
        clearInterval(volumeIntervalRef.current);
      }
      
      if (state.isRecording) {
        handleStopRecording();
      }
    };
  }, []);

  /**
   * Check microphone permissions
   */
  const checkPermissions = async () => {
    if (!state.isSupported) {
      setState(prev => ({ 
        ...prev, 
        error: 'Voice recording is not supported in this browser' 
      }));
      return;
    }

    try {
      const hasPermission = await audioService.requestMicrophonePermission();
      setState(prev => ({ 
        ...prev, 
        hasPermission, 
        error: hasPermission ? null : 'Microphone permission denied' 
      }));
    } catch (error) {
      console.error('Permission check failed:', error);
      setState(prev => ({ 
        ...prev, 
        hasPermission: false, 
        error: 'Failed to check microphone permissions' 
      }));
    }
  };

  /**
   * Start recording audio
   */
  const handleStartRecording = useCallback(async () => {
    if (!state.hasPermission || !state.isSupported || disabled) {
      return;
    }

    try {
      setState(prev => ({ ...prev, isRecording: true, error: null, transcription: '' }));
      
      await audioService.startRecording();
      
      // Auto-stop recording after 30 seconds
      recordingTimeoutRef.current = setTimeout(() => {
        handleStopRecording();
      }, 30000);

      // Start volume monitoring
      startVolumeMonitoring();

    } catch (error) {
      console.error('Failed to start recording:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      setState(prev => ({ ...prev, isRecording: false, error: errorMessage }));
      onError?.(errorMessage);
    }
  }, [state.hasPermission, state.isSupported, disabled, onError]);

  /**
   * Stop recording audio and process transcription
   */
  const handleStopRecording = useCallback(async () => {
    if (!state.isRecording) {
      return;
    }

    try {
      setState(prev => ({ ...prev, isRecording: false, isProcessing: true }));
      
      // Clear timeouts
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
      if (volumeIntervalRef.current) {
        clearInterval(volumeIntervalRef.current);
      }

      // Stop recording and get audio blob
      const audioBlob = await audioService.stopRecording();
      
      // Transcribe audio
      const transcription: AudioTranscription = await audioService.transcribeAudio(audioBlob);
      
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        transcription: transcription.text,
        volume: 0
      }));

      // Send transcription to parent component
      onTranscription(transcription.text);

    } catch (error) {
      console.error('Failed to stop recording:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to process recording';
      setState(prev => ({ 
        ...prev, 
        isRecording: false, 
        isProcessing: false, 
        error: errorMessage,
        volume: 0
      }));
      onError?.(errorMessage);
    }
  }, [state.isRecording, onTranscription, onError]);

  /**
   * Toggle recording state
   */
  const handleToggleRecording = useCallback(() => {
    if (state.isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  }, [state.isRecording, handleStartRecording, handleStopRecording]);

  /**
   * Start monitoring audio volume levels
   */
  const startVolumeMonitoring = () => {
    volumeIntervalRef.current = setInterval(() => {
      const status: RecordingStatus = audioService.getRecordingStatus();
      if (status.isRecording) {
        // Simulate volume level (in real implementation, you'd get this from audio analysis)
        const volume = Math.random() * 100;
        setState(prev => ({ ...prev, volume }));
      }
    }, 100);
  };

  /**
   * Get button variant based on current state
   */
  const getButtonVariant = () => {
    if (state.isRecording) return 'destructive';
    if (state.error) return 'outline';
    return 'default';
  };

  /**
   * Get button icon based on current state
   */
  const getButtonIcon = () => {
    if (state.isProcessing) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    if (state.isRecording) {
      return <MicOff className="h-4 w-4" />;
    }
    return <Mic className="h-4 w-4" />;
  };

  /**
   * Get button text based on current state
   */
  const getButtonText = () => {
    if (state.isProcessing) return 'Processing...';
    if (state.isRecording) return 'Stop Recording';
    if (state.error) return 'Try Again';
    return 'Start Recording';
  };

  // Don't render if not supported
  if (!state.isSupported) {
    return null;
  }

  return (
    <div className={`flex flex-col items-center space-y-2 ${className}`}>
      {/* Main recording button */}
      <div className="relative">
        <Button
          onClick={handleToggleRecording}
          disabled={disabled || !state.hasPermission || state.isProcessing}
          variant={getButtonVariant()}
          size="lg"
          className="relative overflow-hidden"
        >
          {getButtonIcon()}
          <span className="ml-2">{getButtonText()}</span>
          
          {/* Recording pulse animation */}
          {state.isRecording && (
            <div className="absolute inset-0 bg-red-500 opacity-20 animate-pulse" />
          )}
        </Button>

        {/* Volume indicator */}
        {state.isRecording && (
          <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse" />
        )}
      </div>

      {/* Volume level indicator */}
      {state.isRecording && (
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          {state.volume > 20 ? (
            <Volume2 className="h-4 w-4" />
          ) : (
            <VolumeX className="h-4 w-4" />
          )}
          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 transition-all duration-100"
              style={{ width: `${Math.min(state.volume, 100)}%` }}
            />
          </div>
          <span className="text-xs">{Math.round(state.volume)}%</span>
        </div>
      )}

      {/* Error display */}
      {state.error && !state.isRecording && (
        <div className="text-xs text-destructive text-center max-w-xs">
          {state.error}
        </div>
      )}

      {/* Transcription preview */}
      {state.transcription && (
        <div className="text-xs text-muted-foreground text-center max-w-xs p-2 bg-muted rounded">
          <strong>Transcribed:</strong> {state.transcription}
        </div>
      )}

      {/* Permission request helper */}
      {!state.hasPermission && state.isSupported && (
        <Button
          onClick={checkPermissions}
          variant="outline"
          size="sm"
          className="text-xs"
        >
          Enable Microphone
        </Button>
      )}

      {/* Recording instructions */}
      {state.hasPermission && !state.error && !state.isRecording && (
        <div className="text-xs text-muted-foreground text-center max-w-xs">
          Click to start voice input. Recording will auto-stop after 30 seconds.
        </div>
      )}
    </div>
  );
};

export default VoiceInput;