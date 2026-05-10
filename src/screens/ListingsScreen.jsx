import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Animated, Easing, FlatList, Image, Platform,
  Pressable, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { market } from '../constants/marketplaceTheme';
import { parseListing } from '../utils/listingCodec';
import { useMyListings } from '../hooks/useMyListings';

const THUMB = 80;

function Orb({ size, color, style, duration = 4000 }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(scale, { toValue: 1.18, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: 0.09, position: 'absolute', transform: [{ scale }] }, style]} />;
}

function ListingCard({ item, onEdit, onDelete, isSelected, onSelect }) {
  const p = parseListing(item.text);
  const title = p.legacy ? 'Note' : p.title || '—';
  const price = p.legacy ? null : p.price;
  const img = !p.legacy && p.imageUri && /^https?:\/\//i.test(p.imageUri) ? p.imageUri : null;
  const scale = useRef(new Animated.Value(1)).current;

  const onHoverIn  = () => Animated.spring(scale, { toValue: 1.05, useNativeDriver: true, speed: 22, bounciness: 8 }).start();
  const onHoverOut = () => Animated.spring(scale, { toValue: isSelected ? 1.08 : 1, useNativeDriver: true, speed: 22, bounciness: 6 }).start();
  const onPressIn  = () => Animated.spring(scale, { toValue: 1.12, useNativeDriver: true, speed: 30, bounciness: 12 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: isSelected ? 1.08 : 1, useNativeDriver: true, speed: 22, bounciness: 6 }).start();

  const prev = useRef(isSelected);
  if (prev.current !== isSelected) {
    prev.current = isSelected;
    Animated.spring(scale, { toValue: isSelected ? 1.08 : 1, useNativeDriver: true, speed: 18, bounciness: 10 }).start();
  }

  return (
    <Animated.View style={[s.cardWrap, { transform: [{ scale }] }, isSelected && s.cardWrapSel]}>
      <Pressable
        style={[s.card, isSelected && s.cardSel]}
        onPress={() => onSelect(isSelected ? null : item.id)}
        onHoverIn={onHoverIn} onHoverOut={onHoverOut}
        onPressIn={onPressIn} onPressOut={onPressOut}
      >
        {isSelected && <View style={s.selRibbon} />}
        <View style={s.row}>
          <View style={s.thumbFrame}>
            {img ? <Image source={{ uri: img }} style={s.thumbImg} resizeMode="cover" /> : <View style={s.thumbPh}><Text style={{ fontSize: 18 }}>⚓</Text></View>}
          </View>
          <View style={s.main}>
            <Text style={s.title} numberOfLines={2}>{title}</Text>
            {price ? <Text style={s.price}>{price} <Text style={{ fontSize: 8, color: market.gold }}>R$</Text></Text> : <Text style={s.priceMuted}>—</Text>}
          </View>
          <View style={s.actions}>
            <Pressable style={({ pressed }) => [s.editChip, pressed && { opacity: 0.7 }]} onPress={() => onEdit(item)}><Text style={s.editTxt}>✎ Edit</Text></Pressable>
            <Pressable style={({ pressed }) => [s.delChip, pressed && { opacity: 0.7 }]} onPress={() => onDelete(item.id)}><Text style={s.delTxt}>✕ Del</Text></Pressable>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const COLS = 2;
export default function ListingsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const notes = useMyListings();
  const { width } = useWindowDimensions();
  const searchQ = route.params?.searchQuery ?? '';
  const [selId, setSelId] = useState(null);

  const filtered = useMemo(() => {
    const q = String(searchQ ?? '').trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(n => { const p = parseListing(n.text); const b = p.legacy ? String(p.raw ?? '') : `${p.title} ${p.price} ${p.description}`; return b.toLowerCase().includes(q); });
  }, [notes, searchQ]);

  const GAP = 8; const HP = 10;
  const tileW = (Math.min(width, 960) - HP * 2 - GAP) / COLS;

  const handleDelete = id => {
    const go = async () => { try { await deleteDoc(doc(db, 'notes', id)); if (selId === id) setSelId(null); } catch (e) { if (Platform.OS === 'web') window.alert(e.message); else Alert.alert('Error', e.message); } };
    if (Platform.OS === 'web') { if (window.confirm('Delete this listing?')) go(); }
    else Alert.alert('Delete?', 'Cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: go }]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />

      {/* Animated background */}
      <Orb size={320} color={market.cyan}   style={{ top: -100, right: -80 }}  duration={5000} />
      <Orb size={240} color={market.purple} style={{ bottom: -80, left: -60 }} duration={4200} />
      <Orb size={160} color={market.gold}   style={{ top: '50%', left: '40%' }} duration={3600} />
      <View style={s.grid} />

      <View style={s.center}>
        <View style={s.hdr}>
          <View>
            <Text style={s.hdrEye}>YOUR STALL</Text>
            <Text style={s.hdrTitle}>My Listings</Text>
          </View>
          <Pressable style={s.sellBtn} onPress={() => navigation.navigate('Sell')}>
            <Text style={s.sellBtnTxt}>+ New</Text>
          </Pressable>
        </View>
        <FlatList
          data={filtered}
          numColumns={COLS}
          key={`c${COLS}`}
          keyExtractor={r => r.id}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={[s.grid, { paddingHorizontal: HP }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={{ fontSize: 32 }}>📦</Text>
              <Text style={s.emptyT}>{notes.length > 0 ? 'No matches' : 'No listings yet'}</Text>
              <Text style={s.emptyS}>{notes.length > 0 ? 'Clear search filter.' : 'Tap "+ New" to create one.'}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={{ width: tileW }}>
              <ListingCard item={item} onEdit={ld => navigation.navigate('Sell', { listingDoc: ld })} onDelete={handleDelete} isSelected={selId === item.id} onSelect={setSelId} />
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050c18' },
  center: { flex: 1, maxWidth: 960, width: '100%', alignSelf: 'center' },
  grid: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    ...Platform.select({ web: {
      backgroundImage: 'linear-gradient(rgba(0,240,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,240,255,0.03) 1px,transparent 1px)',
      backgroundSize: '40px 40px',
    }}),
  },

  hdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: 'rgba(5,12,24,0.95)', borderBottomWidth: 1, borderBottomColor: 'rgba(0,240,255,0.1)',
    ...Platform.select({ web: { backdropFilter: 'blur(12px)' } }),
  },
  hdrEye: { fontSize: Platform.select({ web: 12, default: 8 }), fontWeight: '900', color: market.cyan, letterSpacing: 1.2, marginBottom: 2 },
  hdrTitle: { fontSize: Platform.select({ web: 24, default: 18 }), fontWeight: '900', color: '#fff' },
  sellBtn: { backgroundColor: market.cyan, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, ...Platform.select({ web: { boxShadow: '0 0 12px rgba(0,240,255,0.3)', cursor: 'pointer' } }) },
  sellBtnTxt: { color: '#050c18', fontWeight: '900', fontSize: Platform.select({ web: 15, default: 12 }) },

  grid: { paddingTop: 10, paddingBottom: 24 },

  cardWrap: {
    borderRadius: 12, marginBottom: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 4 },
      web: { boxShadow: '0 2px 16px rgba(0,0,0,0.5)', transition: 'transform 0.12s ease', cursor: 'pointer' },
    }),
  },
  cardWrapSel: { ...Platform.select({ web: { boxShadow: `0 0 0 2px ${market.cyan}, 0 4px 20px rgba(0,240,255,0.2)` } }) },
  card: { backgroundColor: 'rgba(13,20,40,0.9)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', overflow: 'hidden', ...Platform.select({ web: { backdropFilter: 'blur(8px)' } }) },
  cardSel: { borderColor: market.cyan },
  selRibbon: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, backgroundColor: market.cyan, zIndex: 2 },

  row: { flexDirection: 'row', padding: 10, paddingVertical: 12, gap: 10, alignItems: 'center' },
  thumbFrame: {
    width: THUMB, height: THUMB, borderRadius: 10, overflow: 'hidden',
    backgroundColor: market.darkSurface, borderWidth: 1.5, borderColor: market.borderGlow ?? market.cyan,
    ...Platform.select({ web: { boxShadow: '0 0 8px rgba(0,240,255,0.2)' } }),
  },
  thumbImg: { width: THUMB, height: THUMB },
  thumbPh: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1f35' },

  main: { flex: 1, justifyContent: 'center', gap: 3 },
  title: { fontSize: Platform.select({ web: 15, default: 11 }), fontWeight: '700', color: '#fff', lineHeight: Platform.select({ web: 20, default: 14 }) },
  price: { fontSize: Platform.select({ web: 17, default: 13 }), fontWeight: '900', color: market.gold },
  priceMuted: { fontSize: Platform.select({ web: 13, default: 10 }), color: 'rgba(255,255,255,0.3)' },

  actions: { flexDirection: 'column', gap: 5, justifyContent: 'center', alignItems: 'stretch' },
  editChip: { paddingVertical: 4, paddingHorizontal: 7, borderRadius: 6, backgroundColor: 'rgba(0,240,255,0.1)', borderWidth: 1, borderColor: 'rgba(0,240,255,0.25)', alignItems: 'center', ...Platform.select({ web: { cursor: 'pointer' } }) },
  editTxt: { color: market.cyan, fontWeight: '700', fontSize: Platform.select({ web: 13, default: 9 }) },
  delChip: { paddingVertical: 4, paddingHorizontal: 7, borderRadius: 6, backgroundColor: 'rgba(255,59,92,0.1)', borderWidth: 1, borderColor: 'rgba(255,59,92,0.25)', alignItems: 'center', ...Platform.select({ web: { cursor: 'pointer' } }) },
  delTxt: { color: market.red, fontWeight: '700', fontSize: Platform.select({ web: 13, default: 9 }) },

  empty: { alignItems: 'center', paddingVertical: 50, gap: 8 },
  emptyT: { fontSize: Platform.select({ web: 20, default: 15 }), fontWeight: '800', color: 'rgba(255,255,255,0.5)' },
  emptyS: { fontSize: Platform.select({ web: 16, default: 12 }), color: 'rgba(255,255,255,0.3)' },
});
