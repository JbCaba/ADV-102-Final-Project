import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Animated, Easing, Image, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { market } from '../constants/marketplaceTheme';
import { parseListing, serializeListing } from '../utils/listingCodec';

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

const CATS = ['Devil Fruit', 'Sword', 'Cosmetic', 'Account', 'Material', 'Other'];

export default function SellScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [pieces, setPieces] = useState('1');
  const [desc, setDesc] = useState('');
  const [imgUrl, setImgUrl] = useState('');
  const [cat, setCat] = useState('Other');
  const [robloxEmail, setRobloxEmail] = useState('');
  const [robloxPass, setRobloxPass] = useState('');
  const [editId, setEditId] = useState(null);
  const user = auth.currentUser;

  useEffect(() => {
    const ld = route.params?.listingDoc;
    if (!ld?.id) return;
    const p = parseListing(ld.text);
    setEditId(ld.id);
    if (p.legacy) { setItemName(''); setPrice(''); setPieces('1'); setDesc(p.raw ?? ''); setImgUrl(''); }
    else { setItemName(p.title); setPrice(p.price); setPieces(String(p.pieces ?? 1)); setDesc(p.description); setImgUrl(p.imageUri ?? ''); }
    navigation.setParams({ listingDoc: undefined });
  }, [route.params?.listingDoc]);

  const label = useMemo(() => editId ? 'UPDATE LISTING' : 'POST LISTING', [editId]);
  const showPreview = imgUrl.trim().length > 0 && /^https?:\/\//i.test(imgUrl.trim());

  const notify = (title, msg) => {
    if (Platform.OS === 'web') window.alert(msg); else Alert.alert(title, msg);
  };

  const isAccount = cat === 'Account';

  const handleSave = async () => {
    if (!itemName.trim()) { notify('Missing', 'Enter item name.'); return; }
    if (!price.trim()) { notify('Missing', 'Enter price.'); return; }
    if (isAccount && (!robloxEmail.trim() || !robloxPass.trim())) {
      notify('Missing', 'Enter Roblox email and password for Account listings.'); return;
    }
    if (!user) return;
    const packed = serializeListing(itemName.trim(), price.trim(), desc.trim(), imgUrl.trim(), Number(pieces) || 1);
    try {
      if (editId) {
        const upd = { text: packed, category: cat, updatedAt: serverTimestamp() };
        if (isAccount) { upd.robloxEmail = robloxEmail.trim(); upd.robloxPass = robloxPass.trim(); upd.status = 'pending'; }
        await updateDoc(doc(db, 'notes', editId), upd);
      } else {
        const docData = {
          uid: user.uid, sellerEmail: user.email ?? '',
          text: packed, category: cat,
          status: isAccount ? 'pending' : 'active',
          createdAt: serverTimestamp(),
        };
        if (isAccount) { docData.robloxEmail = robloxEmail.trim(); docData.robloxPass = robloxPass.trim(); }
        await addDoc(collection(db, 'notes'), docData);
      }
      const msg = isAccount ? 'Account listing submitted! Admin will review before it goes live.' : 'Listing posted!';
      notify('✅ Done', msg);
      setItemName(''); setPrice(''); setPieces('1'); setDesc(''); setImgUrl(''); setRobloxEmail(''); setRobloxPass(''); setEditId(null);
      navigation.navigate('Home');
    } catch (e) { notify('Error', e.message); }
  };

  const handleDelete = () => {
    if (!editId) return;
    const go = async () => {
      try { await deleteDoc(doc(db, 'notes', editId)); setEditId(null); setItemName(''); setPrice(''); setPieces('1'); setDesc(''); setImgUrl(''); navigation.navigate('Home'); }
      catch (e) { notify('Error', e.message); }
    };
    if (Platform.OS === 'web') { if (window.confirm('Delete this listing?')) go(); }
    else Alert.alert('Delete?', 'This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: go }]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <Orb size={280} color={market.cyan}   style={{ top: -80, right: -60 }} duration={5000} />
      <Orb size={200} color={market.purple} style={{ bottom: -60, left: -40 }} duration={4200} />
      <View style={s.grid} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={s.center}>
            {/* Header */}
            <View style={s.hdr}>
              <View style={s.hdrGlow} />
              <Text style={s.hdrBadge}>⚓  SAILOR PIECE · SELL</Text>
              <Text style={s.hdrTitle}>{editId ? '✎ Edit Listing' : 'New Listing'}</Text>
              <Text style={s.hdrSub}>Your item goes live instantly on the Market.</Text>
            </View>

            {/* Form */}
            <View style={s.form}>
              {/* Image */}
              <View style={s.field}>
                <Text style={s.lbl}>📸  IMAGE URL</Text>
                <View style={s.imgRow}>
                  <TextInput style={[s.inp, s.flex, Platform.OS === 'web' && { outlineWidth: 0 }]} placeholder="https://…  (optional)" placeholderTextColor="#374151" autoCapitalize="none" autoCorrect={false} value={imgUrl} onChangeText={setImgUrl} />
                  {showPreview && <Image source={{ uri: imgUrl.trim() }} style={s.preview} resizeMode="cover" />}
                </View>
                {!showPreview && <View style={s.phBox}><Text style={s.phTxt}>🖼️ Paste image URL above to preview</Text></View>}
              </View>

              {/* Name */}
              <View style={s.field}>
                <Text style={s.lbl}>🏷️  ITEM NAME</Text>
                <TextInput style={[s.inp, Platform.OS === 'web' && { outlineWidth: 0 }]} placeholder="e.g. Rare Rumble Fruit" placeholderTextColor="#374151" value={itemName} onChangeText={setItemName} />
              </View>

              {/* Category */}
              <View style={s.field}>
                <Text style={s.lbl}>🗂️  CATEGORY</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {CATS.map(c => (
                    <Pressable key={c} style={[s.catChip, cat === c && s.catChipOn]} onPress={() => setCat(c)}>
                      <Text style={[s.catTxt, cat === c && s.catTxtOn]}>{c}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Roblox Account Credentials (only for Account category) */}
              {isAccount && (
                <View style={s.accountBox}>
                  <Text style={s.accountWarn}>🔒 ACCOUNT CREDENTIALS</Text>
                  <Text style={s.accountNote}>These will be verified by admin before going live. Buyer receives credentials after purchase.</Text>
                  <View style={s.field}>
                    <Text style={s.lbl}>📧  ROBLOX EMAIL</Text>
                    <TextInput style={[s.inp, Platform.OS === 'web' && { outlineWidth: 0 }]} placeholder="roblox@email.com" placeholderTextColor="#374151" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" value={robloxEmail} onChangeText={setRobloxEmail} />
                  </View>
                  <View style={s.field}>
                    <Text style={s.lbl}>🔑  ROBLOX PASSWORD</Text>
                    <TextInput style={[s.inp, Platform.OS === 'web' && { outlineWidth: 0 }]} placeholder="••••••••" placeholderTextColor="#374151" secureTextEntry value={robloxPass} onChangeText={setRobloxPass} />
                  </View>
                  <Text style={s.accountPending}>⏳ Account listings require admin approval</Text>
                </View>
              )}

              {/* Price */}
              <View style={s.field}>
                <Text style={s.lbl}>💰  PRICE (R$)</Text>
                <View style={s.priceRow}>
                  <View style={s.prePfx}><Text style={s.prePfxTxt}>R$</Text></View>
                  <TextInput style={[s.inp, s.flex, { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }, Platform.OS === 'web' && { outlineWidth: 0 }]} placeholder="350" placeholderTextColor="#374151" keyboardType="numeric" value={price} onChangeText={setPrice} />
                </View>
              </View>

              {/* Pieces */}
              <View style={s.field}>
                <Text style={s.lbl}>📦  PIECES (Quantity)</Text>
                <View style={s.priceRow}>
                  <View style={s.prePfx}><Text style={s.prePfxTxt}>x</Text></View>
                  <TextInput style={[s.inp, s.flex, { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }, Platform.OS === 'web' && { outlineWidth: 0 }]} placeholder="1" placeholderTextColor="#374151" keyboardType="numeric" value={pieces} onChangeText={setPieces} />
                </View>
                <Text style={s.fieldHint}>How many copies of this item are you selling?</Text>
              </View>

              {/* Description */}
              <View style={s.field}>
                <Text style={s.lbl}>📝  DETAILS</Text>
                <TextInput style={[s.inp, s.multi, Platform.OS === 'web' && { outlineWidth: 0 }]} placeholder="Stats, rarity, your Roblox username…" placeholderTextColor="#374151" multiline textAlignVertical="top" value={desc} onChangeText={setDesc} />
              </View>

              <View style={s.divider} />

              {/* Buttons */}
              <Pressable style={s.primaryBtn} onPress={handleSave}>
                <Text style={s.primaryTxt}>🚀  {label}</Text>
              </Pressable>
              {editId && <>
                <Pressable style={s.secBtn} onPress={() => { setEditId(null); setItemName(''); setPrice(''); setDesc(''); setImgUrl(''); }}>
                  <Text style={s.secTxt}>Cancel Edit</Text>
                </Pressable>
                <Pressable style={s.delBtn} onPress={handleDelete}>
                  <Text style={s.delTxt}>🗑  Delete Listing</Text>
                </Pressable>
              </>}
            </View>

            {/* Tips */}
            <View style={s.tips}>
              <Text style={s.tipsTitle}>💡 TIPS</Text>
              <Text style={s.tipsTxt}>• Use a clear image URL for more buyer clicks{'\n'}• Add your Roblox username in the description{'\n'}• Common fruits: 300–800 R$  ·  Legendary: 3k–10k R$</Text>
            </View>
            <View style={{ height: 30 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050c18' },
  scroll: { paddingBottom: 20 },
  center: { maxWidth: 540, width: '100%', alignSelf: 'center' },
  grid: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    ...Platform.select({ web: { backgroundImage: 'linear-gradient(rgba(0,240,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,240,255,0.03) 1px,transparent 1px)', backgroundSize: '40px 40px' } }),
  },

  hdr: {
    backgroundColor: 'rgba(5,12,24,0.9)', paddingHorizontal: 20,
    paddingTop: 22, paddingBottom: 28, overflow: 'hidden',
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,240,255,0.1)',
    ...Platform.select({ web: { backdropFilter: 'blur(12px)' } }),
  },
  hdrGlow: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: market.cyan, opacity: 0.04, top: -60, right: -40 },
  hdrBadge: { fontSize: Platform.select({ web: 12, default: 9 }), fontWeight: '900', color: market.cyan, letterSpacing: 1.5, marginBottom: 8 },
  hdrTitle: { fontSize: Platform.select({ web: 32, default: 24 }), fontWeight: '900', color: '#fff', letterSpacing: -0.3, marginBottom: 6 },
  hdrSub: { fontSize: Platform.select({ web: 15, default: 12 }), color: 'rgba(255,255,255,0.4)' },

  form: {
    backgroundColor: 'rgba(13,20,40,0.85)', marginHorizontal: 12, marginTop: 14,
    borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(0,240,255,0.1)',
    ...Platform.select({ web: { backdropFilter: 'blur(8px)' } }),
  },
  field: { marginBottom: 16 },
  lbl: { fontSize: Platform.select({ web: 13, default: 9 }), fontWeight: '900', color: market.cyan, letterSpacing: 1, marginBottom: 7 },
  inp: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: Platform.select({ web: 16, default: 13 }), color: '#fff',
  },
  flex: { flex: 1 },
  multi: { minHeight: 80, paddingTop: 10 },
  imgRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  preview: { width: 56, height: 56, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,240,255,0.2)' },
  phBox: { marginTop: 6, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  phTxt: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },

  catChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  catChipOn: { backgroundColor: market.cyan, borderColor: market.cyan, ...Platform.select({ web: { boxShadow: '0 0 10px rgba(0,240,255,0.3)' } }) },
  catTxt: { fontSize: Platform.select({ web: 14, default: 11 }), fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  catTxtOn: { color: '#050c18' },

  priceRow: { flexDirection: 'row', overflow: 'hidden', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  prePfx: { backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 12, justifyContent: 'center', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)' },
  prePfxTxt: { fontSize: Platform.select({ web: 16, default: 13 }), fontWeight: '900', color: market.gold },
  fieldHint: { fontSize: Platform.select({ web: 13, default: 10 }), color: 'rgba(255,255,255,0.3)', marginTop: 4, fontStyle: 'italic' },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 12 },
  primaryBtn: {
    backgroundColor: market.cyan, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 8,
    ...Platform.select({ web: { boxShadow: '0 0 20px rgba(0,240,255,0.3)', cursor: 'pointer' } }),
  },
  primaryTxt: { color: '#050c18', fontWeight: '900', fontSize: Platform.select({ web: 17, default: 13 }), letterSpacing: 0.5 },
  secBtn: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingVertical: 11, alignItems: 'center', marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.04)' },
  secTxt: { color: 'rgba(255,255,255,0.4)', fontWeight: '700', fontSize: Platform.select({ web: 15, default: 12 }) },
  delBtn: { backgroundColor: 'rgba(255,59,92,0.08)', borderRadius: 12, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,59,92,0.25)' },
  delTxt: { color: market.red, fontWeight: '800', fontSize: Platform.select({ web: 15, default: 12 }) },

  tips: { marginHorizontal: 12, marginTop: 12, borderRadius: 12, backgroundColor: 'rgba(13,20,40,0.85)', padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  tipsTitle: { fontSize: 9, fontWeight: '900', color: market.gold, letterSpacing: 1, marginBottom: 8 },
  tipsTxt: { fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 19 },

  accountBox: { backgroundColor: 'rgba(251,191,36,0.05)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)', marginBottom: 8 },
  accountWarn: { fontSize: 10, fontWeight: '900', color: market.gold, letterSpacing: 1, marginBottom: 6 },
  accountNote: { fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 16, marginBottom: 10 },
  accountPending: { fontSize: 10, color: market.gold, fontWeight: '700', textAlign: 'center', marginTop: 4 },
});
