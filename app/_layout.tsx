// app/_layout.tsx
import { INITIAL_PIECES, MoveState, createInitialState, findKingSquare, isSquareAttacked, opposite } from '@/scripts/Piece';
import { Asset } from 'expo-asset';
import { useAudioPlayer } from "expo-audio";
import * as FileSystem from 'expo-file-system/legacy';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';


const PC_IP = "221.162.44.120"; // 본인 IP 확인
const DB_NAME = "chessDB.sqlite";
const SERVER_URL = `http://${PC_IP}:8000/assets/${DB_NAME}`;

// ✅ 게임 상태를 유지하기 위한 컨텍스트 생성
export const GameContext = createContext<{
    moveState: MoveState;
    setMoveState: React.Dispatch<React.SetStateAction<MoveState>>;
    orientation: "white" | "black";
    setOrientation: React.Dispatch<React.SetStateAction<"white" | "black">>;
} | null>(null);

export default function RootLayout() {
    const [dbLoaded, setDbLoaded] = useState(false);
    const [dbKey, setDbKey] = useState(0);
    const lastModifiedRef = useRef<string | null>(null);

    // ✅ 상태를 여기서 관리 (SQLiteProvider 위에 위치)
    const [moveState, setMoveState] = useState<MoveState>(() => createInitialState(INITIAL_PIECES));
    const [orientation, setOrientation] = useState<"white" | "black">("white");

    // ✅ 소리 플레이어를 여기에 정의하여 리마운트 영향 안 받게 함
    const audioOptions = { downloadFirst: true };
    const movePlayer = useAudioPlayer(require('../assets/sfx/move.wav'), audioOptions);
    const capturePlayer = useAudioPlayer(require('../assets/sfx/capture.wav'), audioOptions);
    const castlingPlayer = useAudioPlayer(require('../assets/sfx/castling.wav'), audioOptions);
    const checkPlayer = useAudioPlayer(require('../assets/sfx/check.wav'), audioOptions);
    const gameoverPlayer = useAudioPlayer(require('../assets/sfx/gameover.wav'), audioOptions);

    const playSound = useCallback((type: string) => {
        const soundMap: any = { move: movePlayer, capture: capturePlayer, castling: castlingPlayer, check: checkPlayer, gameover: gameoverPlayer };
        const p = soundMap[type];
        if (p) { p.volume = 1.0; p.seekTo(0); p.play(); }
    }, [movePlayer, capturePlayer, castlingPlayer, checkPlayer, gameoverPlayer]);

    // ✅ 무브 감지 및 소리 재생 로직을 _layout에서 직접 처리
    const prevCount = useRef(0);
    useEffect(() => {
        const currentCount = moveState.moveHistory.length;
        if (currentCount > prevCount.current) {
            const lastMove = moveState.moveHistory[currentCount - 1];
            // 체크/메이트 정보 계산
            const kingSq = findKingSquare(moveState.pieces, moveState.turn);
            const inCheck = kingSq ? isSquareAttacked(moveState.pieces, kingSq, opposite(moveState.turn)) : false;

            if (lastMove.san.includes('#')) playSound('gameover');
            else if (inCheck) playSound('check');
            else if (lastMove.san.includes('O-O')) playSound('castling');
            else if (lastMove.san.includes('x')) playSound('capture');
            else playSound('move');
        }
        prevCount.current = currentCount;
    }, [moveState.moveHistory.length]);

    const syncDatabase = useCallback(async () => {
        const docDir = FileSystem.documentDirectory;
        if (!docDir) return;
        const dbPath = `${docDir}SQLite/${DB_NAME}`;
        const dbDir = `${docDir}SQLite`;

        try {
            const headRes = await fetch(SERVER_URL, { method: 'HEAD' });
            const currentModified = headRes.headers.get('Last-Modified');

            if (currentModified !== lastModifiedRef.current) {
                console.log("🔄 DB 변경 감지됨. 업데이트 중...");
                const dirInfo = await FileSystem.getInfoAsync(dbDir);
                if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dbDir, { intermediates: true });

                const downloadRes = await FileSystem.downloadAsync(SERVER_URL, dbPath);
                if (downloadRes.status === 200) {
                    lastModifiedRef.current = currentModified;
                    setDbKey(prev => prev + 1); // ✅ SQLiteProvider만 리로드됨
                    if (!dbLoaded) setDbLoaded(true);
                    console.log("⚡ DB 실시간 동기화 완료");
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

    // useEffect(() => {
    //     async function setup() {
    //         try { await Audio.setAudioModeAsync({ playsInSilentMode: true }); }
    //         catch (e) { console.error(e); }
    //     }
    //     setup();
    // }, []);

    useEffect(() => {
        syncDatabase();
        const interval = setInterval(syncDatabase, 3000);
        return () => clearInterval(interval);
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