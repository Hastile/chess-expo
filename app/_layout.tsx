// app/_layout.tsx
import { createInitialState, INITIAL_PIECES, MoveState } from '@/scripts/Piece';
import { Asset } from 'expo-asset';
import {
    createAudioPlayer,
    setAudioModeAsync,
    type AudioPlayer,
} from 'expo-audio';
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


const PC_IP = "221.162.44.120";
const DB_NAME = "chessDB.sqlite";
const SERVER_URL = `http://${PC_IP}:8000/assets/${DB_NAME}`;

// ✅ 게임 상태를 유지하기 위한 컨텍스트 생성
export const GameContext = createContext<{
    moveState: MoveState;
    setMoveState: React.Dispatch<React.SetStateAction<MoveState>>;
    orientation: "white" | "black";
    setOrientation: React.Dispatch<React.SetStateAction<"white" | "black">>;
} | null>(null);

export const syncBridge = {
    updateLastModified: (val: string | null) => { }
};

export default function RootLayout() {
    const [dbLoaded, setDbLoaded] = useState(false);
    const [dbKey, setDbKey] = useState(0);
    const lastModifiedRef = useRef<string | null>(null);

    // ✅ 상태를 여기서 관리 (SQLiteProvider 위에 위치)
    const [moveState, setMoveState] = useState<MoveState>(() => createInitialState(INITIAL_PIECES));
    const [orientation, setOrientation] = useState<"white" | "black">("white");

    // useEffect(() => {
    //     console.log(`[FEN] ${moveState.fen}`);
    // }, [moveState.fen]); // FEN이 변경될 때마다 실행됨

    // ✅ 브릿지 함수 연결
    syncBridge.updateLastModified = (val) => {
        lastModifiedRef.current = val;
    };

    // ✅ 소리 플레이어를 여기에 정의하여 리마운트 영향 안 받게 함
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

            // console.log(`[Chess] Last Move SAN: "${san}"`); // ✅ 생성된 기보 확인 로그

            // 1. 우선순위: 게임 종료 (메이트)
            if (san.includes('#')) {
                playSound('gameover');
            }
            // 2. 체크
            else if (san.includes('+')) {
                playSound('check');
            }
            // 3. 캐슬링
            else if (san.includes('O-O')) {
                playSound('castling');
            }
            // 4. 기물 잡기
            else if (san.includes('x')) {
                playSound('capture');
            }
            // 5. 일반 이동
            else {
                playSound('move');
            }
        }
        prevCount.current = currentCount;
    }, [moveState.moveHistory.length, playSound]); // ✅ playSound 의존성 추가

    const syncDatabase = useCallback(async () => {
        const docDir = FileSystem.documentDirectory;
        if (!docDir) return;
        const dbPath = `${docDir}SQLite/${DB_NAME}`;
        const dbDir = `${docDir}SQLite`;

        try {
            const headRes = await fetch(SERVER_URL, { method: 'HEAD' });
            const currentModified = headRes.headers.get('Last-Modified');

            // ✅ 서버 시간과 내가 가진 시간이 다를 때만 다운로드 (앱 재시작 트리거)
            if (currentModified && currentModified !== lastModifiedRef.current) {
                console.log("🔄 외부 변경 감지됨. DB 업데이트 중...");
                const downloadRes = await FileSystem.downloadAsync(SERVER_URL, dbPath);
                if (downloadRes.status === 200) {
                    lastModifiedRef.current = currentModified;
                    setDbKey(prev => prev + 1); // 리마운트 발생
                    if (!dbLoaded) setDbLoaded(true);
                }
            }
        } catch (e) {
            if (!dbLoaded) {
                const asset = await Asset.fromModule(require('../assets/chessDB.sqlite')).downloadAsync();
                if (asset.localUri) {
                    await FileSystem.copyAsync({ from: asset.localUri, to: dbPath });
                    setDbLoaded(true);
                }
            }
        }
    }, [dbLoaded]);

    useEffect(() => {
        syncDatabase();
        // const interval = setInterval(syncDatabase, 3000);
        // return () => clearInterval(interval);
    }, [syncDatabase]);

    if (!dbLoaded) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0B0F14' }}>
                <ActivityIndicator size="large" color="#91b045" />
                <Text style={{ color: '#E7EDF5', marginTop: 10 }}>DB 동기화 중...</Text>
            </View>
        );
    }

    return (
        // ✅ GameContext.Provider가 SQLiteProvider보다 위에 있음
        <GameContext.Provider value={{ moveState, setMoveState, orientation, setOrientation }}>
            <SQLiteProvider key={dbKey} databaseName={DB_NAME}>
                <Stack>
                    <Stack.Screen name="index" options={{ headerShown: false }} />
                </Stack>
            </SQLiteProvider>
        </GameContext.Provider>
    );
}
