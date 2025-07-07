'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquare, Search, Filter, Clock, User, Bot, ChevronRight, Trash2, Star, Archive } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

import { ChatSession, ChatMessage } from '../../../types';

interface ChatHistoryProps {
  userId: string;
  sessions: ChatSession[];
  onSessionSelect: (session: ChatSession) => void;
  onSessionDelete: (sessionId: string) => void;
  onSessionArchive: (sessionId: string) => void;
  currentSessionId?: string;
  className?: string;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({
  userId,
  sessions,
  onSessionSelect,
  onSessionDelete,
  onSessionArchive,
  currentSessionId,
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed' | 'archived'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'alphabetical'>('recent');
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  const filteredSessions = sessions
    .filter(session => {
      // Filter by search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          session.title.toLowerCase().includes(searchLower) ||
          session.description?.toLowerCase().includes(searchLower) ||
          session.messages.some(msg => msg.content.toLowerCase().includes(searchLower))
        );
      }
      return true;
    })
    .filter(session => {
      // Filter by status
      if (filterStatus === 'all') return true;
      return session.status === filterStatus;
    })
    .sort((a, b) => {
      // Sort sessions
      switch (sortBy) {
        case 'recent':
          return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

  const toggleSessionExpansion = (sessionId: string) => {
    const newExpanded = new Set(expandedSessions);
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
    } else {
      newExpanded.add(sessionId);
    }
    setExpandedSessions(newExpanded);
  };

  const getSessionPreview = (messages: ChatMessage[]): string => {
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
    return lastUserMessage?.content.substring(0, 100) + '...' || 'No messages yet';
  };

  const getSessionStats = (session: ChatSession) => {
    const userMessages = session.messages.filter(msg => msg.role === 'user').length;
    const assistantMessages = session.messages.filter(msg => msg.role === 'assistant').length;
    const totalTokens = session.totalTokens;
    const duration = session.updatedAt.getTime() - session.createdAt.getTime();
    const durationMinutes = Math.floor(duration / (1000 * 60));

    return {
      userMessages,
      assistantMessages,
      totalTokens,
      durationMinutes
    };
  };

  const renderSessionCard = (session: ChatSession) => {
    const isCurrentSession = session.id === currentSessionId;
    const isExpanded = expandedSessions.has(session.id);
    const stats = getSessionStats(session);
    
    return (
      <div
        key={session.id}
        className={`border rounded-lg p-4 transition-all ${
          isCurrentSession 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50'
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <h3 className="font-medium text-gray-900 truncate">{session.title}</h3>
              <div className={`px-2 py-1 text-xs rounded-full ${
                session.status === 'active' ? 'bg-green-100 text-green-800' :
                session.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                session.status === 'archived' ? 'bg-gray-100 text-gray-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {session.status}
              </div>
            </div>
            
            {session.description && (
              <p className="text-sm text-gray-600 mt-1">{session.description}</p>
            )}
            
            <p className="text-sm text-gray-500 mt-2">
              {getSessionPreview(session.messages)}
            </p>
            
            <div className="flex items-center space-x-4 mt-3 text-xs text-gray-500">
              <div className="flex items-center space-x-1">
                <Clock className="w-3 h-3" />
                <span>{formatDistanceToNow(session.lastMessageAt, { addSuffix: true })}</span>
              </div>
              <div className="flex items-center space-x-1">
                <User className="w-3 h-3" />
                <span>{stats.userMessages}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Bot className="w-3 h-3" />
                <span>{stats.assistantMessages}</span>
              </div>
              <div>
                <span>{stats.totalTokens} tokens</span>
              </div>
              <div>
                <span>{stats.durationMinutes}m</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={() => toggleSessionExpansion(session.id)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
            >
              <ChevronRight className={`w-4 h-4 transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`} />
            </button>
            
            <button
              onClick={() => onSessionArchive(session.id)}
              className="p-1 text-gray-400 hover:text-orange-600 rounded"
              title="Archive session"
            >
              <Archive className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => onSessionDelete(session.id)}
              className="p-1 text-gray-400 hover:text-red-600 rounded"
              title="Delete session"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {isExpanded && (
          <div className="mt-4 pt-4 border-t">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Created:</span>
                  <span className="ml-2 text-gray-600">
                    {format(session.createdAt, 'MMM d, yyyy HH:mm')}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Duration:</span>
                  <span className="ml-2 text-gray-600">{stats.durationMinutes} minutes</span>
                </div>
                <div>
                  <span className="font-medium">AI Persona:</span>
                  <span className="ml-2 text-gray-600">{session.settings.aiPersona.name}</span>
                </div>
                <div>
                  <span className="font-medium">Style:</span>
                  <span className="ml-2 text-gray-600 capitalize">
                    {session.settings.conversationStyle}
                  </span>
                </div>
              </div>
              
              {session.context.currentModule && (
                <div className="text-sm">
                  <span className="font-medium">Current Module:</span>
                  <span className="ml-2 text-gray-600">{session.context.currentModule}</span>
                </div>
              )}
              
              <div className="flex justify-between items-center pt-2">
                <div className="flex space-x-2">
                  {session.settings.adaptiveMode && (
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                      Adaptive
                    </span>
                  )}
                  {session.settings.tutorialMode && (
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                      Tutorial
                    </span>
                  )}
                  {session.settings.assessmentMode && (
                    <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                      Assessment
                    </span>
                  )}
                </div>
                
                <button
                  onClick={() => onSessionSelect(session)}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Open Session
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm ${className}`}>
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Chat History</h2>
        
        {/* Search and Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex space-x-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="recent">Most Recent</option>
              <option value="oldest">Oldest First</option>
              <option value="alphabetical">Alphabetical</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {searchTerm ? 'No conversations found matching your search' : 'No chat sessions yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSessions.map(session => renderSessionCard(session))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatHistory;