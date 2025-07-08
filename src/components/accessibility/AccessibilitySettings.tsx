'use client';

import React, { useState } from 'react';
import { cn } from '@/utils';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { 
  Settings, 
  Eye, 
  EyeOff, 
  Volume2, 
  VolumeX, 
  Type, 
  Mouse, 
  Keyboard,
  Palette,
  Focus,
  Play,
  Pause,
  RotateCcw,
  Check
} from 'lucide-react';

interface AccessibilitySettingsProps {
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

export const AccessibilitySettings: React.FC<AccessibilitySettingsProps> = ({
  isOpen = false,
  onClose,
  className
}) => {
  const { preferences, updatePreferences, resetPreferences, announceToScreenReader } = useAccessibility();
  const [activeSection, setActiveSection] = useState<'visual' | 'audio' | 'navigation' | 'interaction'>('visual');

  const handleTogglePreference = (key: keyof typeof preferences) => {
    const newValue = !preferences[key];
    updatePreferences({ [key]: newValue });
    
    // Announce changes to screen reader
    announceToScreenReader(
      `${key.replace(/([A-Z])/g, ' $1').toLowerCase()} ${newValue ? 'enabled' : 'disabled'}`,
      'polite'
    );
  };

  const handleSliderChange = (key: keyof typeof preferences, value: number) => {
    updatePreferences({ [key]: value });
    announceToScreenReader(
      `${key.replace(/([A-Z])/g, ' $1').toLowerCase()} set to ${value}`,
      'polite'
    );
  };

  const handleThemeChange = (theme: 'light' | 'dark' | 'auto') => {
    updatePreferences({ theme });
    announceToScreenReader(`Theme changed to ${theme}`, 'polite');
  };

  const handleReset = () => {
    resetPreferences();
    announceToScreenReader('Accessibility preferences reset to defaults', 'assertive');
  };

  if (!isOpen) return null;

  return (
    <div 
      className={cn(
        "fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4",
        className
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="accessibility-settings-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose?.();
        }
      }}
    >
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle id="accessibility-settings-title" className="flex items-center gap-2">
              <Settings className="h-5 w-5" aria-hidden="true" />
              Accessibility Settings
            </CardTitle>
            <CardDescription>
              Customize your accessibility preferences for a better experience
            </CardDescription>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close accessibility settings"
            >
              <span className="sr-only">Close</span>
              ×
            </Button>
          )}
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Section Navigation */}
          <nav role="tablist" aria-label="Accessibility settings sections">
            <div className="flex flex-wrap gap-2 border-b border-border pb-4">
              {[
                { key: 'visual', label: 'Visual', icon: Eye },
                { key: 'audio', label: 'Audio', icon: Volume2 },
                { key: 'navigation', label: 'Navigation', icon: Keyboard },
                { key: 'interaction', label: 'Interaction', icon: Mouse }
              ].map(({ key, label, icon: Icon }) => (
                <Button
                  key={key}
                  variant={activeSection === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveSection(key as any)}
                  role="tab"
                  aria-selected={activeSection === key}
                  aria-controls={`${key}-panel`}
                  className="flex items-center gap-2"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </Button>
              ))}
            </div>
          </nav>

          {/* Visual Settings */}
          {activeSection === 'visual' && (
            <div
              id="visual-panel"
              role="tabpanel"
              aria-labelledby="visual-tab"
              className="space-y-6"
            >
              <h3 className="text-lg font-semibold">Visual Preferences</h3>
              
              {/* Theme Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Color Theme</label>
                <div className="flex gap-2">
                  {[
                    { value: 'light', label: 'Light' },
                    { value: 'dark', label: 'Dark' },
                    { value: 'auto', label: 'Auto' }
                  ].map(({ value, label }) => (
                    <Button
                      key={value}
                      variant={preferences.theme === value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleThemeChange(value as any)}
                      className="flex-1"
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* High Contrast */}
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="high-contrast" className="text-sm font-medium">
                    High Contrast Mode
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Increases contrast for better visibility
                  </p>
                </div>
                <Button
                  id="high-contrast"
                  variant={preferences.highContrast ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleTogglePreference('highContrast')}
                  aria-pressed={preferences.highContrast}
                  className="min-w-[80px]"
                >
                  {preferences.highContrast ? (
                    <><Check className="h-4 w-4 mr-2" />On</>
                  ) : (
                    'Off'
                  )}
                </Button>
              </div>

              {/* Large Text */}
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="large-text" className="text-sm font-medium">
                    Large Text
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Increases text size for better readability
                  </p>
                </div>
                <Button
                  id="large-text"
                  variant={preferences.largeText ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleTogglePreference('largeText')}
                  aria-pressed={preferences.largeText}
                  className="min-w-[80px]"
                >
                  {preferences.largeText ? (
                    <><Check className="h-4 w-4 mr-2" />On</>
                  ) : (
                    'Off'
                  )}
                </Button>
              </div>

              {/* Color Blind Friendly */}
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="color-blind-friendly" className="text-sm font-medium">
                    Color Blind Friendly
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Uses alternative color schemes and patterns
                  </p>
                </div>
                <Button
                  id="color-blind-friendly"
                  variant={preferences.colorBlindFriendly ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleTogglePreference('colorBlindFriendly')}
                  aria-pressed={preferences.colorBlindFriendly}
                  className="min-w-[80px]"
                >
                  {preferences.colorBlindFriendly ? (
                    <><Check className="h-4 w-4 mr-2" />On</>
                  ) : (
                    'Off'
                  )}
                </Button>
              </div>

              {/* Font Size */}
              <div className="space-y-3">
                <label htmlFor="font-size" className="text-sm font-medium">
                  Font Size: {preferences.fontSize}px
                </label>
                <input
                  id="font-size"
                  type="range"
                  min="12"
                  max="24"
                  step="1"
                  value={preferences.fontSize}
                  onChange={(e) => handleSliderChange('fontSize', parseInt(e.target.value))}
                  className="w-full"
                  aria-describedby="font-size-help"
                />
                <p id="font-size-help" className="text-xs text-muted-foreground">
                  Adjust the base font size (12px - 24px)
                </p>
              </div>

              {/* Line Height */}
              <div className="space-y-3">
                <label htmlFor="line-height" className="text-sm font-medium">
                  Line Height: {preferences.lineHeight}
                </label>
                <input
                  id="line-height"
                  type="range"
                  min="1.2"
                  max="2.0"
                  step="0.1"
                  value={preferences.lineHeight}
                  onChange={(e) => handleSliderChange('lineHeight', parseFloat(e.target.value))}
                  className="w-full"
                  aria-describedby="line-height-help"
                />
                <p id="line-height-help" className="text-xs text-muted-foreground">
                  Adjust spacing between lines (1.2 - 2.0)
                </p>
              </div>
            </div>
          )}

          {/* Audio Settings */}
          {activeSection === 'audio' && (
            <div
              id="audio-panel"
              role="tabpanel"
              aria-labelledby="audio-tab"
              className="space-y-6"
            >
              <h3 className="text-lg font-semibold">Audio Preferences</h3>
              
              {/* Audio Descriptions */}
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="audio-descriptions" className="text-sm font-medium">
                    Audio Descriptions
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Enable audio descriptions for visual content
                  </p>
                </div>
                <Button
                  id="audio-descriptions"
                  variant={preferences.audioDescriptions ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleTogglePreference('audioDescriptions')}
                  aria-pressed={preferences.audioDescriptions}
                  className="min-w-[80px]"
                >
                  {preferences.audioDescriptions ? (
                    <><Volume2 className="h-4 w-4 mr-2" />On</>
                  ) : (
                    <><VolumeX className="h-4 w-4 mr-2" />Off</>
                  )}
                </Button>
              </div>

              {/* Auto-play */}
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="autoplay" className="text-sm font-medium">
                    Auto-play Media
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Automatically play audio and video content
                  </p>
                </div>
                <Button
                  id="autoplay"
                  variant={preferences.autoplay ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleTogglePreference('autoplay')}
                  aria-pressed={preferences.autoplay}
                  className="min-w-[80px]"
                >
                  {preferences.autoplay ? (
                    <><Play className="h-4 w-4 mr-2" />On</>
                  ) : (
                    <><Pause className="h-4 w-4 mr-2" />Off</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Navigation Settings */}
          {activeSection === 'navigation' && (
            <div
              id="navigation-panel"
              role="tabpanel"
              aria-labelledby="navigation-tab"
              className="space-y-6"
            >
              <h3 className="text-lg font-semibold">Navigation Preferences</h3>
              
              {/* Keyboard Navigation */}
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="keyboard-navigation" className="text-sm font-medium">
                    Enhanced Keyboard Navigation
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Improved keyboard shortcuts and navigation
                  </p>
                </div>
                <Button
                  id="keyboard-navigation"
                  variant={preferences.keyboardNavigation ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleTogglePreference('keyboardNavigation')}
                  aria-pressed={preferences.keyboardNavigation}
                  className="min-w-[80px]"
                >
                  {preferences.keyboardNavigation ? (
                    <><Keyboard className="h-4 w-4 mr-2" />On</>
                  ) : (
                    'Off'
                  )}
                </Button>
              </div>

              {/* Focus Indicators */}
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="focus-indicators" className="text-sm font-medium">
                    Enhanced Focus Indicators
                  </label>
                  <p className="text-xs text-muted-foreground">
                    More visible focus outlines and indicators
                  </p>
                </div>
                <Button
                  id="focus-indicators"
                  variant={preferences.focusIndicators ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleTogglePreference('focusIndicators')}
                  aria-pressed={preferences.focusIndicators}
                  className="min-w-[80px]"
                >
                  {preferences.focusIndicators ? (
                    <><Focus className="h-4 w-4 mr-2" />On</>
                  ) : (
                    'Off'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Interaction Settings */}
          {activeSection === 'interaction' && (
            <div
              id="interaction-panel"
              role="tabpanel"
              aria-labelledby="interaction-tab"
              className="space-y-6"
            >
              <h3 className="text-lg font-semibold">Interaction Preferences</h3>
              
              {/* Reduced Motion */}
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="reduce-motion" className="text-sm font-medium">
                    Reduce Motion
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Minimize animations and transitions
                  </p>
                </div>
                <Button
                  id="reduce-motion"
                  variant={preferences.reduceMotion ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleTogglePreference('reduceMotion')}
                  aria-pressed={preferences.reduceMotion}
                  className="min-w-[80px]"
                >
                  {preferences.reduceMotion ? (
                    <><Check className="h-4 w-4 mr-2" />On</>
                  ) : (
                    'Off'
                  )}
                </Button>
              </div>

              {/* Screen Reader */}
              <div className="flex items-center justify-between">
                <div>
                  <label htmlFor="screen-reader" className="text-sm font-medium">
                    Screen Reader Optimizations
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Enhanced compatibility with screen readers
                  </p>
                </div>
                <Button
                  id="screen-reader"
                  variant={preferences.screenReader ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleTogglePreference('screenReader')}
                  aria-pressed={preferences.screenReader}
                  className="min-w-[80px]"
                >
                  {preferences.screenReader ? (
                    <><Check className="h-4 w-4 mr-2" />On</>
                  ) : (
                    'Off'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between pt-6 border-t border-border">
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reset to Defaults
            </Button>
            
            {onClose && (
              <Button onClick={onClose}>
                Save & Close
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AccessibilitySettings;