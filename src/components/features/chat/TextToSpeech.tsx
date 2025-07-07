'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Volume2, VolumeX, Pause, Play, Settings } from 'lucide-react';
import { Button } from '../../ui/Button';
import { 
  audioService, 
  VoiceSettings, 
  AudioSynthesis 
} from '../../../services/audio-service';

interface TextToSpeechProps {
  text: string;
  autoPlay?: boolean;
  showControls?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

interface TextToSpeechState {
  isPlaying: boolean;
  isSupported: boolean;
  voices: SpeechSynthesisVoice[];
  settings: VoiceSettings;
  error: string | null;
}

export const TextToSpeech: React.FC<TextToSpeechProps> = ({
  text,
  autoPlay = false,
  showControls = true,
  onStart,
  onEnd,
  onError,
  className = ''
}) => {
  const [state, setState] = useState<TextToSpeechState>({
    isPlaying: false,
    isSupported: audioService.isSpeechSynthesisSupported(),
    voices: [],
    settings: {
      voice: 'alloy',
      speed: 1.0,
      pitch: 1.0,
      volume: 1.0
    },
    error: null
  });

  const [showSettings, setShowSettings] = useState(false);

  // Load available voices on mount
  useEffect(() => {
    if (state.isSupported) {
      loadVoices();
      
      // Some browsers load voices asynchronously
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, [state.isSupported]);

  // Auto-play if enabled and text is provided
  useEffect(() => {
    if (autoPlay && text && state.isSupported && !state.isPlaying) {
      handlePlay();
    }
  }, [text, autoPlay, state.isSupported]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      audioService.cancelSpeech();
    };
  }, []);

  /**
   * Load available voices
   */
  const loadVoices = useCallback(() => {
    if (!state.isSupported) return;

    const voices = audioService.getAvailableVoices();
    setState(prev => ({ 
      ...prev, 
      voices,
      settings: {
        ...prev.settings,
        voice: voices.length > 0 ? voices[0].name : 'alloy'
      }
    }));
  }, [state.isSupported]);

  /**
   * Start text-to-speech playback
   */
  const handlePlay = useCallback(async () => {
    if (!text || !state.isSupported || state.isPlaying) {
      return;
    }

    try {
      setState(prev => ({ ...prev, isPlaying: true, error: null }));
      onStart?.();

      const synthesis: AudioSynthesis = await audioService.textToSpeech(text, state.settings);
      
      setState(prev => ({ ...prev, isPlaying: false }));
      onEnd?.();

    } catch (error) {
      console.error('Text-to-speech failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Speech synthesis failed';
      setState(prev => ({ ...prev, isPlaying: false, error: errorMessage }));
      onError?.(errorMessage);
    }
  }, [text, state.isSupported, state.isPlaying, state.settings, onStart, onEnd, onError]);

  /**
   * Stop text-to-speech playback
   */
  const handleStop = useCallback(() => {
    if (!state.isPlaying) return;

    audioService.cancelSpeech();
    setState(prev => ({ ...prev, isPlaying: false }));
    onEnd?.();
  }, [state.isPlaying, onEnd]);

  /**
   * Toggle playback
   */
  const handleToggle = useCallback(() => {
    if (state.isPlaying) {
      handleStop();
    } else {
      handlePlay();
    }
  }, [state.isPlaying, handlePlay, handleStop]);

  /**
   * Update voice settings
   */
  const updateSettings = useCallback((newSettings: Partial<VoiceSettings>) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...newSettings }
    }));
  }, []);

  /**
   * Handle voice selection change
   */
  const handleVoiceChange = useCallback((voiceName: string) => {
    updateSettings({ voice: voiceName });
  }, [updateSettings]);

  /**
   * Handle speed change
   */
  const handleSpeedChange = useCallback((speed: number) => {
    updateSettings({ speed });
  }, [updateSettings]);

  /**
   * Handle pitch change
   */
  const handlePitchChange = useCallback((pitch: number) => {
    updateSettings({ pitch });
  }, [updateSettings]);

  /**
   * Handle volume change
   */
  const handleVolumeChange = useCallback((volume: number) => {
    updateSettings({ volume });
  }, [updateSettings]);

  // Don't render if not supported or no text
  if (!state.isSupported || !text) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Main play/pause button */}
      <Button
        onClick={handleToggle}
        disabled={!text}
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        title={state.isPlaying ? 'Stop speech' : 'Play speech'}
      >
        {state.isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>

      {/* Volume indicator */}
      <div className="flex items-center">
        {state.settings.volume > 0 ? (
          <Volume2 className="h-4 w-4 text-muted-foreground" />
        ) : (
          <VolumeX className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Settings toggle */}
      {showControls && (
        <Button
          onClick={() => setShowSettings(!showSettings)}
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title="Voice settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      )}

      {/* Error indicator */}
      {state.error && (
        <div className="text-xs text-destructive" title={state.error}>
          Error
        </div>
      )}

      {/* Settings panel */}
      {showSettings && showControls && (
        <div className="absolute top-full left-0 mt-2 p-4 bg-background border rounded-lg shadow-lg z-10 min-w-[280px]">
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Voice Settings</h4>
            
            {/* Voice selection */}
            <div className="space-y-2">
              <label className="text-xs font-medium">Voice</label>
              <select
                value={state.settings.voice}
                onChange={(e) => handleVoiceChange(e.target.value)}
                className="w-full text-xs p-1 border rounded"
              >
                {state.voices.map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
            </div>

            {/* Speed control */}
            <div className="space-y-2">
              <label className="text-xs font-medium">
                Speed: {state.settings.speed.toFixed(1)}x
              </label>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={state.settings.speed}
                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Pitch control */}
            <div className="space-y-2">
              <label className="text-xs font-medium">
                Pitch: {state.settings.pitch.toFixed(1)}
              </label>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={state.settings.pitch}
                onChange={(e) => handlePitchChange(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Volume control */}
            <div className="space-y-2">
              <label className="text-xs font-medium">
                Volume: {Math.round(state.settings.volume * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={state.settings.volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Close button */}
            <Button
              onClick={() => setShowSettings(false)}
              variant="outline"
              size="sm"
              className="w-full text-xs"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TextToSpeech;