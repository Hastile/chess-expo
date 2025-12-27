import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

export default function RootLayout() {
    const [dbLoaded, setDbLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadDatabase() {
            const dbName = "chessDB.sqlite";
            const docDir = FileSystem.documentDirectory;
            if (!docDir) return;

            const dbDir = `${docDir}SQLite`;
            const dbPath = `${dbDir}/${dbName}`;

            try {
                // 1. SQLite 폴더 생성 확인
                const dirInfo = await FileSystem.getInfoAsync(dbDir);
                if (!dirInfo.exists) {
                    await FileSystem.makeDirectoryAsync(dbDir, { intermediates: true });
                }

                // ✅ [변경] 기존 파일을 무조건 삭제하여 최신 에셋으로 교체합니다.
                console.log("기존 DB 삭제 및 최신 에셋 복사 시작...");
                await FileSystem.deleteAsync(dbPath, { idempotent: true });

                // 2. 에셋에서 최신 DB 복사
                const asset = await Asset.fromModule(require('../assets/chessDB.sqlite')).downloadAsync();
                if (asset.localUri) {
                    await FileSystem.copyAsync({
                        from: asset.localUri,
                        to: dbPath,
                    });
                    console.log("✅ 최신 DB 복사 완료");
                }

                setDbLoaded(true);
            } catch (e: any) {
                console.error("❌ DB 로드 중 오류 발생:", e);
                setError(e.message);
            }
        }

        loadDatabase();
    }, []);

    if (error) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0B0F14' }}>
                <Text style={{ color: '#EF4444' }}>DB 로드 실패: {error}</Text>
            </View>
        );
    }

    if (!dbLoaded) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0B0F14' }}>
                <ActivityIndicator size="large" color="#91b045" />
            </View>
        );
    }

    return (
        <SQLiteProvider databaseName="chessDB.sqlite">
            <Stack>
                <Stack.Screen name="index" options={{ headerShown: false }} />
            </Stack>
        </SQLiteProvider>
    );
}