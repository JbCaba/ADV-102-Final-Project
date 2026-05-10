import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Animated, Easing, FlatList, Image, Modal,
  Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { collection, deleteDoc, doc, increment, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { market } from '../constants/marketplaceTheme';
import { useAllListings } from '../hooks/useAllListings';
import { useUserBalance } from '../hooks/useUserBalance';
import { parseListing, serializeListing } from '../utils/listingCodec';

const CATS = [
  { label: '🌀 All', key: 'All' },
  { label: '🍈 Fruit', key: 'Fruit' },
  { label: '⚔️ Sword', key: 'Sword' },
  { label: '🧥 Account', key: 'Account' },
  { label: '💎 Cosmetic', key: 'Cosmetic' },
  { label: '🧪 Material', key: 'Material' },
];

/* ── Animated background orb ────────────────────────────────── */
function Orb({ size, color, style, duration = 4000 }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.18, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,    duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: 0.09, position: 'absolute', transform: [{ scale }] }, style]} />
  );
}

/* ── Buy Modal ───────────────────────────────────────────────── */
function BuyModal({ item, parsed, visible, onClose, balance }) {
  const [busy, setBusy] = useState(false);
  const slideY = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) Animated.spring(slideY, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 10 }).start();
    else slideY.setValue(400);
  }, [visible]);

  if (!item || !parsed) return null;
  const price = Number(parsed.price) || 0;
  const canAfford = balance >= price && price > 0;
  const seller = item.sellerEmail?.split('@')[0] ?? 'seller';

  const handleBuy = async () => {
    if (!canAfford) {
      const m = `Need $${(price - balance).toLocaleString()} more. Top Up first.`;
      if (Platform.OS === 'web') window.alert(m); else Alert.alert('Not enough', m); return;
    }
    const buyer = auth.currentUser;
    if (!buyer) return;
    setBusy(true);
    try {
      await runTransaction(db, async tx => {
        const bRef = doc(db, 'users', buyer.uid);
        const sRef = doc(db, 'users', item.uid);
        const bSnap = await tx.get(bRef);
        if ((bSnap.data()?.balance ?? 0) < price) throw new Error('Insufficient balance');
        tx.set(bRef, { balance: increment(-price) }, { merge: true });
        tx.set(sRef, { balance: increment(price) }, { merge: true });
        tx.set(doc(collection(db, 'purchases')), {
          buyerUid: buyer.uid, buyerEmail: buyer.email,
          sellerUid: item.uid, sellerEmail: item.sellerEmail ?? '',
          listingId: item.id, itemName: parsed.title || 'Item',
          itemDescription: parsed.description || '', imageUri: parsed.imageUri || '',
          price, purchasedAt: serverTimestamp(),
        });
      });
      const currentPieces = parsed.pieces ?? 1;
      if (currentPieces <= 1) await deleteDoc(doc(db, 'notes', item.id));
      else {
        const newText = serializeListing(parsed.title, parsed.price, parsed.description, parsed.imageUri, currentPieces - 1);
        await updateDoc(doc(db, 'notes', item.id), { text: newText });
      }
      let m = `"${parsed.title}" purchased for $${price}!`;
      if (item.category === 'Account' && item.robloxEmail)
        m += `\n\n🔑 ROBLOX CREDENTIALS:\nEmail: ${item.robloxEmail}\nPassword: ${item.robloxPass}\n\nChange the password immediately!`;
      if (Platform.OS === 'web') window.alert('🎉 ' + m); else Alert.alert('🎉 Bought!', m);
      onClose();
    } catch (e) {
      if (Platform.OS === 'web') window.alert(e.message); else Alert.alert('Failed', e.message);
    } finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={ms.ov} onPress={onClose}>
        <Animated.View style={[ms.sh, { transform: [{ translateY: slideY }] }]}>
          <Pressable onPress={() => {}}>
            <View style={ms.bar} />
            {parsed.imageUri && /^https?:\/\//i.test(parsed.imageUri)
              ? <Image source={{ uri: parsed.imageUri }} style={ms.img} resizeMode="contain" />
              : <View style={ms.imgPh}><Text style={{ fontSize: 48 }}>⚓</Text></View>}
            {/* Glow accent line */}
            <View style={ms.glowLine} />
            <Text style={ms.nm}>{parsed.title || 'Item'}</Text>
            <Text style={ms.sl}>🧑‍💻 Sold by @{seller}</Text>
            {item?.category === 'Account' && (
              <View style={ms.accountBadge}><Text style={ms.accountBadgeTxt}>🎮 ROBLOX ACCOUNT — Credentials revealed after purchase</Text></View>
            )}
            {parsed.description ? <Text style={ms.ds} numberOfLines={4}>{parsed.description}</Text> : null}
            <View style={ms.rw}>
              <View style={ms.pl}><Text style={ms.plL}>PRICE</Text><Text style={ms.plV}>${price.toLocaleString()}</Text></View>
              <View style={ms.pl}><Text style={ms.plL}>YOUR COINS</Text><Text style={[ms.plV, { color: canAfford ? market.green : market.red }]}>${Number(balance).toLocaleString()}</Text></View>
            </View>
            {!canAfford && <Text style={ms.wn}>⚠️ Need ${(price - balance).toLocaleString()} more — Top Up first</Text>}
            <Pressable style={[ms.bb, (!canAfford || busy) && ms.bo]} onPress={handleBuy} disabled={busy}>
              <Text style={ms.bt}>{busy ? '⏳ Processing…' : `⚔️ BUY NOW · $${price.toLocaleString()}`}</Text>
            </Pressable>
            <Pressable style={ms.cb} onPress={onClose}><Text style={ms.ct}>Cancel</Text></Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

/* ── Item Card ───────────────────────────────────────────────── */
function ItemCard({ item, onPress, size }) {
  const p = parseListing(item.text);
  const title  = p.legacy ? 'Item' : (p.title || '—');
  const price  = p.legacy ? '' : p.price;
  const pieces = p.legacy ? 1 : (p.pieces ?? 1);
  const img    = !p.legacy && p.imageUri && /^https?:\/\//i.test(p.imageUri) ? p.imageUri : null;
  const seller = item.sellerEmail?.split('@')[0] ?? 'seller';
  const scale  = useRef(new Animated.Value(1)).current;
  const glow   = useRef(new Animated.Value(0)).current;

  const hoverIn  = () => { Animated.spring(scale, { toValue: 1.08, useNativeDriver: true, speed: 22, bounciness: 8 }).start(); Animated.timing(glow, { toValue: 1, duration: 160, useNativeDriver: false }).start(); };
  const hoverOut = () => { Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 22, bounciness: 6 }).start(); Animated.timing(glow, { toValue: 0, duration: 160, useNativeDriver: false }).start(); };
  const pressIn  = () =>   Animated.spring(scale, { toValue: 1.13, useNativeDriver: true, speed: 30, bounciness: 12 }).start();
  const pressOut = () =>   Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 22, bounciness: 6  }).start();

  const borderColor = glow.interpolate({ inputRange: [0, 1], outputRange: [market.border, market.cyan] });

  return (
    <Animated.View style={[c.wrap, { width: size, transform: [{ scale }] }]}>
      <Pressable onPress={() => onPress(item, p)} onHoverIn={hoverIn} onHoverOut={hoverOut} onPressIn={pressIn} onPressOut={pressOut}>
        <Animated.View style={[c.card, { borderColor }]}>
          <View style={c.imgBox}>
            {img ? <Image source={{ uri: img }} style={c.imgFill} resizeMode="cover" />
                 : <View style={c.ph}><Text style={{ fontSize: 20 }}>⚓</Text></View>}
            {pieces > 1 && <View style={c.pBadge}><Text style={c.pBadgeTxt}>×{pieces}</Text></View>}
          </View>
          <View style={c.info}>
            <Text style={c.title} numberOfLines={1}>{title}</Text>
            <Text style={c.seller} numberOfLines={1}>@{seller}</Text>
            <Text style={c.price}>{price ? `$${price}` : '—'}</Text>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/* ── Main Screen ─────────────────────────────────────────────── */
const TICKERS = ['⚔️ Swords', '🍈 Devil Fruits', '🎮 Accounts', '💎 Cosmetics', '🧪 Materials'];

export default function MarketplaceHomeScreen() {
  const nav = useNavigation();
  const { width } = useWindowDimensions();
  const all = useAllListings();
  const bal = useUserBalance();
  const [q, setQ]   = useState('');
  const [cat, setCat] = useState('All');
  const [mi, setMi] = useState(null);
  const [mp, setMp] = useState(null);
  const [tick, setTick] = useState(0);
  const uid = auth.currentUser?.uid;

  // Header fade-in
  const hdrOp = useRef(new Animated.Value(0)).current;
  const hdrY  = useRef(new Animated.Value(-16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(hdrOp, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(hdrY,  { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
    const id = setInterval(() => setTick(t => (t + 1) % TICKERS.length), 2000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => all.filter(n => {
    if (n.uid === uid) return false;
    if (n.status === 'pending') return false;
    const p = parseListing(n.text);
    const blob = p.legacy ? String(p.raw ?? '') : `${p.title} ${p.description}`;
    return (!q.trim() || blob.toLowerCase().includes(q.toLowerCase()))
      && (cat === 'All' || blob.toLowerCase().includes(cat.toLowerCase()));
  }), [all, q, cat, uid]);

  const COLS = 6; const GAP = 6; const HP = 8;
  const size = Math.floor((Math.min(width, 960) - HP * 2 - GAP * (COLS - 1)) / COLS);

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <StatusBar style="light" />

      {/* Animated background orbs */}
      <Orb size={380} color={market.cyan}   style={{ top: -140, left: -100 }} duration={5500} />
      <Orb size={300} color={market.purple} style={{ top: 80, right: -100 }}  duration={4800} />
      <Orb size={200} color={market.gold}   style={{ bottom: 100, left: '30%' }} duration={3800} />

      {/* Grid overlay */}
      <View style={st.grid} />

      <View style={st.center}>
        {/* Animated Header */}
        <Animated.View style={[st.topBar, { opacity: hdrOp, transform: [{ translateY: hdrY }] }]}>
          <View>
            <Text style={st.logo}>⚓ <Text style={{ color: market.cyan }}>Sailor</Text>Piece</Text>
            <View style={st.tickerRow}>
              {TICKERS.map((t, i) => (
                <Animated.Text key={t} style={[st.logoTicker, { opacity: i === tick ? 1 : 0, position: i === tick ? 'relative' : 'absolute' }]}>
                  {t}
                </Animated.Text>
              ))}
            </View>
          </View>
          <View style={st.topRight}>
            <Pressable style={st.balBtn} onPress={() => nav.navigate('TopUp')}>
              <Text style={st.balIcon}>🪙</Text>
              <Text style={st.balTxt}>${Number(bal).toLocaleString()}</Text>
            </Pressable>
            <Pressable style={st.sellBtn} onPress={() => nav.navigate('Sell')}>
              <Text style={st.sellTxt}>⚔️ SELL</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Search */}
        <View style={st.searchWrap}>
          <View style={st.searchBar}>
            <Text style={st.searchIcon}>⌕</Text>
            <TextInput
              style={[st.searchInput, Platform.OS === 'web' && { outlineWidth: 0 }]}
              placeholder="Search items, sellers…" placeholderTextColor="rgba(255,255,255,0.2)"
              value={q} onChangeText={setQ} returnKeyType="search"
            />
            {!!q && <Pressable onPress={() => setQ('')}><Text style={st.clearBtn}>✕</Text></Pressable>}
          </View>
        </View>

        {/* Categories */}
        <View style={st.catSection}>
          <Text style={st.catLabel}>BROWSE BY CATEGORY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.catRow}>
            {CATS.map(({ label, key }) => (
              <Pressable key={key} style={[st.catChip, cat === key && st.catChipOn]} onPress={() => setCat(key)}>
                <Text style={[st.catTxt, cat === key && st.catTxtOn]}>{label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Count bar */}
        <View style={st.countBar}>
          <Text style={st.countTxt}>🎮 {filtered.length} items from other players</Text>
          <Pressable onPress={() => nav.navigate('Listings')}>
            <Text style={st.myLink}>My items →</Text>
          </Pressable>
        </View>

        {/* Grid */}
        <FlatList
          data={filtered}
          numColumns={COLS} key={`c${COLS}`}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingHorizontal: HP, paddingTop: 8, paddingBottom: 28 }}
          columnWrapperStyle={{ gap: GAP }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={st.empty}>
              <Text style={{ fontSize: 36 }}>🏰</Text>
              <Text style={st.emptyT}>No items from other players</Text>
              <Text style={st.emptyS}>Invite friends to sell!</Text>
            </View>
          }
          renderItem={({ item }) => (
            <ItemCard item={item} onPress={(it, pa) => { setMi(it); setMp(pa); }} size={size} />
          )}
        />
      </View>

      <BuyModal item={mi} parsed={mp} visible={!!mi} onClose={() => { setMi(null); setMp(null); }} balance={bal} />
    </SafeAreaView>
  );
}

/* ── Card styles ─────────────────────────────────────────────── */
const c = StyleSheet.create({
  wrap: {
    marginBottom: 6, borderRadius: 10,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  card: {
    backgroundColor: 'rgba(15,25,50,0.85)', borderRadius: 10,
    borderWidth: 1, overflow: 'hidden',
    ...Platform.select({ web: { backdropFilter: 'blur(8px)', transition: 'border-color 0.15s' } }),
  },
  imgBox:   { width: '100%', height: 90, overflow: 'hidden', backgroundColor: '#0d1428' },
  imgFill:  { width: '100%', height: '100%' },
  ph:       { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#080f1a' },
  info:     { paddingHorizontal: 5, paddingVertical: 6, gap: 2 },
  title:    { fontSize: Platform.select({ web: 15, default: 11 }), fontWeight: '800', color: '#fff', lineHeight: Platform.select({ web: 20, default: 14 }) },
  seller:   { fontSize: Platform.select({ web: 13, default: 10 }), color: 'rgba(255,255,255,0.35)' },
  price:    { fontSize: Platform.select({ web: 16, default: 13 }), fontWeight: '900', color: market.gold, marginTop: 2 },
  pBadge:   { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,240,255,0.9)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  pBadgeTxt:{ fontSize: Platform.select({ web: 12, default: 9 }), fontWeight: '900', color: '#050c18' },
});

/* ── Screen styles ───────────────────────────────────────────── */
const st = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#050c18' },
  center: { flex: 1, maxWidth: 960, width: '100%', alignSelf: 'center' },
  grid:   {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0,
    ...Platform.select({ web: {
      backgroundImage: 'linear-gradient(rgba(0,240,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.03) 1px, transparent 1px)',
      backgroundSize: '40px 40px',
    }}),
  },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: 'rgba(5,12,24,0.9)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,240,255,0.1)',
    ...Platform.select({ web: { backdropFilter: 'blur(12px)' } }),
  },
  logo:       { fontSize: Platform.select({ web: 24, default: 17 }), fontWeight: '900', color: '#fff', letterSpacing: -0.3 },
  tickerRow:  { height: Platform.select({ web: 22, default: 16 }), overflow: 'hidden', justifyContent: 'center', marginTop: 2 },
  logoTicker: { fontSize: Platform.select({ web: 13, default: 10 }), fontWeight: '800', color: market.gold, letterSpacing: 1, position: 'absolute' },
  topRight:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(251,191,36,0.1)', borderRadius: 14,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
  },
  balIcon: { fontSize: Platform.select({ web: 16, default: 12 }) },
  balTxt:  { fontSize: Platform.select({ web: 16, default: 12 }), fontWeight: '900', color: market.gold },
  sellBtn: {
    backgroundColor: market.red, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
    ...Platform.select({ web: { boxShadow: '0 0 14px rgba(255,59,92,0.4)', cursor: 'pointer' } }),
  },
  sellTxt: { color: '#fff', fontWeight: '900', fontSize: Platform.select({ web: 15, default: 11 }), letterSpacing: 0.5 },

  searchWrap: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: 'rgba(5,12,24,0.8)' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
    paddingLeft: 12, borderWidth: 1, borderColor: 'rgba(0,240,255,0.12)',
    ...Platform.select({ web: { backdropFilter: 'blur(8px)' } }),
  },
  searchIcon:  { fontSize: Platform.select({ web: 18, default: 14 }), color: 'rgba(255,255,255,0.3)', marginRight: 6 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: Platform.select({ web: 16, default: 13 }), color: '#fff' },
  clearBtn:    { paddingHorizontal: 12, paddingVertical: 10, color: 'rgba(255,255,255,0.3)', fontSize: Platform.select({ web: 16, default: 13 }) },

  catSection: {
    backgroundColor: 'rgba(8,15,26,0.85)', paddingTop: 10, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,240,255,0.08)',
  },
  catLabel: { fontSize: Platform.select({ web: 13, default: 10 }), fontWeight: '900', color: market.cyan, letterSpacing: 2, marginLeft: 12, marginBottom: 8 },
  catRow:   { paddingHorizontal: 10, gap: 8, alignItems: 'center' },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.15s' } }),
  },
  catChipOn: {
    backgroundColor: market.cyan, borderColor: market.cyan,
    ...Platform.select({ web: { boxShadow: '0 0 14px rgba(0,240,255,0.4)' } }),
  },
  catTxt:   { fontSize: Platform.select({ web: 15, default: 12 }), fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  catTxtOn: { color: '#050c18', fontWeight: '900' },

  countBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 10, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  countTxt: { fontSize: Platform.select({ web: 13, default: 10 }), fontWeight: '700', color: 'rgba(255,255,255,0.35)' },
  myLink:   { fontSize: Platform.select({ web: 13, default: 10 }), fontWeight: '700', color: market.cyan },

  empty:  { alignItems: 'center', paddingVertical: 50, gap: 10 },
  emptyT: { fontSize: Platform.select({ web: 18, default: 14 }), fontWeight: '800', color: 'rgba(255,255,255,0.6)' },
  emptyS: { fontSize: Platform.select({ web: 15, default: 12 }), color: 'rgba(255,255,255,0.3)' },
});

