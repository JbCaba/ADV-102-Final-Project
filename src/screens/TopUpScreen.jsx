import { useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, Easing, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { useUserBalance } from '../hooks/useUserBalance';
import { market } from '../constants/marketplaceTheme';

function Orb({ size, color, style, duration = 4000 }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(scale, { toValue: 1.18, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={[{ width: size, height: size, borderRadius: size/2, backgroundColor: color, opacity: 0.09, position: 'absolute', transform: [{ scale }] }, style]} />;
}

const AMOUNTS = [100, 250, 500, 1000, 2500, 5000];

export default function TopUpScreen() {
  const [selected, setSelected] = useState(null);
  const [custom, setCustom] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const balance = useUserBalance();
  const user = auth.currentUser;
  const finalAmount = selected !== null ? selected : Number(custom) || 0;

  const handleRequest = async () => {
    if (finalAmount < 1) {
      const msg = 'Enter at least $1.';
      if (Platform.OS === 'web') window.alert(msg); else Alert.alert('Invalid', msg);
      return;
    }
    if (!user) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'topups'), {
        uid: user.uid, email: user.email,
        amount: finalAmount, note: note.trim(),
        status: 'pending', createdAt: serverTimestamp(),
      });
      const msg = `Top-up request for $${finalAmount.toLocaleString()} sent! Admin will review shortly.`;
      if (Platform.OS === 'web') window.alert('✅ Sent!\n' + msg); else Alert.alert('✅ Request Sent!', msg);
      setSelected(null); setCustom(''); setNote('');
    } catch (e) {
      if (Platform.OS === 'web') window.alert(e.message); else Alert.alert('Failed', e.message);
    } finally { setSending(false); }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <Orb size={300} color={market.cyan}   style={{ top: -80,  left: -80 }}  duration={5000} />
      <Orb size={220} color={market.purple} style={{ bottom: -60, right: -60 }} duration={4200} />
      <View style={s.grid} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.center}>
          {/* Hero */}
          <View style={s.hero}>
            <View style={s.heroGlow} />
            <Text style={s.heroIcon}>🪙</Text>
            <Text style={s.heroTitle}>Top Up Coins</Text>
            <Text style={s.heroSub}>Request balance · Admin reviews · Coins added instantly</Text>
            <View style={s.balCard}>
              <Text style={s.balLabel}>CURRENT BALANCE</Text>
              <Text style={s.balValue}>${Number(balance).toLocaleString()}</Text>
            </View>
          </View>

          {/* Amount grid */}
          <View style={s.card}>
            <Text style={s.cardTitle}>⚡ SELECT AMOUNT</Text>
            <View style={s.amtGrid}>
              {AMOUNTS.map(a => (
                <Pressable
                  key={a}
                  style={[s.amtChip, selected === a && s.amtChipOn]}
                  onPress={() => { setSelected(a); setCustom(''); }}
                >
                  <Text style={[s.amtTxt, selected === a && s.amtTxtOn]}>${a.toLocaleString()}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Custom */}
          <View style={s.card}>
            <Text style={s.cardTitle}>🎮 CUSTOM AMOUNT</Text>
            <View style={s.customRow}>
              <Text style={s.customDollar}>$</Text>
              <TextInput
                style={[s.customInput, Platform.OS === 'web' && { outlineWidth: 0 }]}
                placeholder="0"
                placeholderTextColor="#4b5563"
                keyboardType="numeric"
                value={custom}
                onChangeText={v => { setCustom(v); setSelected(null); }}
              />
            </View>
          </View>

          {/* Note */}
          <View style={s.card}>
            <Text style={s.cardTitle}>📝 NOTE TO ADMIN</Text>
            <TextInput
              style={[s.noteInput, Platform.OS === 'web' && { outlineWidth: 0 }]}
              placeholder="GCash ref, payment proof, etc…"
              placeholderTextColor="#4b5563"
              multiline
              textAlignVertical="top"
              value={note}
              onChangeText={setNote}
            />
          </View>

          {/* Summary */}
          {finalAmount > 0 && (
            <View style={s.summary}>
              <Text style={s.summaryLbl}>REQUESTING</Text>
              <Text style={s.summaryAmt}>${finalAmount.toLocaleString()}</Text>
              <Text style={s.summaryNote}>Pending admin approval</Text>
            </View>
          )}

          {/* Submit */}
          <Pressable
            style={[s.submitBtn, (sending || finalAmount < 1) && s.submitOff]}
            onPress={handleRequest}
            disabled={sending || finalAmount < 1}
          >
            <Text style={s.submitTxt}>
              {sending ? '⏳ Sending…' : `⚔️ Request ${finalAmount > 0 ? '$' + finalAmount.toLocaleString() : '—'}`}
            </Text>
          </Pressable>

          {/* Info */}
          <View style={s.infoBox}>
            <Text style={s.infoTitle}>ℹ️ HOW IT WORKS</Text>
            <Text style={s.infoTxt}>1. Pick amount → submit request{'\n'}2. Pay via GCash/PayMaya → include ref in note{'\n'}3. Admin approves → coins added instantly</Text>
          </View>

          <View style={{ height: 30 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050c18' },
  scroll: { paddingBottom: 20 },
  center: { maxWidth: 480, width: '100%', alignSelf: 'center' },
  grid: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    ...Platform.select({ web: { backgroundImage: 'linear-gradient(rgba(0,240,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,240,255,0.03) 1px,transparent 1px)', backgroundSize: '40px 40px' } }),
  },

  hero: {
    backgroundColor: 'rgba(5,12,24,0.9)', paddingHorizontal: 20,
    paddingTop: 28, paddingBottom: 28, alignItems: 'center',
    overflow: 'hidden', borderBottomWidth: 1, borderBottomColor: 'rgba(0,240,255,0.1)',
    ...Platform.select({ web: { backdropFilter: 'blur(12px)' } }),
  },
  heroGlow: { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: market.cyan, opacity: 0.05, top: -80 },
  heroIcon: { fontSize: 40, marginBottom: 10 },
  heroTitle: { fontSize: Platform.select({ web: 32, default: 24 }), fontWeight: '900', color: market.cyan, letterSpacing: 1, marginBottom: 6 },
  heroSub: { fontSize: Platform.select({ web: 15, default: 12 }), color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 18, marginBottom: 18 },
  balCard: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14,
    paddingHorizontal: 30, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,240,255,0.2)',
    ...Platform.select({ web: { backdropFilter: 'blur(8px)', boxShadow: '0 0 20px rgba(0,240,255,0.1)' } }),
  },
  balLabel: { fontSize: Platform.select({ web: 12, default: 9 }), fontWeight: '800', color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginBottom: 4 },
  balValue: { fontSize: Platform.select({ web: 36, default: 28 }), fontWeight: '900', color: market.gold },

  card: {
    backgroundColor: 'rgba(13,20,40,0.85)', marginHorizontal: 14, marginTop: 12,
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(0,240,255,0.1)',
    ...Platform.select({ web: { backdropFilter: 'blur(8px)' } }),
  },
  cardTitle: { fontSize: Platform.select({ web: 13, default: 10 }), fontWeight: '900', color: market.cyan, letterSpacing: 1, marginBottom: 12 },

  amtGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amtChip: {
    width: '30.5%', paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  amtChipOn: { backgroundColor: market.cyan, borderColor: market.cyan, ...Platform.select({ web: { boxShadow: '0 0 12px rgba(0,240,255,0.3)' } }) },
  amtTxt: { fontSize: Platform.select({ web: 17, default: 13 }), fontWeight: '900', color: 'rgba(255,255,255,0.7)' },
  amtTxtOn: { color: '#050c18' },

  customRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden',
  },
  customDollar: { paddingHorizontal: 12, fontSize: 16, fontWeight: '900', color: market.gold, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)', paddingVertical: 11 },
  customInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, fontWeight: '900', color: '#fff' },

  noteInput: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, color: '#fff', minHeight: 70,
  },

  summary: {
    marginHorizontal: 14, marginTop: 12, borderRadius: 14,
    backgroundColor: 'rgba(0,240,255,0.06)', padding: 18,
    borderWidth: 1, borderColor: 'rgba(0,240,255,0.2)', alignItems: 'center', gap: 4,
    ...Platform.select({ web: { boxShadow: '0 0 20px rgba(0,240,255,0.08)' } }),
  },
  summaryLbl: { fontSize: Platform.select({ web: 12, default: 9 }), fontWeight: '900', color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
  summaryAmt: { fontSize: Platform.select({ web: 42, default: 32 }), fontWeight: '900', color: market.cyan },
  summaryNote: { fontSize: Platform.select({ web: 14, default: 11 }), color: 'rgba(255,255,255,0.4)' },

  submitBtn: {
    marginHorizontal: 14, marginTop: 14, borderRadius: 14,
    backgroundColor: market.cyan, paddingVertical: 15, alignItems: 'center',
    ...Platform.select({ web: { boxShadow: '0 0 24px rgba(0,240,255,0.35)', cursor: 'pointer' } }),
  },
  submitOff: { backgroundColor: '#1f2937' },
  submitTxt: { color: '#050c18', fontWeight: '900', fontSize: Platform.select({ web: 20, default: 15 }), letterSpacing: 0.5 },

  infoBox: {
    marginHorizontal: 14, marginTop: 14, borderRadius: 14,
    backgroundColor: 'rgba(13,20,40,0.85)', padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  infoTitle: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.35)', letterSpacing: 1, marginBottom: 8 },
  infoTxt: { fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 20 },
});
