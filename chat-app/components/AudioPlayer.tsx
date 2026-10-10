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
            const timer = setTimeout(() => setAudioUrl(url), 0);

            return () => {
                clearTimeout(timer);
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
            <div className="flex w-full max-w-sm items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-border/60 animate-pulse">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-muted">
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Loading voice note…</span>
            </div>
        );
    }

    return (
        <div
            className={cn(
                "flex w-full max-w-sm flex-col gap-2 rounded-2xl p-3 ring-1",
                isOwn ? "bg-primary text-primary-foreground ring-transparent" : "bg-card text-foreground ring-border/60 shadow-[0_6px_18px_-12px_rgba(60,40,20,0.45)]"
            )}
        >
            <audio ref={audioRef} src={audioUrl} preload="metadata" />

            <div className="flex items-center gap-3">
                <Button
                    onClick={togglePlay}
                    aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ember p-0 text-[#171412] shadow-[0_8px_20px_-8px_rgba(120,40,0,0.7)] transition-transform hover:scale-105 hover:bg-ember active:scale-95"
                >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
                </Button>

                {/* waveform doubles as the scrubber */}
                <div
                    ref={progressRef}
                    onClick={handleProgressClick}
                    className="flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-[2px]"
                    title={isOwn ? "Your voice message" : `${sender}'s voice message`}
                >
                    {[...Array(36)].map((_, i) => {
                        // a stable, natural-looking waveform derived from the audio data
                        const seed = i + audioData.charCodeAt(i % audioData.length);
                        const baseHeight = 30 + (Math.sin(seed * 0.1) * 40);
                        const height = Math.max(14, Math.min(100, baseHeight + ((seed * 37) % 30)));
                        const isPast = (i / 36) * 100 < progress;
                        return (
                            <span
                                key={i}
                                className={cn(
                                    "flex-1 rounded-full transition-colors duration-150",
                                    isPast ? "bg-ember" : isOwn ? "bg-primary-foreground/25" : "bg-foreground/20"
                                )}
                                style={{ height: `${height}%` }}
                            />
                        );
                    })}
                </div>
            </div>

            <div className={cn("flex justify-between px-1 font-mono text-[10px] tracking-[0.12em]", isOwn ? "text-primary-foreground/60" : "text-muted-foreground")}>
                <span>{formatTime(currentTime)}</span>
                <span className="uppercase">voice · {formatTime(duration)}</span>
            </div>
        </div>
    );
}
