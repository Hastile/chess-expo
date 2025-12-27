import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite'; // ✅ SQLite 공급자 임포트
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

// 앱이 준비될 때까지 스플래시 화면을 유지합니다.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const colorScheme = useColorScheme();
    const [loaded] = useFonts({
        SpaceMono: require('../assets/fonts/PAPERLOGY-4REGULAR.ttf'), // 폰트 경로 확인 필요
    });

    useEffect(() => {
        if (loaded) {
            SplashScreen.hideAsync();
        }
    }, [loaded]);

    if (!loaded) {
        return null;
    }

    return (
        // ✅ SQLiteProvider로 앱 전체를 감싸서 index.tsx에서 DB를 쓸 수 있게 합니다.
        // databaseName은 업로드하신 파일명인 'chessDB.sqlite'와 일치해야 합니다.
        <SQLiteProvider databaseName="chessDB.sqlite">
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <Stack>
                    {/* index.tsx가 메인 화면으로 표시됩니다. */}
                    <Stack.Screen name="index" options={{ headerShown: false }} />
                    {/* <Stack.Screen name="+not-found" />/ */}
                </Stack>
                <StatusBar style="auto" />
            </ThemeProvider>
        </SQLiteProvider>
    );
}