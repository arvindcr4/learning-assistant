'use client';

import React, { useState } from 'react';
import { Settings, User, Bot, Zap, Target, MessageCircle, Volume2, Eye, BookOpen, Move } from 'lucide-react';
import { ChatSettings as ChatSettingsType, AIPersona, LearningStyleType } from '../../../types';
import { AI_PERSONAS, CONVERSATION_STYLES } from '../../../lib/ai-config';

interface ChatSettingsProps {
  settings: ChatSettingsType;
  onSettingsChange: (settings: ChatSettingsType) => void;
  onClose: () => void;
}

export const ChatSettings: React.FC<ChatSettingsProps> = ({
  settings,
  onSettingsChange,
  onClose
}) => {
  const [localSettings, setLocalSettings] = useState<ChatSettingsType>(settings);

  const handlePersonaChange = (personaKey: string) => {
    const persona = AI_PERSONAS[personaKey];
    if (persona) {
      setLocalSettings(prev => ({
        ...prev,
        aiPersona: persona
      }));
    }
  };

  const handleStyleChange = (style: keyof typeof CONVERSATION_STYLES) => {
    setLocalSettings(prev => ({
      ...prev,
      conversationStyle: style
    }));
  };

  const handleToggleChange = (key: keyof ChatSettingsType) => {
    setLocalSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleEncouragementLevelChange = (level: 'minimal' | 'moderate' | 'high') => {
    setLocalSettings(prev => ({
      ...prev,
      encouragementLevel: level
    }));
  };

  const handleSave = () => {
    onSettingsChange(localSettings);
    onClose();
  };

  const renderPersonaCard = (key: string, persona: AIPersona) => {
    const isSelected = localSettings.aiPersona.type === persona.type;
    
    return (
      <div
        key={key}
        onClick={() => handlePersonaChange(key)}
        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
          isSelected 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="flex items-start space-x-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isSelected ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            <Bot size={20} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{persona.name}</h3>
            <p className="text-sm text-gray-600 capitalize">{persona.type.replace('_', ' ')}</p>
            <p className="text-xs text-gray-500 mt-1">{persona.personality}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {persona.expertise.slice(0, 3).map((skill, idx) => (
                <span key={idx} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderConversationStyleCard = (key: string, style: any) => {
    const isSelected = localSettings.conversationStyle === key;
    
    return (
      <div
        key={key}
        onClick={() => handleStyleChange(key as keyof typeof CONVERSATION_STYLES)}
        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
          isSelected 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <h4 className="font-medium text-gray-900">{style.name}</h4>
        <p className="text-sm text-gray-600 mt-1">{style.description}</p>
        <div className="flex flex-wrap gap-1 mt-2">
          {style.characteristics.map((char: string, idx: number) => (
            <span key={idx} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
              {char}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Chat Settings</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>

          <div className="space-y-8">
            {/* AI Persona Selection */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Persona</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(AI_PERSONAS).map(([key, persona]) => 
                  renderPersonaCard(key, persona)
                )}
              </div>
            </div>

            {/* Conversation Style */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversation Style</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(CONVERSATION_STYLES).map(([key, style]) => 
                  renderConversationStyleCard(key, style)
                )}
              </div>
            </div>

            {/* Learning Modes */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Learning Modes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Zap className="w-5 h-5 text-blue-500" />
                      <span className="font-medium">Adaptive Mode</span>
                    </div>
                    <button
                      onClick={() => handleToggleChange('adaptiveMode')}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        localSettings.adaptiveMode ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        localSettings.adaptiveMode ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600">
                    AI adapts to your learning style and pace
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <BookOpen className="w-5 h-5 text-green-500" />
                      <span className="font-medium">Tutorial Mode</span>
                    </div>
                    <button
                      onClick={() => handleToggleChange('tutorialMode')}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        localSettings.tutorialMode ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        localSettings.tutorialMode ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600">
                    Provides step-by-step guidance and explanations
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Target className="w-5 h-5 text-purple-500" />
                      <span className="font-medium">Assessment Mode</span>
                    </div>
                    <button
                      onClick={() => handleToggleChange('assessmentMode')}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        localSettings.assessmentMode ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        localSettings.assessmentMode ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600">
                    Includes quizzes and knowledge checks
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <MessageCircle className="w-5 h-5 text-orange-500" />
                      <span className="font-medium">Proactive Hints</span>
                    </div>
                    <button
                      onClick={() => handleToggleChange('proactiveHints')}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        localSettings.proactiveHints ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                        localSettings.proactiveHints ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600">
                    AI provides helpful hints when you're struggling
                  </p>
                </div>
              </div>
            </div>

            {/* Encouragement Level */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Encouragement Level</h3>
              <div className="flex space-x-4">
                {(['minimal', 'moderate', 'high'] as const).map(level => (
                  <button
                    key={level}
                    onClick={() => handleEncouragementLevelChange(level)}
                    className={`px-4 py-2 rounded-lg capitalize transition-colors ${
                      localSettings.encouragementLevel === level
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced Settings */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Advanced Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">Difficulty Adjustment</span>
                    <p className="text-sm text-gray-600">
                      Automatically adjust difficulty based on performance
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleChange('difficultyAdjustment')}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      localSettings.difficultyAdjustment ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      localSettings.difficultyAdjustment ? 'translate-x-6' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">Context Awareness</span>
                    <p className="text-sm text-gray-600">
                      AI remembers previous conversations and learning progress
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleChange('contextAwareness')}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      localSettings.contextAwareness ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      localSettings.contextAwareness ? 'translate-x-6' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 mt-8 pt-6 border-t">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatSettings;