import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AudioManager,
  AudioRecorder,
} from 'react-native-audio-api';
import {
  AUDIO_CHANNELS,
  AUDIO_SAMPLE_RATE,
  VAD_ENERGY_THRESHOLD,
  VOICE_WS_URL,
} from '../config';
import type { MicState } from '../components/MicButton';
import { computeRms, floatToPcm16, pcm16ToBase64 } from '../voice/pcm';
import type { ServerMessage, TurnPhase } from '../voice/protocol';
import { getAccessToken } from '../services/auth';
import { newNoteId } from '../services/notesApi';
import { DONNA_THINKING_PHASE } from '../lib/thinkingPhrases';
import { voiceErrorMessage } from '../voice/voiceErrors';
import { VoiceClient } from '../voice/voiceClient';

type VoiceStatus = {
  transcript: string | null;
  phase: TurnPhase | null;
};

const BUSY_PHASES: TurnPhase[] = ['busy', 'transcribing'];

export type VoiceSessionMode = 'talk' | 'notes';

export type UseVoiceSessionOptions = {
  /** talk = dictation into chat; notes = create a voice note. Default talk. */
  mode?: VoiceSessionMode;
  /** Called with STT text so the shared text chat harness can send it. */
  onTranscript?: (text: string) => void;
  /** Called after notes-mode successfully saves a dictated note. */
  onNoteCreated?: (info: {
    noteId: string | null;
    transcript: string;
  }) => void;
};

function formatStartSessionError(message: string): string {
  if (message === 'Session setup timed out') {
    if (__DEV__) {
      return (
        'Donna server connected but did not respond. ' +
        'For local dev, run npm run dev:server. ' +
        'On a physical iPhone, use the same Wi‑Fi as your Mac and restart Metro (npm start).'
      );
    }
    return 'Donna could not start listening. Please try again in a moment.';
  }
  if (message.startsWith('Cannot reach Donna server')) {
    return message;
  }
  if (message.startsWith('Voice socket closed before connect')) {
    return message;
  }
  return message || "Couldn't start listening. Please try again.";
}

