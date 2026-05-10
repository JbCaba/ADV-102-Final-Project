import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  collection,
  doc,
  increment,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { useUserBalance } from '../hooks/useUserBalance';
import { seedItemsIfEmpty } from '../utils/seedItems';

const RARITY_COLORS = {
  Common: '#6b7280',
  Uncommon: '#16a34a',
  Rare: '#2563eb',
  Epic: '#7c3aed',
  Legendary: '#f59e0b',
};

const RARITY_BG = {
  Common: '#f3f4f6',
  Uncommon: '#dcfce7',
  Rare: '#dbeafe',
  Epic: '#ede9fe',
  Legendary: '#fef3c7',
};

// ── Animated item card ──────────────────────────────────────────────────────
function ItemCard({ item, onPress, tileWidth }) {
  const scale = useRef(new Animated.Value(1)).current;
  const shadow = useRef(new Animated.Value(0)).current;

  const onHoverIn = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1.06, useNativeDriver: true, speed: 20, bounciness: 8 }),
      Animated.timing(shadow, { toValue: 1, duration: 180, useNativeDriver: false }),
    ]).start();
  };
  const onHoverOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }),
      Animated.timing(shadow, { toValue: 0, duration: 180, useNativeDriver: false }),
    ]).start();
  };
  const onPressIn = () => {
    Animated.spring(scale, { toValue: 1.12, useNativeDriver: true, speed: 30, bounciness: 10 }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();
  };

  const elevationAnim = shadow.interpolate({ inputRange: [0, 1], outputRange: [2, 12] });

  return (
    <Animated.View
      style={[
        styles.cardWrap,
        { width: tileWidth, transform: [{ scale }] },
        Platform.OS !== 'web' && { elevation: elevationAnim },
      ]}
    >
      <Pressable
        onPress={() => onPress(item)}
        onHoverIn={onHoverIn}
        onHoverOut={onHoverOut}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.card}
      >
        {/* Colour badge top-right */}
        <View style={[styles.rarityDot, { backgroundColor: RARITY_COLORS[item.rarity] ?? '#6b7280' }]} />

        {/* Emoji hero */}
        <View style={[styles.emojiBox, { backgroundColor: item.color + '22' }]}>
          <Text style={styles.emojiText}>{item.emoji}</Text>
        </View>

        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>

        <View style={[styles.rarityChip, { backgroundColor: RARITY_BG[item.rarity] ?? '#f3f4f6' }]}>
          <Text style={[styles.rarityLabel, { color: RARITY_COLORS[item.rarity] ?? '#6b7280' }]}>
            {item.rarity}
          </Text>
        </View>

        <View style={styles.cardBottom}>
          <Text style={styles.priceLabel}>
            <Text style={styles.priceDollar}>$</Text>
            {Number(item.price).toLocaleString()}
          </Text>
          <Text style={styles.stockLabel}>{item.stock > 0 ? `×${item.stock}` : 'SOLD OUT'}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ── Detail modal ─────────────────────────────────────────────────────────────
function ItemDetailModal({ item, visible, onClose, balance }) {
  const [buying, setBuying] = useState(false);
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 10 }).start();
    } else {
      slideAnim.setValue(400);
    }
  }, [visible]);

  if (!item) return null;

  const canAfford = balance >= item.price;
  const inStock = item.stock > 0;

  const handleBuy = async () => {
    if (!canAfford) {
      Alert.alert('Insufficient Balance', `You need $${item.price - balance} more. Go to Top Up to add balance.`);
      return;
    }
    if (!inStock) {
      Alert.alert('Out of Stock', 'This item is no longer available.');
      return;
    }

    const user = auth.currentUser;
    if (!user) { Alert.alert('Not signed in'); return; }

    setBuying(true);
    try {
      await runTransaction(db, async tx => {
        const userRef = doc(db, 'users', user.uid);
        const itemRef = doc(db, 'items', item.id);
        const userSnap = await tx.get(userRef);
        const itemSnap = await tx.get(itemRef);

        if (!userSnap.exists()) throw new Error('User document not found');
        const currentBalance = userSnap.data().balance ?? 0;
        if (currentBalance < item.price) throw new Error('Insufficient balance');
        const currentStock = itemSnap.data().stock ?? 0;
        if (currentStock < 1) throw new Error('Out of stock');

        tx.update(userRef, { balance: increment(-item.price) });
        tx.update(itemRef, { stock: increment(-1) });
        // record purchase
        const purchaseRef = doc(collection(db, 'purchases'));
        tx.set(purchaseRef, {
          uid: user.uid,
          itemId: item.id,
          itemName: item.name,
          price: item.price,
          purchasedAt: serverTimestamp(),
        });
      });
      Alert.alert('🎉 Purchased!', `You bought ${item.name} for $${item.price}!`);
      onClose();
    } catch (err) {
      Alert.alert('Purchase failed', err.message);
    } finally {
      setBuying(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Animated.View
          style={[styles.modalSheet, { transform: [{ translateY: slideAnim }] }]}
        >
          <Pressable onPress={() => {}}>
            {/* Handle bar */}
            <View style={styles.modalHandle} />

            {/* Emoji hero */}
            <View style={[styles.modalEmojiBg, { backgroundColor: item.color + '22' }]}>
              <Text style={styles.modalEmoji}>{item.emoji}</Text>
            </View>

            <View style={[styles.modalRarityChip, { backgroundColor: RARITY_BG[item.rarity] }]}>
              <Text style={[styles.modalRarityText, { color: RARITY_COLORS[item.rarity] }]}>
                ★ {item.rarity}
              </Text>
            </View>

            <Text style={styles.modalName}>{item.name}</Text>
            <Text style={styles.modalCategory}>{item.category}</Text>
            <Text style={styles.modalDesc}>{item.description}</Text>

            <View style={styles.modalStats}>
              <View style={styles.modalStatBox}>
                <Text style={styles.modalStatVal}>${Number(item.price).toLocaleString()}</Text>
                <Text style={styles.modalStatLabel}>Price</Text>
              </View>
              <View style={styles.modalStatDivider} />
              <View style={styles.modalStatBox}>
                <Text style={styles.modalStatVal}>{item.stock > 0 ? item.stock : '—'}</Text>
                <Text style={styles.modalStatLabel}>In Stock</Text>
              </View>
              <View style={styles.modalStatDivider} />
              <View style={styles.modalStatBox}>
                <Text style={[styles.modalStatVal, { color: canAfford ? '#16a34a' : '#dc2626' }]}>
                  ${Number(balance).toLocaleString()}
                </Text>
                <Text style={styles.modalStatLabel}>Your Balance</Text>
              </View>
            </View>

            {!canAfford && (
              <View style={styles.modalWarning}>
                <Text style={styles.modalWarningText}>
                  ⚠️ Need ${(item.price - balance).toLocaleString()} more — request a Top Up
                </Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.buyBtn,
                !inStock && styles.buyBtnDisabled,
                !canAfford && styles.buyBtnInsuff,
                pressed && styles.buyBtnPressed,
                buying && styles.buyBtnDisabled,
              ]}
              onPress={handleBuy}
              disabled={buying || !inStock}
            >
              <Text style={styles.buyBtnText}>
                {buying ? 'Processing…' : !inStock ? 'Out of Stock' : `Buy for $${Number(item.price).toLocaleString()}`}
              </Text>
            </Pressable>

            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
const CATEGORIES = ['All', 'Devil Fruits', 'Swords', 'Cosmetics', 'Materials'];

export default function ShopScreen() {
  const { width } = useWindowDimensions();
  const [items, setItems] = useState([]);
  const [category, setCategory] = useState('All');
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const balance = useUserBalance();

  const GAP = 10;
  const COLS = width >= 600 ? 3 : 2;
  const HPAD = 12;
  const tileWidth = (width - HPAD * 2 - GAP * (COLS - 1)) / COLS;

  useEffect(() => {
    seedItemsIfEmpty();
    const unsub = onSnapshot(collection(db, 'items'), snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const filtered = category === 'All' ? items : items.filter(i => i.category === category);

  const openItem = item => {
    setSelectedItem(item);
    setModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerEyebrow}>SAILOR PIECE</Text>
          <Text style={styles.headerTitle}>Item Shop</Text>
        </View>
        <View style={styles.balancePill}>
          <Text style={styles.balanceIcon}>💰</Text>
          <Text style={styles.balanceText}>${Number(balance).toLocaleString()}</Text>
        </View>
      </View>

      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catScroll}
        style={styles.catBar}
      >
        {CATEGORIES.map(cat => (
          <Pressable
            key={cat}
            style={[styles.catChip, category === cat && styles.catChipActive]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[styles.catChipText, category === cat && styles.catChipTextActive]}>
              {cat}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Grid */}
      <FlatList
        data={filtered}
        numColumns={COLS}
        key={COLS}
        keyExtractor={i => i.id}
        contentContainerStyle={[styles.grid, { paddingHorizontal: HPAD }]}
        columnWrapperStyle={COLS > 1 ? { gap: GAP } : undefined}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🏪</Text>
            <Text style={styles.emptyTitle}>Shop is loading…</Text>
            <Text style={styles.emptySub}>Items are being fetched from Firebase.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ItemCard item={item} onPress={openItem} tileWidth={tileWidth} />
        )}
      />

      <ItemDetailModal
        item={selectedItem}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        balance={balance}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050c18' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(5,12,24,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,240,255,0.1)',
    ...Platform.select({ web: { backdropFilter: 'blur(12px)' } }),
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: market.cyan,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
  },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(251,191,36,0.1)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
  },
  balanceIcon: { fontSize: 16 },
  balanceText: { fontSize: 15, fontWeight: '800', color: market.gold },

  // Categories
  catBar: { maxHeight: 52, backgroundColor: 'rgba(5,12,24,0.9)', borderBottomWidth: 1, borderBottomColor: 'rgba(0,240,255,0.08)' },
  catScroll: { alignItems: 'center', paddingHorizontal: 12, gap: 8, paddingVertical: 8 },
  catChip: {
    paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  catChipActive: { backgroundColor: market.cyan, borderColor: market.cyan, ...Platform.select({ web: { boxShadow: '0 0 12px rgba(0,240,255,0.3)' } }) },
  catChipText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  catChipTextActive: { color: '#050c18', fontWeight: '900' },

  // Grid
  grid: { paddingTop: 14, paddingBottom: 30 },

  // Card
  cardWrap: {
    marginBottom: 10,
    borderRadius: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
      web: { boxShadow: '0 4px 20px rgba(0,0,0,0.5)', transition: 'box-shadow 0.2s, transform 0.15s', cursor: 'pointer' },
    }),
  },
  card: {
    backgroundColor: 'rgba(13,20,40,0.9)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    ...Platform.select({ web: { backdropFilter: 'blur(8px)' } }),
  },
  rarityDot: {
    position: 'absolute', top: 12, right: 12,
    width: 8, height: 8, borderRadius: 4,
  },
  emojiBox: {
    width: '100%', aspectRatio: 1, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  emojiText: { fontSize: 36 },
  itemName: {
    fontSize: 13, fontWeight: '700', color: '#fff',
    lineHeight: 17, marginBottom: 6,
  },
  rarityChip: {
    alignSelf: 'flex-start', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8,
  },
  rarityLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  cardBottom: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 2,
  },
  priceLabel: { fontSize: 15, fontWeight: '800', color: '#fff' },
  priceDollar: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },
  stockLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.3)' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0d1428', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40,
    borderWidth: 1, borderColor: 'rgba(0,240,255,0.15)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.5, shadowRadius: 20 },
      android: { elevation: 20 },
      web: { boxShadow: '0 -8px 40px rgba(0,240,255,0.1)' },
    }),
  },
  modalHandle: {
    width: 40, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 20,
  },
  modalEmojiBg: {
    width: 100, height: 100, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 14,
  },
  modalEmoji: { fontSize: 52 },
  modalRarityChip: {
    alignSelf: 'center', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 5, marginBottom: 10,
  },
  modalRarityText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  modalName: {
    fontSize: 22, fontWeight: '900', color: '#fff',
    textAlign: 'center', marginBottom: 4, letterSpacing: -0.3,
  },
  modalCategory: {
    fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: '600',
    textAlign: 'center', marginBottom: 12,
  },
  modalDesc: {
    fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 21,
    textAlign: 'center', marginBottom: 20,
  },
  modalStats: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  modalStatBox: { flex: 1, alignItems: 'center' },
  modalStatVal: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 2 },
  modalStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '600' },
  modalStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)' },
  modalWarning: {
    backgroundColor: 'rgba(251,191,36,0.08)', borderRadius: 10,
    padding: 12, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)',
  },
  modalWarningText: { fontSize: 13, color: market.gold, fontWeight: '600', textAlign: 'center' },
  buyBtn: {
    backgroundColor: market.cyan, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 10,
    ...Platform.select({ web: { boxShadow: '0 0 24px rgba(0,240,255,0.35)', cursor: 'pointer' } }),
  },
  buyBtnDisabled: { backgroundColor: '#1f2937' },
  buyBtnInsuff: { backgroundColor: 'rgba(255,59,92,0.1)', borderWidth: 1, borderColor: 'rgba(255,59,92,0.3)' },
  buyBtnPressed: { opacity: 0.88 },
  buyBtnText: { color: '#050c18', fontWeight: '800', fontSize: 16 },
  closeBtn: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14,
    paddingVertical: 12, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)',
  },
  closeBtnText: { color: 'rgba(255,255,255,0.4)', fontWeight: '700', fontSize: 14 },

  // Empty
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  emptySub: { fontSize: 13, color: 'rgba(255,255,255,0.3)', textAlign: 'center' },
});
