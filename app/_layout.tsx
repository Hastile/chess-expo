// app/_layout.tsx
import { createInitialState, INITIAL_PIECES, MoveState } from '@/scripts/Piece';
import {
    createAudioPlayer,
    setAudioModeAsync,
    type AudioPlayer,
} from 'expo-audio';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

const SOUND_SOURCES = {
    move: require('../assets/sfx/move.wav'),
    capture: require('../assets/sfx/capture.wav'),
    castling: require('../assets/sfx/castling.wav'),
    check: require('../assets/sfx/check.wav'),
    gameover: require('../assets/sfx/gameover.wav'),
} as const;
type SoundType = keyof typeof SOUND_SOURCES;


const DB_NAME = "chessDB.sqlite";

// Game context for sharing move and orientation state
export const GameContext = createContext<{
    moveState: MoveState;
    setMoveState: React.Dispatch<React.SetStateAction<MoveState>>;
    orientation: "white" | "black";
    setOrientation: React.Dispatch<React.SetStateAction<"white" | "black">>;
} | null>(null);

export const syncBridge = {
    updateLastModified: (_val: string | null) => { }
};

export default function RootLayout() {
    const [dbLoaded, setDbLoaded] = useState(false);
    const [dbKey, setDbKey] = useState(0);

    // Keep state here (above SQLiteProvider)
    const [moveState, setMoveState] = useState<MoveState>(() => createInitialState(INITIAL_PIECES));
    const [orientation, setOrientation] = useState<"white" | "black">("white");

    // useEffect(() => {
    //     console.log(`[FEN] ${moveState.fen}`);
    // }, [moveState.fen]); // debug FEN changes

    // Define sound players here to avoid remount side effects
    //  sound players (expo-audio)
    type SoundRef = ReturnType<typeof useRef<AudioPlayer | null>>;

    const movePlayer = useRef<AudioPlayer | null>(null);
    const capturePlayer = useRef<AudioPlayer | null>(null);
    const castlingPlayer = useRef<AudioPlayer | null>(null);
    const checkPlayer = useRef<AudioPlayer | null>(null);
    const gameoverPlayer = useRef<AudioPlayer | null>(null);

    const getSoundRef = (type: SoundType): SoundRef => {
        switch (type) {
            case 'move': return movePlayer;
            case 'capture': return capturePlayer;
            case 'castling': return castlingPlayer;
            case 'check': return checkPlayer;
            case 'gameover': return gameoverPlayer;
            default: return movePlayer;
        }
    };

    const loadSound = useCallback((ref: SoundRef, type: SoundType) => {
        if (ref.current) return;
        ref.current = createAudioPlayer(SOUND_SOURCES[type], { keepAudioSessionActive: false });
    }, []);

    useEffect(() => {
        setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: false,
            interruptionMode: 'duckOthers',
        }).catch(console.error);

        loadSound(movePlayer, 'move');
        loadSound(capturePlayer, 'capture');
        loadSound(castlingPlayer, 'castling');
        loadSound(checkPlayer, 'check');
        loadSound(gameoverPlayer, 'gameover');

        return () => {
            [movePlayer, capturePlayer, castlingPlayer, checkPlayer, gameoverPlayer].forEach(async (ref) => {
                if (ref.current) {
                    ref.current.remove();
                    ref.current = null;
                }
            });
        };
    }, [loadSound]);

    const playSound = useCallback(async (type: SoundType) => {
        const ref = getSoundRef(type);
        try {
            if (!ref.current) {
                loadSound(ref, type);
            }
            const player = ref.current;
            if (!player) return;
            await player.seekTo(0);
            player.play();
        } catch (e) {
            // reload once if playback failed (e.g., released)
            // try {
            //     ref.current = null;
            //     loadSound(ref, type);
            //     const player = ref.current;
            //     if (player) {
            //         await player.seekTo(0);
            //         player.play();
            //     }
            // } catch (err) {
            //     console.warn('Sound play error:', err);
            // }
            console.warn('Sound play error:', e);
        }
    }, [getSoundRef, loadSound]);

    const prevCount = useRef(0);
    useEffect(() => {
        const currentCount = moveState.moveHistory.length;

        if (currentCount > prevCount.current) {
            const lastMove = moveState.moveHistory[currentCount - 1];
            const san = lastMove.san;

            // console.log(`[Chess] Last Move SAN: "${san}"`); // debug last move

            // 1. Checkmate
            if (san.includes('#')) {
                playSound('gameover');
            }
            // 2. Check
            else if (san.includes('+')) {
                playSound('check');
            }
            // 3. Castling
            else if (san.includes('O-O')) {
                playSound('castling');
            }
            // 4. Capture
            else if (san.includes('x')) {
                playSound('capture');
            }
            // 5. Normal move
            else {
                playSound('move');
            }
        }
        prevCount.current = currentCount;
    }, [moveState.moveHistory.length, playSound]); // keep playSound stable

    const syncDatabase = useCallback(async () => {
        const docDir = FileSystem.documentDirectory;
        if (!docDir) {
            setDbLoaded(true);
            return;
        }
        const dbPath = `${docDir}SQLite/${DB_NAME}`;
        const dbDir = `${docDir}SQLite`;

        try {
            const asset: any = await Asset.fromModule(require('../assets/chessDB.sqlite')).downloadAsync();
            if (asset.localUri) {
                await FileSystem.makeDirectoryAsync(dbDir, { intermediates: true }).catch(() => { });
                await FileSystem.deleteAsync(dbPath, { idempotent: true }).catch(() => { });
                await FileSystem.copyAsync({ from: asset.localUri, to: dbPath });
            }
        } catch (e) {
            console.log('DB 로드 오류:', e);
        }
        setDbLoaded(true);
    }, []);

    useEffect(() => {
        syncDatabase();
    }, [syncDatabase]);

    if (!dbLoaded) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0B0F14' }}>
                <ActivityIndicator size="large" color="#91b045" />
                <Text style={{ color: '#E7EDF5', marginTop: 10 }}>DB 불러오는 중...</Text>
            </View>
        );
    }

    return (
        // GameContext.Provider must be above SQLiteProvider
        <GameContext.Provider value={{ moveState, setMoveState, orientation, setOrientation }}>
            <SQLiteProvider
                key={dbKey}
                databaseName={DB_NAME}
                assetSource={{ assetId: require('../assets/chessDB.sqlite') }}
            >
                <Stack>
                    <Stack.Screen name="index" options={{ headerShown: false }} />
                </Stack>
            </SQLiteProvider>
        </GameContext.Provider>
    );
}
