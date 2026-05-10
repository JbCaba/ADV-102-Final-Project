import { useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, Easing, Platform,
  Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { market } from '../constants/marketplaceTheme';

/* ── Animated floating feature card ──────────────────────────── */
function FloatCard({ emoji, label, sub, delay, color }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 600, delay, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: -10, duration: 2200, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0,   duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[lp.floatCard, { borderColor: color + '55', opacity, transform: [{ translateY }] }]}>
      <Text style={lp.floatEmoji}>{emoji}</Text>
      <View>
        <Text style={[lp.floatLabel, { color }]}>{label}</Text>
        <Text style={lp.floatSub}>{sub}</Text>
      </View>
    </Animated.View>
  );
}

/* ── Animated orb ─────────────────────────────────────────────── */
function Orb({ size, color, style, duration = 4000 }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.15, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,    duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: 0.12, position: 'absolute', transform: [{ scale }] }, style]} />
  );
}

/* ── Ticker text ──────────────────────────────────────────────── */
const TICKERS = ['🚀 Join thousands of traders', '⚔️ Hunt rare Swords', '🍈 Find Devil Fruits', '🎮 Sell your Roblox account', '💰 Earn real in-game coins'];
function TickerItem({ text, active }) {
  const opacity = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: active ? 1 : 0, duration: 400, useNativeDriver: true }).start();
  }, [active]);
  return <Animated.Text style={[lp.tickerText, { opacity }]}>{text}</Animated.Text>;
}

