import React from 'react';
import { cn } from '@/utils';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { Badge } from '@/components/ui/Badge';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Settings,
  SkipBack,
  SkipForward,
  RotateCcw,
  Bookmark,
  MessageSquare,
  Clock
} from 'lucide-react';

export interface VideoPlayerProps extends React.HTMLAttributes<HTMLDivElement> {
  src: string;
  title?: string;
  description?: string;
  duration?: number;
  transcript?: string;
  captions?: boolean;
  autoPlay?: boolean;
  onProgress?: (currentTime: number, duration: number) => void;
  onComplete?: () => void;
  onBookmark?: (timestamp: number) => void;
  bookmarks?: Array<{ timestamp: number; label: string; }>;
  learningObjectives?: string[];
  interactive?: boolean;
  quizPoints?: Array<{ timestamp: number; question: string; }>;
}

const VideoPlayer = React.forwardRef<HTMLDivElement, VideoPlayerProps>(
  ({ 
    className, 
    src, 
    title, 
    description, 
    duration = 0,
    transcript,
    captions = true,
    autoPlay = false,
    onProgress,
    onComplete,
    onBookmark,
    bookmarks = [],
    learningObjectives = [],
    interactive = false,
    quizPoints = [],
    ...props 
  }, ref) => {
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [currentTime, setCurrentTime] = React.useState(0);
    const [videoDuration, setVideoDuration] = React.useState(duration);
    const [volume, setVolume] = React.useState(1);
    const [isMuted, setIsMuted] = React.useState(false);
    const [isFullscreen, setIsFullscreen] = React.useState(false);
    const [showTranscript, setShowTranscript] = React.useState(false);
    const [playbackRate, setPlaybackRate] = React.useState(1);

    const formatTime = (time: number) => {
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const handlePlayPause = () => {
      if (videoRef.current) {
        if (isPlaying) {
          videoRef.current.pause();
        } else {
          videoRef.current.play();
        }
        setIsPlaying(!isPlaying);
      }
    };

    const handleTimeUpdate = () => {
      if (videoRef.current) {
        const current = videoRef.current.currentTime;
        const total = videoRef.current.duration;
        setCurrentTime(current);
        onProgress?.(current, total);

        // Check for quiz points
        if (interactive) {
          const activeQuizPoint = quizPoints.find(
            point => Math.abs(point.timestamp - current) < 1
          );
          if (activeQuizPoint) {
            videoRef.current.pause();
            setIsPlaying(false);
            // Trigger quiz modal (would be handled by parent component)
          }
        }
      }
    };

    const handleLoadedMetadata = () => {
      if (videoRef.current) {
        setVideoDuration(videoRef.current.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onComplete?.();
    };

    const handleSeek = (percentage: number) => {
      if (videoRef.current) {
        const newTime = (percentage / 100) * videoDuration;
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      }
    };

    const handleVolumeChange = (newVolume: number) => {
      if (videoRef.current) {
        videoRef.current.volume = newVolume;
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
      }
    };

    const toggleMute = () => {
      if (videoRef.current) {
        const newMuted = !isMuted;
        videoRef.current.muted = newMuted;
        setIsMuted(newMuted);
      }
    };

    const skip = (seconds: number) => {
      if (videoRef.current) {
        const newTime = Math.max(0, Math.min(videoDuration, currentTime + seconds));
        videoRef.current.currentTime = newTime;
        setCurrentTime(newTime);
      }
    };

    const toggleFullscreen = () => {
      // Fullscreen implementation would go here
      setIsFullscreen(!isFullscreen);
    };

    const addBookmark = () => {
      onBookmark?.(currentTime);
    };

    const jumpToBookmark = (timestamp: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = timestamp;
        setCurrentTime(timestamp);
      }
    };

    const changePlaybackRate = (rate: number) => {
      if (videoRef.current) {
        videoRef.current.playbackRate = rate;
        setPlaybackRate(rate);
      }
    };

    return (
      <Card ref={ref} className={cn("w-full overflow-hidden", className)} {...props}>
        {/* Video Header */}
        {title && (
          <div className="p-4 border-b">
            <h3 className="font-semibold text-lg">{title}</h3>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
            {learningObjectives.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {learningObjectives.map((objective, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {objective}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        <CardContent className="p-0">
          {/* Video Container */}
          <div className="relative bg-black">
            <video
              ref={videoRef}
              src={src}
              className="w-full aspect-video"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
              autoPlay={autoPlay}
              playsInline
            />

            {/* Video Overlay Controls */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 hover:opacity-100 transition-opacity">
              <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
                {/* Progress Bar */}
                <div className="space-y-2">
                  <Progress
                    value={(currentTime / videoDuration) * 100}
                    max={100}
                    variant="learning"
                    size="sm"
                    className="cursor-pointer"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const percentage = ((e.clientX - rect.left) / rect.width) * 100;
                      handleSeek(percentage);
                    }}
                  />
                  
                  {/* Bookmarks on progress bar */}
                  {bookmarks.map((bookmark, index) => (
                    <div
                      key={index}
                      className="absolute w-2 h-2 bg-learning-accent rounded-full cursor-pointer"
                      style={{ left: `${(bookmark.timestamp / videoDuration) * 100}%` }}
                      onClick={() => jumpToBookmark(bookmark.timestamp)}
                      title={bookmark.label}
                    />
                  ))}
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePlayPause}
                      className="text-white hover:bg-white/20"
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => skip(-10)}
                      className="text-white hover:bg-white/20"
                    >
                      <SkipBack className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => skip(10)}
                      className="text-white hover:bg-white/20"
                    >
                      <SkipForward className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleMute}
                        className="text-white hover:bg-white/20"
                      >
                        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                      </Button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={isMuted ? 0 : volume}
                        onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                        className="w-16 h-1 bg-white/30 rounded-lg appearance-none"
                      />
                    </div>

                    <span className="text-sm">
                      {formatTime(currentTime)} / {formatTime(videoDuration)}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={addBookmark}
                      className="text-white hover:bg-white/20"
                    >
                      <Bookmark className="h-4 w-4" />
                    </Button>

                    <select
                      value={playbackRate}
                      onChange={(e) => changePlaybackRate(parseFloat(e.target.value))}
                      className="bg-transparent text-white text-sm border border-white/30 rounded px-2 py-1"
                    >
                      <option value={0.5} className="text-black">0.5x</option>
                      <option value={0.75} className="text-black">0.75x</option>
                      <option value={1} className="text-black">1x</option>
                      <option value={1.25} className="text-black">1.25x</option>
                      <option value={1.5} className="text-black">1.5x</option>
                      <option value={2} className="text-black">2x</option>
                    </select>

                    {transcript && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowTranscript(!showTranscript)}
                        className="text-white hover:bg-white/20"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleFullscreen}
                      className="text-white hover:bg-white/20"
                    >
                      <Maximize className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bookmarks List */}
          {bookmarks.length > 0 && (
            <div className="p-4 border-t bg-muted/20">
              <h4 className="text-sm font-medium mb-2">Bookmarks</h4>
              <div className="space-y-1">
                {bookmarks.map((bookmark, index) => (
                  <button
                    key={index}
                    onClick={() => jumpToBookmark(bookmark.timestamp)}
                    className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Clock className="h-3 w-3" />
                    <span>{formatTime(bookmark.timestamp)}</span>
                    <span>-</span>
                    <span>{bookmark.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Transcript */}
          {showTranscript && transcript && (
            <div className="p-4 border-t max-h-48 overflow-y-auto">
              <h4 className="text-sm font-medium mb-2">Transcript</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {transcript}
              </p>
            </div>
          )}

          {/* Interactive Elements */}
          {interactive && quizPoints.length > 0 && (
            <div className="p-4 border-t bg-learning-primary/5">
              <h4 className="text-sm font-medium mb-2 flex items-center space-x-2">
                <span>Interactive Elements</span>
                <Badge variant="info" className="text-xs">
                  {quizPoints.length} quiz points
                </Badge>
              </h4>
              <p className="text-xs text-muted-foreground">
                This video contains interactive questions that will pause playback for assessment.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';

export { VideoPlayer };