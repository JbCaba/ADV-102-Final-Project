import { useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, Easing, Platform,
  Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { market } from '../constants/marketplaceTheme';

/* ── Animated floating feature card ──────────────────────────── */
function FloatCard({ emoji, label, sub, delay, color }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(opacity, { toValue: 1, duration: 600, delay, useNativeDriver: true }).start();
    // Float loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: -10, duration: 2200, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0,  duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
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
const TICKERS = ['⚔️ Trade rare swords', '🍈 Hunt Devil Fruits', '🎮 Sell Roblox accounts', '💎 Cosmetics & more', '🪙 P2P marketplace'];
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
  const titleY = useRef(new Animated.Value(30)).current;
  const titleOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(titleY, { toValue: 0, duration: 700, useNativeDriver: true }),
      Animated.timing(titleOp, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]).start();
    const id = setInterval(() => setTick(t => (t + 1) % TICKERS.length), 2800);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={lp.panel}>
      {/* Animated background orbs */}
      <Orb size={340} color={market.cyan}   style={{ top: -100, left: -80 }}  duration={5000} />
      <Orb size={260} color={market.purple} style={{ bottom: -80, right: -60 }} duration={4200} />
      <Orb size={180} color={market.gold}   style={{ top: '40%', right: '10%' }} duration={3500} />

      {/* Grid overlay */}
      <View style={lp.grid} />

      {/* Content */}
      <Animated.View style={{ transform: [{ translateY: titleY }], opacity: titleOp }}>
        <Text style={lp.eyebrow}>⚓ SAILOR PIECE MARKET</Text>
        <Text style={lp.heroTitle}>The Ultimate{'\n'}Roblox{'\n'}Marketplace</Text>
        <Text style={lp.heroSub}>Buy, sell, and trade swords, fruits,{'\n'}accounts and cosmetics.</Text>
      </Animated.View>

      {/* Ticker */}
      <View style={lp.tickerWrap}>
        {TICKERS.map((t, i) => (
          <View key={t} style={[lp.tickerSlot, i !== tick && { position: 'absolute', opacity: 0 }]}>
            <TickerItem text={t} active={i === tick} />
          </View>
        ))}
      </View>

      {/* Floating feature cards */}
      <View style={lp.floatRow}>
        <FloatCard emoji="⚔️" label="Swords"      sub="Rare & Legendary" delay={0}    color={market.cyan}   />
        <FloatCard emoji="🍈" label="Devil Fruits" sub="All types"         delay={300}  color={market.purple} />
      </View>
      <View style={lp.floatRow}>
        <FloatCard emoji="🎮" label="Accounts"    sub="Verified sellers"  delay={600}  color={market.gold}   />
        <FloatCard emoji="💎" label="Cosmetics"   sub="Flex your drip"    delay={900}  color="#22d3ee"       />
      </View>

      {/* Stats strip */}
      <View style={lp.statsStrip}>
        {[['🛒','Live Listings'],['🔐','Secure Trade'],['💰','P2P Payments']].map(([ic, lb]) => (
          <View key={lb} style={lp.statItem}>
            <Text style={lp.statIcon}>{ic}</Text>
            <Text style={lp.statLbl}>{lb}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ── Main Login Screen ────────────────────────────────────────── */
export default function LoginScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const isSplit = width >= 800;

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);

  const formY  = useRef(new Animated.Value(24)).current;
  const formOp = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(formY,  { toValue: 0, duration: 600, delay: 200, useNativeDriver: true }),
      Animated.timing(formOp, { toValue: 1, duration: 600, delay: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      const msg = 'Email and password required.';
      if (Platform.OS === 'web') window.alert(msg); else Alert.alert('Missing', msg);
      return;
    }
    setLoading(true);
    try {
      const trimmed = email.trim();
      const cred = await signInWithEmailAndPassword(auth, trimmed, password);
      await setDoc(doc(db, 'users', cred.user.uid),
        { uid: cred.user.uid, email: trimmed, lastLoginAt: serverTimestamp() },
        { merge: true });
    } catch (e) {
      const msg = `${e.code ?? 'error'}: ${e.message}`;
      if (Platform.OS === 'web') window.alert(msg); else Alert.alert('Login failed', msg);
    } finally { setLoading(false); }
  };

  return (
    <View style={s.bg}>
      {/* Background glow blobs */}
      <View style={s.bgBlob1} /><View style={s.bgBlob2} />

      <View style={[s.wrapper, isSplit && s.wrapperRow]}>
        {/* Left panel — only on wide screens */}
        {isSplit && <LeftPanel />}

        {/* Right — form */}
        <Animated.View style={[s.formSide, isSplit && s.formSideWide, { transform: [{ translateY: formY }], opacity: formOp }]}>
          {!isSplit && <Text style={s.mobileEyebrow}>⚓ SAILOR PIECE MARKET</Text>}

          <Text style={s.badge}>WELCOME BACK</Text>
          <Text style={s.title}>Sign in,{'\n'}Player.</Text>
          <Text style={s.sub}>Trade, buy, and grow your stash.</Text>

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

          <Pressable style={[s.btn, loading && s.btnOff]} onPress={handleLogin} disabled={loading}>
            <Text style={s.btnTxt}>{loading ? '⏳ Signing in…' : '⚔️  ENTER THE MARKET'}</Text>
          </Pressable>

          <View style={s.div}><View style={s.divLine}/><Text style={s.divTxt}>or</Text><View style={s.divLine}/></View>

          <Pressable style={s.sec} onPress={() => navigation.navigate('Register')}>
            <Text style={s.secTxt}>Create a new account →</Text>
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
    borderRightWidth: 1, borderRightColor: 'rgba(0,240,255,0.12)',
  },
  grid: {
    position: 'absolute', inset: 0,
    ...Platform.select({ web: {
      backgroundImage: 'linear-gradient(rgba(0,240,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.04) 1px, transparent 1px)',
      backgroundSize: '40px 40px',
    }}),
  },
  eyebrow: { fontSize: 10, fontWeight: '900', color: market.cyan, letterSpacing: 2, marginBottom: 10 },
  heroTitle: { fontSize: 38, fontWeight: '900', color: '#fff', lineHeight: 46, letterSpacing: -1, marginBottom: 12 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 20 },

  tickerWrap: { height: 36, overflow: 'hidden', justifyContent: 'center' },
  tickerSlot: { height: 36, justifyContent: 'center' },
  tickerText: { fontSize: 14, fontWeight: '800', color: market.gold },

  floatRow: { flexDirection: 'row', gap: 10 },
  floatCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14,
    borderWidth: 1, padding: 12,
    ...Platform.select({ web: { backdropFilter: 'blur(8px)' } }),
  },
  floatEmoji: { fontSize: 22 },
  floatLabel: { fontSize: 12, fontWeight: '800' },
  floatSub: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 },

  statsStrip: { flexDirection: 'row', gap: 0, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 16, marginTop: 4 },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statIcon: { fontSize: 18 },
  statLbl: { fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: '700', textAlign: 'center' },
});

