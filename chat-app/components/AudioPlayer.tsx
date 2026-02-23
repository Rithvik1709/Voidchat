"use client";

import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { Button } from './ui/basic';
import { cn } from '@/lib/utils';

interface AudioPlayerProps {
    audioData: string; // base64 encoded audio data
    sender: string;
    timestamp: string;
    isOwn?: boolean;
}

export default function AudioPlayer({ audioData, sender, timestamp, isOwn }: AudioPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [audioUrl, setAudioUrl] = useState<string>('');
    const [isDragging, setIsDragging] = useState(false);
    const progressRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Convert base64 to blob URL
        try {
            const byteCharacters = atob(audioData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);

            return () => {
                URL.revokeObjectURL(url);
            };
        } catch (error) {
            console.error('Error creating audio URL:', error);
        }
    }, [audioData]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateTime = () => setCurrentTime(audio.currentTime);
        const updateDuration = () => setDuration(audio.duration);
        const handleEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
        };

        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [audioUrl]);

    const togglePlay = async () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            try {
                await audioRef.current.play();
                setIsPlaying(true);
            } catch (error) {
                console.error('Error playing audio:', error);
            }
        }
    };

    const formatTime = (seconds: number) => {
        if (!isFinite(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current || !progressRef.current) return;
        const rect = progressRef.current.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audioRef.current.currentTime = percent * duration;
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    if (!audioUrl) {
        return (
            <div className={cn(
                "flex items-center justify-center gap-3 p-4 rounded-2xl max-w-sm w-full animate-pulse",
                isOwn ? "bg-gradient-to-br from-blue-500/20 to-blue-600/20" : "bg-gradient-to-br from-slate-500/10 to-slate-600/10"
            )}>
                <Volume2 className={cn("h-5 w-5", isOwn ? "text-blue-500" : "text-slate-500")} />
                <div className={cn("text-sm font-medium", isOwn ? "text-blue-600" : "text-slate-600")}>Loading audio...</div>
            </div>
        );
    }

    return (
        <div className={cn(
            "flex flex-col gap-4 p-5 rounded-2xl max-w-sm w-full border-2 shadow-lg backdrop-blur-sm",
            isOwn 
                ? "bg-gradient-to-br from-blue-500/10 to-blue-600/10 border-blue-300/40"
                : "bg-gradient-to-br from-slate-500/5 to-slate-600/5 border-slate-300/30"
        )}>
            <audio ref={audioRef} src={audioUrl} preload="metadata" />
            
            {/* Header with icon and sender info */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "p-2.5 rounded-full",
                        isOwn ? "bg-blue-500" : "bg-slate-400"
                    )}>
                        <Volume2 className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <span className={cn(
                            "text-xs font-bold",
                            isOwn ? "text-blue-700" : "text-slate-700"
                        )}>
                            {isOwn ? 'Your Voice Message' : `${sender}'s Voice Message`}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatTime(duration)}</span>
                    </div>
                </div>
            </div>

            {/* Play/Pause Button */}
            <Button
                onClick={togglePlay}
                className={cn(
                    "w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2",
                    isOwn 
                        ? "bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg"
                        : "bg-slate-400 hover:bg-slate-500 text-white shadow-md hover:shadow-lg"
                )}
            >
                {isPlaying ? (
                    <>
                        <Pause className="h-5 w-5" />
                        <span>Playing...</span>
                    </>
                ) : (
                    <>
                        <Play className="h-5 w-5 ml-1" />
                        <span>Play</span>
                    </>
                )}
            </Button>

            {/* Progress Bar */}
            <div className="flex flex-col gap-2">
                <div
                    ref={progressRef}
                    onClick={handleProgressClick}
                    className={cn(
                        "relative h-2 rounded-full cursor-pointer group",
                        isOwn ? "bg-blue-200/50" : "bg-slate-300/50"
                    )}
                >
                    {/* Filled progress */}
                    <div
                        className={cn(
                            "h-full rounded-full transition-all",
                            isOwn ? "bg-blue-500" : "bg-slate-500"
                        )}
                        style={{ width: `${progress}%` }}
                    />
                    
                    {/* Draggable thumb */}
                    <div
                        className={cn(
                            "absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity",
                            isOwn ? "bg-blue-600" : "bg-slate-600"
                        )}
                        style={{ left: `${progress}%`, transform: 'translateY(-50%) translateX(-50%)' }}
                    />
                </div>

                {/* Time Display */}
                <div className={cn(
                    "text-xs font-medium flex justify-between px-1",
                    isOwn ? "text-blue-600" : "text-slate-600"
                )}>
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>

            {/* Waveform visualization */}
            <div className="flex items-center justify-between gap-0.5 h-8 px-1">
                {[...Array(40)].map((_, i) => {
                    // Create a more natural-looking waveform pattern
                    const seed = i + audioData.charCodeAt(i % audioData.length);
                    const baseHeight = 30 + (Math.sin(seed * 0.1) * 40);
                    const height = Math.max(10, Math.min(100, baseHeight + Math.random() * 30));
                    const isPast = (i / 40) * 100 < progress;
                    
                    return (
                        <div
                            key={i}
                            className={cn(
                                "flex-1 rounded-sm transition-all duration-100",
                                isOwn 
                                    ? isPast ? "bg-blue-500" : "bg-blue-300/40"
                                    : isPast ? "bg-slate-500" : "bg-slate-400/40"
                            )}
                            style={{ height: `${height}%` }}
                            title={`${formatTime((i / 40) * duration)}`}
                        />
                    );
                })}
            </div>
        </div>
    );
}
