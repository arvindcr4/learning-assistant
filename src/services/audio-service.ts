import { StreamingResponse } from '../types';

export interface AudioConfig {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  format: 'mp3' | 'wav' | 'webm';
}

export interface VoiceSettings {
  voice: string;
  speed: number;
  pitch: number;
  volume: number;
}

export interface AudioTranscription {
  text: string;
  confidence: number;
  language: string;
  duration: number;
}

export interface AudioSynthesis {
  audioUrl: string;
  duration: number;
  text: string;
}

/**
 * Audio Service for handling voice interactions in the learning assistant
 * Provides speech-to-text, text-to-speech, and audio processing capabilities
 */
export class AudioService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private recordingStream: MediaStream | null = null;
  private isRecording = false;
  private audioChunks: Blob[] = [];

  // Default configurations
  private defaultAudioConfig: AudioConfig = {
    sampleRate: 44100,
    channels: 1,
    bitsPerSample: 16,
    format: 'webm'
  };

  private defaultVoiceSettings: VoiceSettings = {
    voice: 'alloy', // Default voice
    speed: 1.0,
    pitch: 1.0,
    volume: 1.0
  };

  constructor() {
    this.initializeAudioContext();
  }

  /**
   * Initialize Web Audio API context
   */
  private async initializeAudioContext(): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume context if suspended (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  }

  /**
   * Check if audio recording is supported in the current browser
   */
  public isRecordingSupported(): boolean {
    return !!(typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof window !== 'undefined' && window.MediaRecorder);
  }

  /**
   * Check if speech synthesis is supported in the current browser
   */
  public isSpeechSynthesisSupported(): boolean {
    return typeof window !== 'undefined' && !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
  }

  /**
   * Request microphone permission and initialize recording
   */
  public async requestMicrophonePermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: this.defaultAudioConfig.sampleRate,
          channelCount: this.defaultAudioConfig.channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Stop the stream immediately after permission check
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      return false;
    }
  }

  /**
   * Start audio recording
   */
  public async startRecording(): Promise<void> {
    if (!this.isRecordingSupported()) {
      throw new Error('Audio recording is not supported in this browser');
    }

    if (this.isRecording) {
      throw new Error('Recording is already in progress');
    }

    try {
      // Request microphone access
      this.recordingStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.defaultAudioConfig.sampleRate,
          channelCount: this.defaultAudioConfig.channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Create MediaRecorder
      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(this.recordingStream, {
        mimeType
      });

      // Clear previous audio chunks
      this.audioChunks = [];

      // Set up event handlers
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.isRecording = false;
        this.stopRecordingStream();
      };

      // Start recording
      this.mediaRecorder.start(100); // Collect data every 100ms
      this.isRecording = true;

    } catch (error) {
      console.error('Failed to start recording:', error);
      throw new Error('Failed to start audio recording');
    }
  }

  /**
   * Stop audio recording and return the recorded audio blob
   */
  public async stopRecording(): Promise<Blob> {
    if (!this.isRecording || !this.mediaRecorder) {
      throw new Error('No recording in progress');
    }

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('MediaRecorder not available'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        this.isRecording = false;
        this.stopRecordingStream();

        const mimeType = this.getSupportedMimeType();
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Stop the recording stream and release resources
   */
  private stopRecordingStream(): void {
    if (this.recordingStream) {
      this.recordingStream.getTracks().forEach(track => track.stop());
      this.recordingStream = null;
    }
  }

  /**
   * Get the best supported MIME type for recording
   */
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/wav'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm'; // Fallback
  }

  /**
   * Convert audio blob to base64 string
   */
  public async audioToBase64(audioBlob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        if (!result || typeof result !== 'string') {
          reject(new Error('Failed to read audio file'));
          return;
        }
        // Remove data URL prefix to get just the base64 content
        const base64 = result.split(',')[1];
        if (!base64) {
          reject(new Error('Invalid audio data format'));
          return;
        }
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });
  }

  /**
   * Transcribe audio using browser's Speech Recognition API (if available)
   * Note: This is a fallback - for production, you'd typically use a cloud service
   */
  public async transcribeAudio(audioBlob: Blob): Promise<AudioTranscription> {
    // For now, we'll use a simulated transcription
    // In a real implementation, you would send the audio to a transcription service
    return this.simulateTranscription(audioBlob);
  }

  /**
   * Simulate audio transcription (placeholder for actual transcription service)
   */
  private async simulateTranscription(audioBlob: Blob): Promise<AudioTranscription> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const duration = await this.getAudioDuration(audioBlob);

    // Return simulated transcription
    return {
      text: "This is a simulated transcription. In production, this would be replaced with actual speech-to-text service.",
      confidence: 0.9,
      language: 'en-US',
      duration
    };
  }

  /**
   * Get audio duration from blob
   */
  private async getAudioDuration(audioBlob: Blob): Promise<number> {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.onloadedmetadata = () => {
        resolve(audio.duration);
      };
      audio.onerror = () => {
        resolve(0); // Fallback duration
      };
      audio.src = audioBlob ? URL.createObjectURL(audioBlob) : '';
    });
  }

  /**
   * Convert text to speech using Web Speech API
   */
  public async textToSpeech(
    text: string, 
    settings: Partial<VoiceSettings> = {}
  ): Promise<AudioSynthesis> {
    if (!this.isSpeechSynthesisSupported()) {
      throw new Error('Speech synthesis is not supported in this browser');
    }

    const voiceSettings = { ...this.defaultVoiceSettings, ...settings };

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Configure voice settings
      const voices = speechSynthesis.getVoices();
      const selectedVoice = voices.find(voice => 
        voice.name.toLowerCase().includes(voiceSettings.voice.toLowerCase())
      ) || voices[0];

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.rate = voiceSettings.speed;
      utterance.pitch = voiceSettings.pitch;
      utterance.volume = voiceSettings.volume;

      utterance.onend = () => {
        resolve({
          audioUrl: '', // Web Speech API doesn't provide audio URL
          duration: text.length * 0.1, // Rough estimate
          text
        });
      };

      utterance.onerror = (error) => {
        reject(new Error(`Speech synthesis failed: ${error.error}`));
      };

      // Speak the text
      speechSynthesis.speak(utterance);
    });
  }

  /**
   * Get available voices for speech synthesis
   */
  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.isSpeechSynthesisSupported()) {
      return [];
    }

    return speechSynthesis.getVoices();
  }

  /**
   * Cancel current speech synthesis
   */
  public cancelSpeech(): void {
    if (this.isSpeechSynthesisSupported()) {
      speechSynthesis.cancel();
    }
  }

  /**
   * Process audio with real-time analysis
   */
  public async analyzeAudioRealTime(
    audioStream: MediaStream,
    onAnalysis: (analysis: AudioAnalysis) => void
  ): Promise<void> {
    if (!this.audioContext) {
      await this.initializeAudioContext();
    }

    if (!this.audioContext) {
      throw new Error('Audio context not available');
    }

    const source = this.audioContext.createMediaStreamSource(audioStream);
    const analyser = this.audioContext.createAnalyser();
    
    analyser.fftSize = 2048;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    source.connect(analyser);

    const analyze = () => {
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate volume level
      const volume = this.calculateVolume(dataArray);
      
      // Detect silence
      const isSilent = volume < 10;
      
      // Calculate frequency distribution
      const frequencies = this.analyzeFrequencies(dataArray);

      onAnalysis({
        volume,
        isSilent,
        frequencies,
        timestamp: Date.now()
      });

      requestAnimationFrame(analyze);
    };

    analyze();
  }

  /**
   * Calculate volume level from frequency data
   */
  private calculateVolume(dataArray: Uint8Array): number {
    if (!dataArray || dataArray.length === 0) {
      return 0;
    }
    
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i] || 0;
    }
    return sum / dataArray.length;
  }

  /**
   * Analyze frequency distribution
   */
  private analyzeFrequencies(dataArray: Uint8Array): FrequencyAnalysis {
    if (!dataArray || dataArray.length === 0) {
      return { low: 0, mid: 0, high: 0, dominant: 'mid' };
    }
    
    const length = dataArray.length;
    const lowEnd = Math.floor(length * 0.1);
    const midStart = Math.floor(length * 0.1);
    const midEnd = Math.floor(length * 0.8);
    const highStart = Math.floor(length * 0.8);

    let lowFreq = 0, midFreq = 0, highFreq = 0;

    for (let i = 0; i < lowEnd; i++) {
      lowFreq += dataArray[i] || 0;
    }
    for (let i = midStart; i < midEnd; i++) {
      midFreq += dataArray[i] || 0;
    }
    for (let i = highStart; i < length; i++) {
      highFreq += dataArray[i] || 0;
    }

    const lowCount = lowEnd || 1;
    const midCount = (midEnd - midStart) || 1;
    const highCount = (length - highStart) || 1;

    return {
      low: lowFreq / lowCount,
      mid: midFreq / midCount,
      high: highFreq / highCount,
      dominant: this.getDominantFrequency(dataArray)
    };
  }

  /**
   * Get dominant frequency range
   */
  private getDominantFrequency(dataArray: Uint8Array): 'low' | 'mid' | 'high' {
    const frequencies = this.analyzeFrequencies(dataArray);
    
    if (frequencies.low > frequencies.mid && frequencies.low > frequencies.high) {
      return 'low';
    } else if (frequencies.high > frequencies.mid && frequencies.high > frequencies.low) {
      return 'high';
    } else {
      return 'mid';
    }
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.isRecording) {
      this.stopRecording().catch(console.error);
    }

    this.stopRecordingStream();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.cancelSpeech();
  }

  /**
   * Check current recording status
   */
  public getRecordingStatus(): RecordingStatus {
    return {
      isRecording: this.isRecording,
      isSupported: this.isRecordingSupported(),
      hasPermission: !!this.recordingStream,
      duration: this.isRecording ? Date.now() : 0 // Simplified duration tracking
    };
  }
}

// Supporting interfaces
export interface AudioAnalysis {
  volume: number;
  isSilent: boolean;
  frequencies: FrequencyAnalysis;
  timestamp: number;
}

export interface FrequencyAnalysis {
  low: number;
  mid: number;
  high: number;
  dominant: 'low' | 'mid' | 'high';
}

export interface RecordingStatus {
  isRecording: boolean;
  isSupported: boolean;
  hasPermission: boolean;
  duration: number;
}

// Create singleton instance
export const audioService = new AudioService();
export default audioService;