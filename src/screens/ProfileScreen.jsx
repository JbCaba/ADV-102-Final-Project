import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Animated, Easing, Image, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { auth, db } from '../config/firebase';
import { useMyListings } from '../hooks/useMyListings';
import { useUserBalance } from '../hooks/useUserBalance';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { useMyPurchases } from '../hooks/useMyPurchases';
import { parseListing } from '../utils/listingCodec';
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

export default function ProfileScreen() {
  const navigation = useNavigation();
  const notes = useMyListings();
  const balance = useUserBalance();
  const isAdmin = useIsAdmin();
  const purchases = useMyPurchases();
  const [loggingOut, setLoggingOut] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [editingPhoto, setEditingPhoto] = useState(false);
  const [photoInput, setPhotoInput] = useState('');
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [showAllPurchases, setShowAllPurchases] = useState(false);

  const user = auth.currentUser;
  const email = user?.email ?? '';
  const displayName = useMemo(() => {
    const l = email.split('@')[0];
    return l.split(/[._-]/).map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ');
  }, [email]);
  const initial = displayName.charAt(0) || '?';
  const previews = notes.slice(0, 4);
  const visiblePurchases = showAllPurchases ? purchases : purchases.slice(0, 4);

  // Load photo from Firestore
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), snap => {
      setPhotoUrl(snap.data()?.photoUrl ?? '');
    });
    return unsub;
  }, [user?.uid]);

  const showPhoto = photoUrl && /^https?:\/\//i.test(photoUrl);

  const handleSavePhoto = async () => {
    if (!user) return;
    setSavingPhoto(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { photoUrl: photoInput.trim() });
      setPhotoUrl(photoInput.trim()); setEditingPhoto(false);
    } catch (e) {
      if (Platform.OS === 'web') window.alert(e.message); else Alert.alert('Error', e.message);
    } finally { setSavingPhoto(false); }
  };

  const doSignOut = async () => {
    setLoggingOut(true);
    try { await signOut(auth); }
    catch (e) {
      if (Platform.OS === 'web') window.alert(e.message); else Alert.alert('Error', e.message);
      setLoggingOut(false);
    }
  };
  const handleSignOut = () => {
    if (Platform.OS === 'web') { if (window.confirm('Sign out?')) doSignOut(); }
    else Alert.alert('Sign out', 'Are you sure?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: doSignOut }]);
  };

  const totalSpent = purchases.reduce((a, p) => a + (p.price ?? 0), 0);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <Orb size={300} color={market.cyan}   style={{ top: -80, right: -80 }}   duration={5000} />
      <Orb size={220} color={market.purple} style={{ bottom: -60, left: -60 }} duration={4200} />
      <Orb size={160} color={market.gold}   style={{ top: '40%', left: '60%' }} duration={3500} />
      <View style={s.grid} />

      {/* Header */}
      <View style={s.hdr}>
        <Text style={s.hdrT}>👤 Profile</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {isAdmin && <View style={s.adminBadge}><Text style={s.adminBadgeTxt}>🛡️ ADMIN</Text></View>}
          <Pressable style={[s.logBtn, loggingOut && { opacity: 0.5 }]} onPress={handleSignOut} disabled={loggingOut}>
            <Text style={s.logTxt}>{loggingOut ? '…' : 'Sign out'}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── Avatar ─────────────────────────────────────── */}
        <View style={s.avatarCard}>
          <View style={s.avatarGlow} />
          <Pressable style={s.avatarWrap} onPress={() => { setEditingPhoto(true); setPhotoInput(photoUrl); }}>
            {showPhoto
              ? <Image source={{ uri: photoUrl }} style={s.avatarImg} resizeMode="cover" />
              : <View style={s.avatarCircle}><Text style={s.avatarLetter}>{initial}</Text></View>}
            <View style={s.cameraBadge}><Text style={s.cameraIcon}>📷</Text></View>
          </Pressable>
          <Text style={s.tapHint}>Tap avatar to set profile photo</Text>
          <Text style={s.userName}>{displayName}</Text>
          <Text style={s.userEmail}>{email}</Text>
          {isAdmin && <Text style={s.adminTag}>⚡ Server Administrator</Text>}
        </View>

        {/* ── Photo editor ───────────────────────────────── */}
        {editingPhoto && (
          <View style={s.photoEditor}>
            <Text style={s.photoEditorTitle}>📸 SET PROFILE PHOTO</Text>
            <Text style={s.photoEditorSub}>Paste any public image URL (imgur, Discord CDN, etc.)</Text>
            <TextInput
              style={[s.photoInput, Platform.OS === 'web' && { outlineWidth: 0 }]}
              placeholder="https://i.imgur.com/yourphoto.jpg"
              placeholderTextColor="#374151"
              autoCapitalize="none" autoCorrect={false}
              value={photoInput} onChangeText={setPhotoInput}
            />
            {photoInput && /^https?:\/\//i.test(photoInput) && (
              <Image source={{ uri: photoInput }} style={s.photoPreview} resizeMode="cover" />
            )}
            <View style={s.photoActions}>
              <Pressable style={s.savePhotoBtn} onPress={handleSavePhoto} disabled={savingPhoto}>
                <Text style={s.savePhotoTxt}>{savingPhoto ? '⏳ Saving…' : '✓ Save Photo'}</Text>
              </Pressable>
              <Pressable style={s.cancelPhotoBtn} onPress={() => setEditingPhoto(false)}>
                <Text style={s.cancelPhotoTxt}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Stats ──────────────────────────────────────── */}
        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statVal}>{notes.length}</Text>
            <Text style={s.statLbl}>LISTED</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.stat}>
            <Text style={[s.statVal, { color: market.gold }]}>${Number(balance).toLocaleString()}</Text>
            <Text style={s.statLbl}>COINS</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.stat}>
            <Text style={[s.statVal, { color: market.purple }]}>{purchases.length}</Text>
            <Text style={s.statLbl}>BOUGHT</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.stat}>
            <Text style={[s.statVal, { color: market.red, fontSize: 13 }]}>${totalSpent.toLocaleString()}</Text>
            <Text style={s.statLbl}>SPENT</Text>
          </View>
        </View>

        {/* ── Quick actions ──────────────────────────────── */}
        <View style={s.sec}>
          <Text style={s.secTitle}>⚡ QUICK ACTIONS</Text>
          <View style={s.actRow}>
            <Pressable style={[s.actBtn, { borderColor: market.cyan }]} onPress={() => navigation.navigate('Sell')}><Text style={s.actE}>⚓</Text><Text style={[s.actL, { color: market.cyan }]}>Sell</Text></Pressable>
            <Pressable style={[s.actBtn, { borderColor: market.gold }]} onPress={() => navigation.navigate('TopUp')}><Text style={s.actE}>🪙</Text><Text style={[s.actL, { color: market.gold }]}>Top Up</Text></Pressable>
            <Pressable style={[s.actBtn, { borderColor: market.purple }]} onPress={() => navigation.navigate('Listings')}><Text style={s.actE}>📋</Text><Text style={[s.actL, { color: market.purple }]}>Items</Text></Pressable>
            <Pressable style={[s.actBtn, { borderColor: market.green }]} onPress={() => navigation.navigate('Home')}><Text style={s.actE}>🏪</Text><Text style={[s.actL, { color: market.green }]}>Market</Text></Pressable>
          </View>
        </View>

        {/* ── Purchase History ────────────────────────────── */}
        <View style={s.sec}>
          <View style={s.secHead}>
            <Text style={s.secTitle}>🛒 PURCHASE HISTORY</Text>
            {purchases.length > 4 && (
              <Pressable onPress={() => setShowAllPurchases(v => !v)}>
                <Text style={s.seeAll}>{showAllPurchases ? 'Show less ↑' : `See all (${purchases.length}) →`}</Text>
              </Pressable>
            )}
          </View>
          {purchases.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={{ fontSize: 26 }}>🛒</Text>
              <Text style={s.emptyT}>No purchases yet</Text>
              <Text style={s.emptyS}>Browse the market and buy something!</Text>
              <Pressable style={s.goMarketBtn} onPress={() => navigation.navigate('Home')}>
                <Text style={s.goMarketTxt}>Go to Market →</Text>
              </Pressable>
            </View>
          ) : (
            visiblePurchases.map(p => {
              const date = p.purchasedAt?.seconds
                ? new Date(p.purchasedAt.seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                : '—';
              const sellerName = p.sellerEmail?.split('@')[0] ?? 'seller';
              const hasImg = p.imageUri && /^https?:\/\//i.test(p.imageUri);
              return (
                <View key={p.id} style={s.purchaseItem}>
                  {hasImg
                    ? <Image source={{ uri: p.imageUri }} style={s.purchaseImg} resizeMode="cover" />
                    : <View style={s.purchaseIcon}><Text style={{ fontSize: 20 }}>🎮</Text></View>}
                  <View style={s.purchaseInfo}>
                    <Text style={s.purchaseName} numberOfLines={1}>{p.itemName || 'Item'}</Text>
                    {p.itemDescription ? <Text style={s.purchaseDesc} numberOfLines={1}>{p.itemDescription}</Text> : null}
                    <Text style={s.purchaseFrom}>from @{sellerName}</Text>
                    <Text style={s.purchaseDate}>{date}</Text>
                  </View>
                  <View style={s.purchasePriceBadge}>
                    <Text style={s.purchasePrice}>-${Number(p.price ?? 0).toLocaleString()}</Text>
                    <Text style={s.purchasePriceLbl}>R$</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ── My Listings preview ────────────────────────── */}
        <View style={s.sec}>
          <View style={s.secHead}>
            <Text style={s.secTitle}>🎮 MY LISTINGS</Text>
            {previews.length > 0 && (
              <Pressable onPress={() => navigation.navigate('Listings')}>
                <Text style={s.seeAll}>See all →</Text>
              </Pressable>
            )}
          </View>
          {previews.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={{ fontSize: 22 }}>📦</Text>
              <Text style={s.emptyT}>No listings yet</Text>
            </View>
          ) : previews.map(item => {
            const p = parseListing(item.text);
            const title = p.legacy ? 'Note' : p.title || 'Listing';
            const price = p.legacy ? '' : p.price;
            const img = !p.legacy && p.imageUri && /^https?:\/\//i.test(p.imageUri) ? p.imageUri : null;
            return (
              <Pressable key={item.id} style={s.listItem} onPress={() => navigation.navigate('Listings')}>
                {img ? <Image source={{ uri: img }} style={s.listImg} resizeMode="cover" /> : <View style={s.listImgPh}><Text style={{ fontSize: 13 }}>⚓</Text></View>}
                <View style={s.listInfo}><Text style={s.listTitle} numberOfLines={1}>{title}</Text></View>
                {price ? <Text style={s.listPrice}>{price} R$</Text> : null}
              </Pressable>
            );
          })}
        </View>

        {/* ── Account ────────────────────────────────────── */}
        <View style={s.sec}>
          <Text style={s.secTitle}>🔒 ACCOUNT</Text>
          <View style={s.detCard}>
            <View style={s.detRow}><Text style={s.detI}>✉</Text><Text style={s.detV} numberOfLines={1}>{email}</Text></View>
            <View style={s.detDiv} />
            <View style={s.detRow}><Text style={s.detI}>🎮</Text><Text style={s.detV}>Roblox · Sailor Piece</Text></View>
            <View style={s.detDiv} />
            <View style={s.detRow}><Text style={s.detI}>🛡️</Text><Text style={s.detV}>{isAdmin ? 'Administrator' : 'Standard Trader'}</Text></View>
          </View>
        </View>

        {/* ── Sign out ───────────────────────────────────── */}
        <View style={s.sec}>
          <Pressable style={[s.signOut, loggingOut && { opacity: 0.5 }]} onPress={handleSignOut} disabled={loggingOut}>
            <Text style={s.signOutTxt}>{loggingOut ? '⏳ Signing out…' : '⎋  SIGN OUT'}</Text>
          </Pressable>
        </View>
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050c18' },
  scroll: { flex: 1 },
  content: { maxWidth: 480, width: '100%', alignSelf: 'center', paddingBottom: 40 },
  grid: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    ...Platform.select({ web: { backgroundImage: 'linear-gradient(rgba(0,240,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,240,255,0.03) 1px,transparent 1px)', backgroundSize: '40px 40px' } }),
  },

  hdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(5,12,24,0.9)', borderBottomWidth: 1, borderBottomColor: 'rgba(0,240,255,0.1)', ...Platform.select({ web: { backdropFilter: 'blur(12px)' } }) },
  hdrT: { fontSize: 16, fontWeight: '900', color: '#fff' },
  adminBadge: { backgroundColor: 'rgba(251,191,36,0.12)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)' },
  adminBadgeTxt: { color: market.gold, fontWeight: '900', fontSize: 10, letterSpacing: 0.5 },
  logBtn: { backgroundColor: 'rgba(255,59,92,0.1)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,59,92,0.25)' },
  logTxt: { color: market.red, fontWeight: '800', fontSize: 11 },

  avatarCard: { alignItems: 'center', paddingVertical: 24, backgroundColor: 'rgba(5,12,24,0.9)', borderBottomWidth: 1, borderBottomColor: 'rgba(0,240,255,0.1)', overflow: 'hidden', ...Platform.select({ web: { backdropFilter: 'blur(12px)' } }) },
  avatarGlow: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: market.cyan, opacity: 0.06, top: -50 },
  avatarWrap: { position: 'relative', marginBottom: 6 },
  avatarImg: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: market.cyan },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: market.cyan, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(0,240,255,0.4)', ...Platform.select({ web: { boxShadow: '0 0 20px rgba(0,240,255,0.3)' } }) },
  avatarLetter: { fontSize: 28, fontWeight: '900', color: '#050c18' },
  cameraBadge: { position: 'absolute', bottom: 0, right: -4, backgroundColor: 'rgba(13,20,40,0.9)', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cameraIcon: { fontSize: 11 },
  tapHint: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 8, fontStyle: 'italic' },
  userName: { fontSize: Platform.select({ web: 24, default: 18 }), fontWeight: '900', color: '#fff', marginBottom: 2, textAlign: 'center' },
  userEmail: { fontSize: Platform.select({ web: 15, default: 12 }), color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  adminTag: { fontSize: Platform.select({ web: 13, default: 10 }), color: market.gold, fontWeight: '800', marginTop: 6, letterSpacing: 0.5 },

  photoEditor: { marginHorizontal: 14, marginTop: 12, backgroundColor: 'rgba(13,20,40,0.9)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(0,240,255,0.15)', gap: 10 },
  photoEditorTitle: { fontSize: 9, fontWeight: '900', color: market.cyan, letterSpacing: 1 },
  photoEditorSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 16 },
  photoInput: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 9, fontSize: 12, color: '#fff' },
  photoPreview: { width: '100%', height: 120, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)' },
  photoActions: { flexDirection: 'row', gap: 8 },
  savePhotoBtn: { flex: 1, backgroundColor: market.cyan, borderRadius: 10, paddingVertical: 10, alignItems: 'center', ...Platform.select({ web: { boxShadow: '0 0 12px rgba(0,240,255,0.3)', cursor: 'pointer' } }) },
  savePhotoTxt: { color: '#050c18', fontWeight: '900', fontSize: 12 },
  cancelPhotoBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cancelPhotoTxt: { color: 'rgba(255,255,255,0.4)', fontWeight: '700', fontSize: 12 },

  statsRow: { flexDirection: 'row', backgroundColor: 'rgba(13,20,40,0.85)', marginHorizontal: 14, marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,240,255,0.1)', ...Platform.select({ web: { backdropFilter: 'blur(8px)' } }) },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statVal: { fontSize: Platform.select({ web: 20, default: 16 }), fontWeight: '900', color: market.cyan, marginBottom: 2 },
  statLbl: { fontSize: Platform.select({ web: 10, default: 7 }), color: 'rgba(255,255,255,0.3)', fontWeight: '800', letterSpacing: 0.5 },
  statDiv: { width: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 10 },

  sec: { paddingHorizontal: 14, marginTop: 14 },
  secHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  secTitle: { fontSize: Platform.select({ web: 12, default: 9 }), fontWeight: '900', color: market.cyan, letterSpacing: 1, marginBottom: 10 },
  seeAll: { fontSize: Platform.select({ web: 13, default: 10 }), fontWeight: '700', color: market.cyan },

  actRow: { flexDirection: 'row', gap: 8 },
  actBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, ...Platform.select({ web: { cursor: 'pointer' } }) },
  actE: { fontSize: 16 },
  actL: { fontSize: 9, fontWeight: '900', letterSpacing: 0.3 },

  purchaseItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(13,20,40,0.85)', borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: 'rgba(168,85,247,0.15)',
    borderLeftWidth: 3, borderLeftColor: market.purple,
    ...Platform.select({ web: { backdropFilter: 'blur(8px)' } }),
  },
  purchaseIcon: { width: 48, height: 48, borderRadius: 10, backgroundColor: 'rgba(168,85,247,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(168,85,247,0.2)' },
  purchaseImg: { width: 48, height: 48, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)' },
  purchaseInfo: { flex: 1, gap: 2 },
  purchaseDesc: { fontSize: 10, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' },
  purchaseName: { fontSize: Platform.select({ web: 16, default: 13 }), fontWeight: '800', color: '#fff' },
  purchaseFrom: { fontSize: Platform.select({ web: 13, default: 10 }), color: market.cyan, fontWeight: '600' },
  purchaseDate: { fontSize: Platform.select({ web: 13, default: 10 }), color: 'rgba(255,255,255,0.3)' },
  purchasePriceBadge: { alignItems: 'flex-end' },
  purchasePrice: { fontSize: Platform.select({ web: 18, default: 14 }), fontWeight: '900', color: market.red },
  purchasePriceLbl: { fontSize: Platform.select({ web: 12, default: 9 }), color: 'rgba(255,255,255,0.3)', fontWeight: '700' },

  emptyCard: { backgroundColor: 'rgba(13,20,40,0.85)', borderRadius: 12, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', gap: 6 },
  emptyT: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  emptyS: { fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center' },
  goMarketBtn: { backgroundColor: market.cyan, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8, marginTop: 4, ...Platform.select({ web: { boxShadow: '0 0 12px rgba(0,240,255,0.3)', cursor: 'pointer' } }) },
  goMarketTxt: { color: '#050c18', fontWeight: '900', fontSize: 12 },

  listItem: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(13,20,40,0.85)', borderRadius: 10, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  listImg: { width: 34, height: 34, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.04)' },
  listImgPh: { width: 34, height: 34, borderRadius: 6, backgroundColor: '#0d1428', alignItems: 'center', justifyContent: 'center' },
  listInfo: { flex: 1 },
  listTitle: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  listPrice: { fontSize: 12, fontWeight: '900', color: market.gold },

  detCard: { backgroundColor: 'rgba(13,20,40,0.85)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' },
  detRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11 },
  detI: { fontSize: 13, width: 20, textAlign: 'center' },
  detV: { flex: 1, fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  detDiv: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginLeft: 42 },

  signOut: { backgroundColor: 'rgba(255,59,92,0.08)', borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,59,92,0.25)', ...Platform.select({ web: { cursor: 'pointer' } }) },
  signOutTxt: { color: market.red, fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
});