export function useVoiceSession(options: UseVoiceSessionOptions = {}) {
  const mode = options.mode ?? 'talk';
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const onTranscriptRef = useRef(options.onTranscript);
  onTranscriptRef.current = options.onTranscript;
  const onNoteCreatedRef = useRef(options.onNoteCreated);
  onNoteCreatedRef.current = options.onNoteCreated;

  const [state, setState] = useState<MicState>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [status, setStatus] = useState<VoiceStatus>({
    transcript: null,
    phase: null,
  });
  const transcriptRef = useRef<string | null>(null);

  const clientRef = useRef<VoiceClient | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const chunkSeqRef = useRef(0);
  const sessionReadyRef = useRef(false);
  const activeRef = useRef(false);
  /** When true, mic PCM is streamed to the server for the current utterance. */
  const captureEnabledRef = useRef(false);
  /** True once this utterance had energy above the speech threshold. */
  const hadSpeechRef = useRef(false);
  const readyResolverRef = useRef<(() => void) | null>(null);
  const rejectReadyRef = useRef<((err: Error) => void) | null>(null);
  const messageChainRef = useRef(Promise.resolve());
  const stopSessionRef = useRef<() => Promise<void>>(async () => {});

  const stopRecorder = useCallback(() => {
    activeRef.current = false;
    captureEnabledRef.current = false;
    hadSpeechRef.current = false;
    sessionReadyRef.current = false;
    readyResolverRef.current = null;
    chunkSeqRef.current = 0;
    transcriptRef.current = null;
    messageChainRef.current = Promise.resolve();
    recorderRef.current?.stop();
  }, []);

  const setVoiceError = useCallback(
    (message: string) => {
      stopRecorder();
      if (clientRef.current?.isConnected) {
        try {
          clientRef.current.disconnect();
        } catch {
          // socket may already be closing
        }
      }
      setState('error');
      setErrorMsg(message);
    },
    [stopRecorder],
  );

  const handleServerMessage = useCallback(
    async (message: ServerMessage) => {
      switch (message.type) {
        case 'session.ready':
          sessionReadyRef.current = true;
          readyResolverRef.current?.();
          readyResolverRef.current = null;
          break;
        case 'turn.phase':
          setStatus(prev => ({ ...prev, phase: message.phase }));
          if (BUSY_PHASES.includes(message.phase)) {
            captureEnabledRef.current = false;
            setState('processing');
          }
          break;
        case 'turn.transcript':
          transcriptRef.current = message.text;
          setStatus(prev => ({ ...prev, transcript: message.text }));
          break;
        case 'turn.done': {
          const transcript = transcriptRef.current?.trim() ?? '';
          const noteId =
            typeof message.noteId === 'string' && message.noteId.trim()
              ? message.noteId.trim()
              : null;
          transcriptRef.current = null;
          await stopSessionRef.current();
          if (!message.skipped && transcript) {
            if (modeRef.current === 'notes') {
              onNoteCreatedRef.current?.({ noteId, transcript });
            } else {
              onTranscriptRef.current?.(transcript);
            }
          }
          break;
        }
        case 'error':
          console.warn('[donna-app] voice error', message.code, message.message);
          if (message.code === 'empty_audio') {
            await stopSessionRef.current();
            break;
          }
          setVoiceError(voiceErrorMessage(message.code, message.message));
          break;
        default:
          break;
      }
    },
    [setVoiceError],
  );

  const ensureClient = useCallback(() => {
    if (!clientRef.current) {
      const client = new VoiceClient(VOICE_WS_URL);
      client.setHandlers({
        onMessage: message => {
          messageChainRef.current = messageChainRef.current
            .then(() => handleServerMessage(message))
            .catch(() => {});
        },
        onError: message => {
          if (rejectReadyRef.current) {
            rejectReadyRef.current(new Error(message));
            return;
          }
          setVoiceError(message);
        },
        onClose: () => {
          sessionReadyRef.current = false;
          if (rejectReadyRef.current) {
            rejectReadyRef.current(
              new Error(
                'Lost connection to Donna server before the voice session started.',
              ),
            );
            return;
          }
          if (activeRef.current) {
            setVoiceError('Disconnected from Donna server');
          }
        },
      });
      clientRef.current = client;
    }
    return clientRef.current;
  }, [handleServerMessage, setVoiceError]);

  const ensureRecorder = useCallback(() => {
    if (!recorderRef.current) {
      recorderRef.current = new AudioRecorder();
      recorderRef.current.onAudioReady(
        {
          sampleRate: AUDIO_SAMPLE_RATE,
          bufferLength: AUDIO_SAMPLE_RATE * 0.1,
          channelCount: AUDIO_CHANNELS,
        },
        ({ buffer }) => {
          if (!activeRef.current || !sessionReadyRef.current) return;
          if (!captureEnabledRef.current) return;
          if (!clientRef.current?.isConnected) return;

          const channel = buffer.getChannelData(0);
          if (
            !hadSpeechRef.current &&
            computeRms(channel) >= VAD_ENERGY_THRESHOLD
          ) {
            hadSpeechRef.current = true;
          }

          const pcm = floatToPcm16(channel);
          const seq = chunkSeqRef.current++;
          clientRef.current.send({
            type: 'audio.chunk',
            seq,
            format: 'pcm16',
            sampleRate: AUDIO_SAMPLE_RATE,
            channels: AUDIO_CHANNELS,
            data: pcm16ToBase64(pcm),
          });
        },
      );
    }
    return recorderRef.current;
  }, []);

  const stopSession = useCallback(async () => {
    stopRecorder();

    if (clientRef.current?.isConnected) {
      try {
        clientRef.current.send({ type: 'session.end' });
      } catch {
        // socket may already be closing
      }
      clientRef.current.disconnect();
    }

    setState('idle');
    setStatus({ transcript: null, phase: null });
  }, [stopRecorder]);
  stopSessionRef.current = stopSession;

  /** User explicitly finished speaking — commit buffered audio as a turn. */
  const endTurn = useCallback(() => {
    if (!activeRef.current || !clientRef.current?.isConnected) {
      void stopSession();
      return;
    }

    captureEnabledRef.current = false;

    // Tap with no speech = leave voice mode (don't send an empty/silent turn).
    if (chunkSeqRef.current === 0 || !hadSpeechRef.current) {
      void stopSession();
      return;
    }

    setState('processing');
    try {
      clientRef.current.send({ type: 'turn.end' });
    } catch {
      void stopSession();
    }
  }, [stopSession]);

  const startSession = useCallback(async () => {
    setState('requesting');
    setErrorMsg(null);
    setStatus({ transcript: null, phase: null });
    sessionReadyRef.current = false;

    AudioManager.setAudioSessionOptions({
      iosCategory: 'playAndRecord',
      iosMode: 'default',
      iosOptions: ['defaultToSpeaker'],
    });

    const permissions = await AudioManager.requestRecordingPermissions();
    if (permissions !== 'Granted') {
      setVoiceError('Microphone permission denied');
      return;
    }

    const sessionActive = await AudioManager.setAudioSessionActivity(true);
    if (!sessionActive) {
      setVoiceError('Could not activate audio session');
      return;
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setVoiceError('Not signed in. Please sign in to continue.');
      return;
    }

    const client = ensureClient();

    try {
      await client.connect(accessToken);

      const readyPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          readyResolverRef.current = null;
          rejectReadyRef.current = null;
          reject(new Error('Session setup timed out'));
        }, 8_000);
        readyResolverRef.current = () => {
          clearTimeout(timeout);
          rejectReadyRef.current = null;
          resolve();
        };
        rejectReadyRef.current = err => {
          clearTimeout(timeout);
          readyResolverRef.current = null;
          rejectReadyRef.current = null;
          reject(err);
        };
      });

      const startMode = modeRef.current;
      client.send({
        type: 'session.start',
        mode: startMode,
        ...(startMode === 'notes' ? { clientNoteId: newNoteId() } : {}),
      });
      await readyPromise;

      activeRef.current = true;
      chunkSeqRef.current = 0;
      hadSpeechRef.current = false;
      captureEnabledRef.current = true;

      const recorder = ensureRecorder();
      const result = recorder.start();
      if (result.status === 'error') {
        activeRef.current = false;
        captureEnabledRef.current = false;
        setVoiceError(result.message ?? 'Failed to start recording');
        return;
      }

      setState('listening');
    } catch (err) {
      stopRecorder();
      rejectReadyRef.current = null;
      if (client.isConnected) {
        client.disconnect();
      }
      const message =
        err instanceof Error
          ? err.message
          : "Couldn't start listening. Please try again.";
      setVoiceError(formatStartSessionError(message));
    }
  }, [ensureClient, ensureRecorder, setVoiceError, stopRecorder]);

  const toggleTalk = useCallback(async () => {
    if (state === 'listening') {
      endTurn();
      return;
    }
    if (state === 'processing') {
      await stopSession();
      return;
    }
    if (state === 'requesting') return;
    await startSession();
  }, [endTurn, startSession, state, stopSession]);

  useEffect(() => {
    return () => {
      void stopSession();
    };
  }, [stopSession]);

  const processingLabel =
    mode === 'notes' ? 'Saving note…' : DONNA_THINKING_PHASE;

  const phaseLabel = state === 'processing' ? processingLabel : null;

  const sessionLabel =
    state === 'error'
      ? (errorMsg ?? 'Something went wrong')
      : state === 'requesting'
        ? 'Starting…'
        : state === 'listening'
          ? 'Listening — tap when done'
          : state === 'processing'
            ? processingLabel
            : null;

  return {
    state,
    toggleTalk,
    transcript: status.transcript,
    phaseLabel,
    sessionLabel,
    errorMsg: state === 'error' ? (errorMsg ?? 'Something went wrong') : null,
    disabled: state === 'requesting',
    sessionActive: state === 'listening' || state === 'processing',
  };
}