/* ── Left panel ───────────────────────────────────────────────── */
function LeftPanel() {
  const [tick, setTick] = useState(0);
  const titleY  = useRef(new Animated.Value(30)).current;
  const titleOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(titleY,  { toValue: 0, duration: 700, useNativeDriver: true }),
      Animated.timing(titleOp, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]).start();
    const id = setInterval(() => setTick(t => (t + 1) % TICKERS.length), 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={lp.panel}>
      <Orb size={340} color={market.purple} style={{ top: -100, left: -80 }}    duration={5000} />
      <Orb size={260} color={market.cyan}   style={{ bottom: -80, right: -60 }} duration={4200} />
      <Orb size={180} color={market.gold}   style={{ top: '40%', right: '10%' }} duration={3500} />
      <View style={lp.grid} />

      <Animated.View style={{ transform: [{ translateY: titleY }], opacity: titleOp }}>
        <Text style={lp.eyebrow}>⚓ SAILOR PIECE MARKET</Text>
        <Text style={lp.heroTitle}>Create your{'\n'}Legend in{'\n'}Sailor Piece</Text>
        <Text style={lp.heroSub}>Join the marketplace, trade freely{'\n'}and build your empire.</Text>
      </Animated.View>

      <View style={lp.tickerWrap}>
        {TICKERS.map((t, i) => (
          <View key={t} style={[lp.tickerSlot, i !== tick && { position: 'absolute', opacity: 0 }]}>
            <TickerItem text={t} active={i === tick} />
          </View>
        ))}
      </View>

      <View style={lp.floatRow}>
        <FloatCard emoji="⚔️" label="Swords"      sub="Rare & Legendary" delay={0}   color={market.cyan}   />
        <FloatCard emoji="🍈" label="Devil Fruits" sub="All types"        delay={300} color={market.purple} />
      </View>
      <View style={lp.floatRow}>
        <FloatCard emoji="🎮" label="Accounts"  sub="Verified sellers" delay={600} color={market.gold} />
        <FloatCard emoji="💎" label="Cosmetics" sub="Flex your drip"   delay={900} color="#22d3ee"     />
      </View>

      <View style={lp.statsStrip}>
        {[['🆓','Free to Join'],['🔐','Secure Trade'],['⚡','Instant Buy']].map(([ic, lb]) => (
          <View key={lb} style={lp.statItem}>
            <Text style={lp.statIcon}>{ic}</Text>
            <Text style={lp.statLbl}>{lb}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ── Main Register Screen ─────────────────────────────────────── */
export default function RegisterScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isSplit = width >= 800;

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);

  const formY  = useRef(new Animated.Value(24)).current;
  const formOp = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(formY,  { toValue: 0, duration: 600, delay: 200, useNativeDriver: true }),
      Animated.timing(formOp, { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleRegister = async () => {
    if (!email || !password || !confirm) {
      const m = 'Fill in all fields.';
      if (Platform.OS === 'web') window.alert(m); else Alert.alert('Missing', m); return;
    }
    if (password !== confirm) {
      const m = 'Passwords do not match.';
      if (Platform.OS === 'web') window.alert(m); else Alert.alert('Mismatch', m); return;
    }
    setLoading(true);
    try {
      const trimmed = email.trim();
      const cred = await createUserWithEmailAndPassword(auth, trimmed, password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid, email: trimmed,
        balance: 0, isAdmin: false, createdAt: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      const m = `${e.code ?? 'error'}: ${e.message}`;
      if (Platform.OS === 'web') window.alert(m); else Alert.alert('Failed', m);
    } finally { setLoading(false); }
  };

  return (
    <View style={s.bg}>
      <View style={s.bgBlob1} /><View style={s.bgBlob2} />

      <View style={[s.wrapper, isSplit && s.wrapperRow]}>
        {isSplit && <LeftPanel />}

        <Animated.View style={[s.formSide, isSplit && s.formSideWide, { transform: [{ translateY: formY }], opacity: formOp }]}>
          {!isSplit && <Text style={s.mobileEyebrow}>⚓ SAILOR PIECE MARKET</Text>}

          <Text style={s.badge}>NEW PLAYER</Text>
          <Text style={s.title}>Create your{'\n'}account.</Text>
          <Text style={s.sub}>Start with $0 · Top up to buy · Trade freely.</Text>

          <Text style={s.lbl}>EMAIL</Text>
          <TextInput
            style={[s.inp, Platform.OS === 'web' && { outlineWidth: 0 }]}
            placeholder="you@example.com" placeholderTextColor="#374151"
            autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
            value={email} onChangeText={setEmail}
          />

          <Text style={s.lbl}>PASSWORD</Text>
          <TextInput
            style={[s.inp, Platform.OS === 'web' && { outlineWidth: 0 }]}
            placeholder="••••••••" placeholderTextColor="#374151"
            secureTextEntry value={password} onChangeText={setPassword}
          />

          <Text style={s.lbl}>CONFIRM PASSWORD</Text>
          <TextInput
            style={[s.inp, Platform.OS === 'web' && { outlineWidth: 0 }]}
            placeholder="••••••••" placeholderTextColor="#374151"
            secureTextEntry value={confirm} onChangeText={setConfirm}
          />

          <Pressable style={[s.btn, loading && s.btnOff]} onPress={handleRegister} disabled={loading}>
            <Text style={s.btnTxt}>{loading ? '⏳ Creating…' : '🎮  CREATE ACCOUNT'}</Text>
          </Pressable>

          <View style={s.div}><View style={s.divLine}/><Text style={s.divTxt}>or</Text><View style={s.divLine}/></View>

          <Pressable style={s.sec} onPress={() => navigation?.navigate('Login')}>
            <Text style={s.secTxt}>Already have an account? Sign in →</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

/* ── Left panel styles ──────────────────────────────────────── */
const lp = StyleSheet.create({
  panel: {
    flex: 1, backgroundColor: '#050c18', overflow: 'hidden',
    padding: 36, justifyContent: 'center', gap: 20,
    borderRightWidth: 1, borderRightColor: 'rgba(168,85,247,0.15)',
  },
  grid: {
    position: 'absolute', inset: 0,
    ...Platform.select({ web: {
      backgroundImage: 'linear-gradient(rgba(168,85,247,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.04) 1px, transparent 1px)',
      backgroundSize: '40px 40px',
    }}),
  },
  eyebrow:   { fontSize: 10, fontWeight: '900', color: market.purple, letterSpacing: 2, marginBottom: 10 },
  heroTitle: { fontSize: 38, fontWeight: '900', color: '#fff', lineHeight: 46, letterSpacing: -1, marginBottom: 12 },
  heroSub:   { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 20 },

  tickerWrap: { height: 36, overflow: 'hidden', justifyContent: 'center' },
  tickerSlot: { height: 36, justifyContent: 'center' },
  tickerText: { fontSize: 14, fontWeight: '800', color: market.purple },

  floatRow:  { flexDirection: 'row', gap: 10 },
  floatCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14,
    borderWidth: 1, padding: 12,
    ...Platform.select({ web: { backdropFilter: 'blur(8px)' } }),
  },
  floatEmoji: { fontSize: 22 },
  floatLabel: { fontSize: 12, fontWeight: '800' },
  floatSub:   { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 },

  statsStrip: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 16, marginTop: 4 },
  statItem:   { flex: 1, alignItems: 'center', gap: 4 },
  statIcon:   { fontSize: 18 },
  statLbl:    { fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: '700', textAlign: 'center' },
});

/* ── Form / screen styles ───────────────────────────────────── */
const s = StyleSheet.create({
  bg:      { flex: 1, backgroundColor: '#080f1a', overflow: 'hidden' },
  bgBlob1: { position: 'absolute', width: 400, height: 400, borderRadius: 200, backgroundColor: market.purple, opacity: 0.03, top: -120, right: 40 },
  bgBlob2: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: market.cyan,   opacity: 0.04, bottom: -80, left: -60 },

  wrapper:    { flex: 1 },
  wrapperRow: { flexDirection: 'row' },

  formSide: { justifyContent: 'center', padding: 28 },
  formSideWide: {
    width: 420, flexShrink: 0,
    backgroundColor: '#0a1120',
    borderLeftWidth: 1, borderLeftColor: 'rgba(168,85,247,0.07)',
    paddingHorizontal: 36, paddingVertical: 32,
  },

  mobileEyebrow: { fontSize: 10, fontWeight: '900', color: market.purple, letterSpacing: 2, marginBottom: 20, textAlign: 'center' },

  badge: { fontSize: 9, fontWeight: '900', color: market.purple, letterSpacing: 2, marginBottom: 8 },
  title: { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.5, lineHeight: 36, marginBottom: 6 },
  sub:   { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 22, lineHeight: 19 },

  lbl: { fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.35)', letterSpacing: 1, marginBottom: 6, marginTop: 4 },
  inp: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 14, color: '#fff', marginBottom: 10,
  },

  btn: {
    backgroundColor: market.purple, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4,
    ...Platform.select({ web: { boxShadow: '0 0 24px rgba(168,85,247,0.4)', cursor: 'pointer' } }),
  },
  btnOff: { backgroundColor: '#1f2937' },
  btnTxt: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },

  div:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 14 },
  divLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  divTxt:  { color: 'rgba(255,255,255,0.3)', fontSize: 12 },

  sec:    { borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingVertical: 13, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)' },
  secTxt: { color: 'rgba(255,255,255,0.45)', fontWeight: '700', fontSize: 13 },
});
