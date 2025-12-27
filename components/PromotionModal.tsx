// components/PromotionModal.tsx
import { Color, Piece, PIECE_IMAGES } from '@/scripts/Piece';
import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

// ✅ Props 타입 정의
interface PromotionModalProps {
    color: Color;
    onSelect: (piece: Piece) => void;
}

const PROMOTION_PIECES: Piece[] = ['queen', 'rook', 'bishop', 'knight'];

export default function PromotionModal({ color, onSelect }: PromotionModalProps) {
    return (
        <View style={styles.overlay}>
            <View style={styles.container}>
                {PROMOTION_PIECES.map((p) => (
                    <Pressable key={p} onPress={() => onSelect(p)} style={styles.pieceBtn}>
                        <Image
                            // ✅ ChessBoard에서 정의된 PIECE_IMAGES 활용
                            source={PIECE_IMAGES[color][p]}
                            style={styles.pieceImg}
                        />
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
    container: { flexDirection: 'row', backgroundColor: '#262421', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#444' },
    pieceBtn: { padding: 8, marginHorizontal: 4, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8 },
    pieceImg: { width: 56, height: 56 }
});