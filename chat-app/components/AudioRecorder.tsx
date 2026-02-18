"use client";

import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/basic';
import { Mic, Square, X, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioRecorderProps {
    onSend: (audioBlob: Blob) => void;
    onCancel: () => void;
    username: string;
}

export default function AudioRecorder({ onSend, onCancel, username }: AudioRecorderProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioURL, setAudioURL] = useState<string>('');
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        startRecording();
        return () => {
            cleanup();
        };
    }, []);

    const cleanup = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (audioURL) {
            URL.revokeObjectURL(audioURL);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
            });
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { 
                    type: mediaRecorder.mimeType 
                });
                setAudioBlob(blob);
                const url = URL.createObjectURL(blob);
                setAudioURL(url);
                
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);

            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Could not access microphone. Please check permissions.');
            onCancel();
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        }
    };

    const handleSend = () => {
        if (audioBlob) {
            onSend(audioBlob);
            cleanup();
        }
    };

    const handleCancel = () => {
        cleanup();
        onCancel();
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Voice Message</h3>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleCancel}
                        className="h-8 w-8"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="space-y-4">
                    {/* Recording Indicator */}
                    <div className="flex items-center justify-center space-x-3 py-6">
                        <div className={cn(
                            "w-4 h-4 rounded-full",
                            isRecording ? "bg-red-500 animate-pulse" : "bg-muted"
                        )} />
                        <span className="text-2xl font-mono tabular-nums">
                            {formatTime(recordingTime)}
                        </span>
                    </div>

                    {/* Waveform Animation */}
                    {isRecording && (
                        <div className="flex items-center justify-center space-x-1 h-16">
                            {[...Array(20)].map((_, i) => (
                                <div
                                    key={i}
                                    className="w-1 bg-primary rounded-full animate-pulse"
                                    style={{
                                        height: `${Math.random() * 100}%`,
                                        animationDelay: `${i * 0.1}s`,
                                        animationDuration: '0.5s'
                                    }}
                                />
                            ))}
                        </div>
                    )}

                    {/* Audio Preview */}
                    {!isRecording && audioURL && (
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground text-center">
                                Preview your voice message:
                            </p>
                            <audio 
                                src={audioURL} 
                                controls 
                                className="w-full"
                            />
                        </div>
                    )}

                    {/* Controls */}
                    <div className="flex space-x-2">
                        {isRecording ? (
                            <>
                                <Button
                                    onClick={handleCancel}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    <X className="mr-2 h-4 w-4" />
                                    Cancel
                                </Button>
                                <Button
                                    onClick={stopRecording}
                                    variant="default"
                                    className="flex-1"
                                >
                                    <Square className="mr-2 h-4 w-4" />
                                    Stop
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    onClick={handleCancel}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    <X className="mr-2 h-4 w-4" />
                                    Discard
                                </Button>
                                <Button
                                    onClick={handleSend}
                                    variant="default"
                                    className="flex-1"
                                    disabled={!audioBlob}
                                >
                                    <Send className="mr-2 h-4 w-4" />
                                    Send
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