/* ── Modal styles ────────────────────────────────────────────── */
const ms = StyleSheet.create({
  ov: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  sh: {
    backgroundColor: '#0d1428', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36, maxWidth: 500, width: '100%', alignSelf: 'center',
    borderWidth: 1, borderColor: 'rgba(0,240,255,0.15)',
    ...Platform.select({ web: { boxShadow: '0 -8px 40px rgba(0,240,255,0.1)' } }),
  },
  bar:     { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 16 },
  img:     { width: '100%', aspectRatio: 1, borderRadius: 14, marginBottom: 12, backgroundColor: '#080f1a' },
  imgPh:   { width: '100%', aspectRatio: 1, borderRadius: 14, marginBottom: 12, backgroundColor: '#080f1a', alignItems: 'center', justifyContent: 'center' },
  glowLine:{ height: 1, backgroundColor: market.cyan, opacity: 0.25, marginBottom: 12 },
  nm:      { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 3 },
  sl:      { fontSize: 12, color: market.cyan, fontWeight: '700', marginBottom: 10 },
  ds:      { fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 18, marginBottom: 12 },
  rw:      { flexDirection: 'row', gap: 10, marginBottom: 12 },
  pl:      { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  plL:     { fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: '800', letterSpacing: 0.8, marginBottom: 4 },
  plV:     { fontSize: 18, fontWeight: '900', color: market.gold },
  wn:      { fontSize: 11, color: market.gold, backgroundColor: 'rgba(251,191,36,0.08)', borderRadius: 8, padding: 10, marginBottom: 10, textAlign: 'center', fontWeight: '700', borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)' },
  bb:      { backgroundColor: market.cyan, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 8, ...Platform.select({ web: { boxShadow: '0 0 20px rgba(0,240,255,0.35)', cursor: 'pointer' } }) },
  bo:      { backgroundColor: '#1f2937' },
  bt:      { color: '#050c18', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
  cb:      { borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingVertical: 11, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)' },
  ct:      { color: 'rgba(255,255,255,0.4)', fontWeight: '700', fontSize: 13 },
  accountBadge:    { backgroundColor: 'rgba(168,85,247,0.12)', borderRadius: 8, padding: 8, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)' },
  accountBadgeTxt: { color: market.purple, fontWeight: '800', fontSize: 11, textAlign: 'center' },
});
