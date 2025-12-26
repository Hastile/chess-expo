// components/PromotionModal.tsx (새로 생성)
import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

const PIECES = ['queen', 'rook', 'bishop', 'knight'];

export default function PromotionModal({ color, onSelect }) {
    return (
        <View style={styles.overlay}>
            <View style={styles.container}>
                {PIECES.map((p) => (
                    <Pressable key={p} onPress={() => onSelect(p)} style={styles.pieceBtn}>
                        <Image
                            source={/* 기존 PIECE_IMAGES 로직 활용 */}
                            style={styles.pieceImg}
                        />
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
    container: { flexDirection: 'row', backgroundColor: '#262421', padding: 10, borderRadius: 8 },
    pieceBtn: { padding: 10 },
    pieceImg: { width: 50, height: 50 }
});