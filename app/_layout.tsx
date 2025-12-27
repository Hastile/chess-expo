import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { Paths } from 'expo-file-system'; // ✅ SDK 54 전용 신규 API
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
    const [dbLoaded, setDbLoaded] = useState(false);

    useEffect(() => {
        async function loadDatabase() {
            const dbName = "chessDB.sqlite";

            // ✅ SDK 54 스타일: Paths.document를 사용합니다.
            // Paths.document.uri는 기존의 documentDirectory와 동일한 string을 반환합니다.
            const docDir = Paths.document.uri;
            const dbDir = `${docDir}SQLite`;
            const dbPath = `${dbDir}/${dbName}`;

            try {
                // 1. SQLite 폴더가 없으면 생성 (경로 확인)
                const dirInfo = await FileSystem.getInfoAsync(dbDir);
                if (!dirInfo.exists) {
                    await FileSystem.makeDirectoryAsync(dbDir, { intermediates: true });
                }

                // 2. 파일 복사 여부 확인
                const fileInfo = await FileSystem.getInfoAsync(dbPath);
                if (!fileInfo.exists) {
                    // ✅ assets/chessDB.sqlite가 존재해야 합니다.
                    const asset = await Asset.fromModule(require('../assets/chessDB.sqlite')).downloadAsync();
                    if (asset.localUri) {
                        await FileSystem.copyAsync({
                            from: asset.localUri,
                            to: dbPath,
                        });
                    }
                }
                setDbLoaded(true);
            } catch (error) {
                console.error("DB 로드 중 오류 발생:", error);
            }
        }

        loadDatabase();
    }, []);

    // DB가 준비될 때까지 로딩 화면을 보여줍니다.
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