/* ── Form / screen styles ───────────────────────────────────── */
const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#080f1a', overflow: 'hidden' },
  bgBlob1: { position: 'absolute', width: 400, height: 400, borderRadius: 200, backgroundColor: market.cyan,   opacity: 0.03, top: -120, right: 40 },
  bgBlob2: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: market.purple, opacity: 0.04, bottom: -80, left: -60 },

  wrapper:    { flex: 1 },
  wrapperRow: { flexDirection: 'row' },

  formSide: {
    justifyContent: 'center', padding: 28,
    backgroundColor: 'transparent',
  },
  formSideWide: {
    width: 400, flexShrink: 0,
    backgroundColor: '#0a1120',
    borderLeftWidth: 1, borderLeftColor: 'rgba(0,240,255,0.07)',
    paddingHorizontal: 36, paddingVertical: 40,
  },

  mobileEyebrow: { fontSize: 10, fontWeight: '900', color: market.cyan, letterSpacing: 2, marginBottom: 20, textAlign: 'center' },

  badge: { fontSize: 9, fontWeight: '900', color: market.cyan, letterSpacing: 2, marginBottom: 8 },
  title: { fontSize: 30, fontWeight: '900', color: '#fff', letterSpacing: -0.5, lineHeight: 36, marginBottom: 6 },
  sub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 26, lineHeight: 19 },

  lbl: { fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.35)', letterSpacing: 1, marginBottom: 6, marginTop: 4 },
  inp: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 14, color: '#fff', marginBottom: 12,
  },

  btn: {
    backgroundColor: market.cyan, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4,
    ...Platform.select({ web: { boxShadow: '0 0 24px rgba(0,240,255,0.3)', cursor: 'pointer' } }),
  },
  btnOff: { backgroundColor: '#1f2937' },
  btnTxt: { color: '#050c18', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },

  div: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  divLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  divTxt: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },

  sec: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)',
  },
  secTxt: { color: 'rgba(255,255,255,0.45)', fontWeight: '700', fontSize: 13 },
});
