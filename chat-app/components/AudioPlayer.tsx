"use client";

import { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
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

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    if (!audioUrl) {
        return (
            <div className={cn(
                "flex items-center space-x-3 p-3 rounded-lg max-w-xs",
                isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
            )}>
                <div className="text-sm">Loading audio...</div>
            </div>
        );
    }

    return (
        <div className={cn(
            "flex items-center space-x-3 p-3 rounded-lg max-w-xs",
            isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
        )}>
            <audio ref={audioRef} src={audioUrl} preload="metadata" />
            
            {/* Play/Pause Button */}
            <Button
                variant="ghost"
                size="icon"
                onClick={togglePlay}
                className={cn(
                    "h-10 w-10 rounded-full flex-shrink-0",
                    isOwn ? "hover:bg-primary-foreground/20" : "hover:bg-background"
                )}
            >
                {isPlaying ? (
                    <Pause className="h-5 w-5" />
                ) : (
                    <Play className="h-5 w-5" />
                )}
            </Button>

            {/* Waveform/Progress */}
            <div className="flex-1 space-y-1">
                <div className="relative h-8 flex items-center">
                    {/* Visual waveform bars */}
                    <div className="flex items-center space-x-0.5 h-full w-full">
                        {[...Array(30)].map((_, i) => {
                            const height = 20 + Math.random() * 80;
                            const isPast = (i / 30) * 100 < progress;
                            return (
                                <div
                                    key={i}
                                    className={cn(
                                        "flex-1 rounded-full transition-all",
                                        isOwn 
                                            ? isPast ? "bg-primary-foreground" : "bg-primary-foreground/30"
                                            : isPast ? "bg-primary" : "bg-muted-foreground/30"
                                    )}
                                    style={{ height: `${height}%` }}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Time Display */}
                <div className={cn(
                    "text-xs flex justify-between",
                    isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                )}>
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>
        </div>
    );
}
