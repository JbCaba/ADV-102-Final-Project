import { useEffect, useState } from 'react';
import {
  Alert, FlatList, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  addDoc, collection, doc, increment, onSnapshot,
  orderBy, query, runTransaction, serverTimestamp, updateDoc, where,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { market } from '../constants/marketplaceTheme';

const notify = (title, msg) => {
  if (Platform.OS === 'web') window.alert(msg); else Alert.alert(title, msg);
};
const confirm = async (msg, onYes) => {
  if (Platform.OS === 'web') { if (window.confirm(msg)) onYes(); }
  else Alert.alert('Confirm', msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Yes', onPress: onYes }]);
};

function StatCard({ label, value, color }) {
  return (
    <View style={[s.statCard, { borderTopColor: color }]}>
      <Text style={[s.statVal, { color }]}>{value}</Text>
      <Text style={s.statLbl}>{label}</Text>
    </View>
  );
}

function TopUpRow({ item, onApprove, onReject, loading }) {
  const sc = item.status === 'approved' ? { bg: 'rgba(34,197,94,0.08)', txt: market.green, border: 'rgba(34,197,94,0.2)' }
    : item.status === 'rejected' ? { bg: 'rgba(255,59,92,0.08)', txt: market.red, border: 'rgba(255,59,92,0.2)' }
    : { bg: 'rgba(251,191,36,0.08)', txt: market.gold, border: 'rgba(251,191,36,0.2)' };
  const date = item.createdAt?.seconds
    ? new Date(item.createdAt.seconds * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';
  return (
    <View style={s.row}>
      <View style={s.rowTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowEmail} numberOfLines={1}>{item.email}</Text>
          <Text style={s.rowDate}>{date}</Text>
        </View>
        <View style={[s.badge, { backgroundColor: sc.bg, borderColor: sc.border }]}>
          <Text style={[s.badgeTxt, { color: sc.txt }]}>{item.status.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={s.rowAmt}>${Number(item.amount).toLocaleString()}</Text>
      {item.note ? <Text style={s.rowNote} numberOfLines={2}>📝 {item.note}</Text> : null}
      {item.status === 'pending' && (
        <View style={s.rowBtns}>
          <Pressable style={s.approveBtn} onPress={() => onApprove(item)} disabled={loading === item.id}>
            <Text style={s.approveTxt}>{loading === item.id ? '…' : '✓ Approve'}</Text>
          </Pressable>
          <Pressable style={s.rejectBtn} onPress={() => onReject(item)} disabled={loading === item.id}>
            <Text style={s.rejectTxt}>✕ Reject</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function AdminScreen() {
  const isAdmin = useIsAdmin();
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(null);
  const [gEmail, setGEmail] = useState('');
  const [gAmt, setGAmt] = useState('');
  const [granting, setGranting] = useState(false);
  const [showGrant, setShowGrant] = useState(false);
  const [pendingListings, setPendingListings] = useState([]);
  const [listingLoading, setListingLoading] = useState(null);
  const [activeTab, setActiveTab] = useState('topups'); // 'topups' | 'accounts'

  useEffect(() => {
    const q = query(collection(db, 'topups'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'notes'), where('status', '==', 'pending'));
    return onSnapshot(q, snap => setPendingListings(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  const handleApproveAccount = async (item) => {
    confirm(`Approve account "${item.text?.slice(0,30)}" from ${item.sellerEmail}?`, async () => {
      setListingLoading(item.id);
      try { await updateDoc(doc(db, 'notes', item.id), { status: 'active', approvedBy: auth.currentUser?.uid, approvedAt: serverTimestamp() }); }
      catch (e) { notify('Error', e.message); }
      finally { setListingLoading(null); }
    });
  };

  const handleRejectAccount = async (item) => {
    confirm(`Reject and delete account listing from ${item.sellerEmail}?`, async () => {
      setListingLoading(item.id);
      try { await updateDoc(doc(db, 'notes', item.id), { status: 'rejected', rejectedBy: auth.currentUser?.uid, rejectedAt: serverTimestamp() }); }
      catch (e) { notify('Error', e.message); }
      finally { setListingLoading(null); }
    });
  };

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);
  const pending = requests.filter(r => r.status === 'pending').length;
  const approved = requests.filter(r => r.status === 'approved').length;
  const rejected = requests.filter(r => r.status === 'rejected').length;
  const total = requests.filter(r => r.status === 'approved').reduce((a, r) => a + (r.amount ?? 0), 0);

  const handleApprove = item => {
    confirm(`Approve $${item.amount.toLocaleString()} for ${item.email}?`, async () => {
      setLoading(item.id);
      try {
        await runTransaction(db, async tx => {
          const tRef = doc(db, 'topups', item.id);
          const snap = await tx.get(tRef);
          if (snap.data().status !== 'pending') throw new Error('Already processed');
          tx.update(doc(db, 'users', item.uid), { balance: increment(item.amount) });
          tx.update(tRef, { status: 'approved', approvedBy: auth.currentUser?.uid ?? 'admin', approvedAt: serverTimestamp() });
        });
      } catch (e) { notify('Failed', e.message); }
      finally { setLoading(null); }
    });
  };

  const handleReject = item => {
    confirm(`Reject $${item.amount.toLocaleString()} from ${item.email}?`, async () => {
      setLoading(item.id);
      try {
        await updateDoc(doc(db, 'topups', item.id), { status: 'rejected', rejectedBy: auth.currentUser?.uid ?? 'admin', rejectedAt: serverTimestamp() });
      } catch (e) { notify('Failed', e.message); }
      finally { setLoading(null); }
    });
  };

  const handleGrant = async () => {
    const amount = Number(gAmt);
    if (!gEmail.trim() || amount < 1) { notify('Invalid', 'Enter email and amount.'); return; }
    setGranting(true);
    try {
      await addDoc(collection(db, 'topups'), {
        uid: gEmail.trim().toLowerCase(), email: gEmail.trim().toLowerCase(),
        amount, note: `Direct grant by ${auth.currentUser?.email}`,
        status: 'pending', createdAt: serverTimestamp(), directGrant: true,
      });
      notify('Done', `$${amount} pending request created for ${gEmail}. Approve it from the list.`);
      setGEmail(''); setGAmt(''); setShowGrant(false);
    } catch (e) { notify('Failed', e.message); }
    finally { setGranting(false); }
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <StatusBar style="light" />
        <View style={s.guard}>
          <Text style={{ fontSize: 42 }}>🔒</Text>
          <Text style={s.guardTitle}>RESTRICTED AREA</Text>
          <Text style={s.guardSub}>This panel is for admins only.{'\n'}Contact an admin to grant access.</Text>
          <View style={s.guardEmail}><Text style={s.guardEmailTxt}>{auth.currentUser?.email}</Text></View>
        </View>
      </SafeAreaView>
    );
  }

  const FILTERS = ['pending', 'approved', 'rejected', 'all'];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar style="light" />
      <View style={s.center}>
        {/* Header */}
        <View style={s.hdr}>
          <View>
            <Text style={s.hdrEye}>🛡️ ADMIN PANEL</Text>
            <Text style={s.hdrTitle}>{activeTab === 'topups' ? 'Top-Up Requests' : 'Account Listings'}</Text>
          </View>
          <Pressable style={s.grantToggle} onPress={() => setShowGrant(v => !v)}>
            <Text style={s.grantToggleTxt}>{showGrant ? '✕ Close' : '＋ Grant'}</Text>
          </Pressable>
        </View>

        {/* Tab Switcher */}
        <View style={s.tabRow}>
          <Pressable style={[s.tab, activeTab === 'topups' && s.tabOn]} onPress={() => setActiveTab('topups')}>
            <Text style={[s.tabTxt, activeTab === 'topups' && s.tabTxtOn]}>💰 Top-Up ({pending})</Text>
          </Pressable>
          <Pressable style={[s.tab, activeTab === 'accounts' && s.tabOn]} onPress={() => setActiveTab('accounts')}>
            <Text style={[s.tabTxt, activeTab === 'accounts' && s.tabTxtOn]}>🎮 Accounts ({pendingListings.length})</Text>
          </Pressable>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <StatCard label="PENDING" value={pending} color={market.gold} />
          <StatCard label="APPROVED" value={approved} color={market.green} />
          <StatCard label="REJECTED" value={rejected} color={market.red} />
          <StatCard label="CREDITED" value={`$${total.toLocaleString()}`} color={market.cyan} />
        </View>

        {/* Grant panel */}
        {showGrant && (
          <View style={s.grantPanel}>
            <Text style={s.grantTitle}>⚡ DIRECT GRANT</Text>
            <TextInput style={[s.inp, Platform.OS === 'web' && { outlineWidth: 0 }]} placeholder="user@email.com" placeholderTextColor="#374151" autoCapitalize="none" value={gEmail} onChangeText={setGEmail} />
            <View style={s.grantAmtRow}>
              <Text style={s.grantDollar}>$</Text>
              <TextInput style={[s.inp, { flex: 1 }, Platform.OS === 'web' && { outlineWidth: 0 }]} placeholder="Amount" placeholderTextColor="#374151" keyboardType="numeric" value={gAmt} onChangeText={setGAmt} />
              <Pressable style={[s.grantSend, granting && { backgroundColor: '#1f2937' }]} onPress={handleGrant} disabled={granting}>
                <Text style={s.grantSendTxt}>{granting ? '…' : 'Send'}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Filter tabs */}
        <View style={s.filters}>
          {FILTERS.map(f => (
            <Pressable key={f} style={[s.filterTab, filter === f && s.filterTabOn]} onPress={() => setFilter(f)}>
              <Text style={[s.filterTxt, filter === f && s.filterTxtOn]}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}{f === 'pending' && pending > 0 ? ` (${pending})` : ''}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Top-Up List */}
        {activeTab === 'topups' && (
          <FlatList
            data={filtered}
            keyExtractor={r => r.id}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<View style={s.empty}><Text style={{ fontSize: 24 }}>💭</Text><Text style={s.emptyT}>No {filter === 'all' ? '' : filter} requests</Text></View>}
            renderItem={({ item }) => <TopUpRow item={item} onApprove={handleApprove} onReject={handleReject} loading={loading} />}
          />
        )}

        {/* Account Listings */}
        {activeTab === 'accounts' && (
          <FlatList
            data={pendingListings}
            keyExtractor={r => r.id}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<View style={s.empty}><Text style={{ fontSize: 24 }}>✅</Text><Text style={s.emptyT}>No pending account listings</Text></View>}
            renderItem={({ item }) => {
              const seller = item.sellerEmail?.split('@')[0] ?? 'seller';
              const date = item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : '—';
              const isBusy = listingLoading === item.id;
              return (
                <View style={s.accCard}>
                  <View style={s.accHeader}>
                    <View style={s.accBadge}><Text style={s.accBadgeTxt}>🎮 ACCOUNT</Text></View>
                    <Text style={s.accDate}>{date}</Text>
                  </View>
                  <Text style={s.accSeller}>@{seller} • {item.sellerEmail}</Text>
                  <Text style={s.accItem} numberOfLines={2}>{item.text?.slice(6, 80) ?? 'Account listing'}</Text>
                  <View style={s.accCreds}>
                    <Text style={s.accCredsTitle}>🔑 ROBLOX CREDENTIALS</Text>
                    <Text style={s.accCredsRow}>📧 Email: <Text style={s.accCredsVal}>{item.robloxEmail}</Text></Text>
                    <Text style={s.accCredsRow}>🔐 Pass: <Text style={s.accCredsVal}>{item.robloxPass}</Text></Text>
                  </View>
                  <View style={s.accBtns}>
                    <Pressable style={[s.accApprove, isBusy && { opacity: 0.5 }]} onPress={() => handleApproveAccount(item)} disabled={isBusy}>
                      <Text style={s.accApproveTxt}>{isBusy ? '⏳' : '✔ APPROVE'}</Text>
                    </Pressable>
                    <Pressable style={[s.accReject, isBusy && { opacity: 0.5 }]} onPress={() => handleRejectAccount(item)} disabled={isBusy}>
                      <Text style={s.accRejectTxt}>{isBusy ? '⏳' : '✖ REJECT'}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#050c18' },
  center: { flex: 1, maxWidth: 720, width: '100%', alignSelf: 'center' },

  hdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: 'rgba(5,12,24,0.95)', borderBottomWidth: 1, borderBottomColor: 'rgba(0,240,255,0.12)',
    ...Platform.select({ web: { backdropFilter: 'blur(12px)' } }),
  },
  hdrEye: { fontSize: 9, fontWeight: '900', color: market.gold, letterSpacing: 1, marginBottom: 2 },
  hdrTitle: { fontSize: 18, fontWeight: '900', color: market.textBright },
  grantToggle: { backgroundColor: market.darkSurface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: market.border },
  grantToggleTxt: { color: market.textBright, fontWeight: '700', fontSize: 12 },

  tabRow: { flexDirection: 'row', backgroundColor: 'rgba(5,12,24,0.9)', borderBottomWidth: 1, borderBottomColor: 'rgba(0,240,255,0.08)' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: market.cyan },
  tabTxt: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.35)' },
  tabTxtOn: { color: market.cyan },

  /* Account card */
  accCard: { backgroundColor: 'rgba(13,20,40,0.9)', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)', borderLeftWidth: 3, borderLeftColor: market.purple, ...Platform.select({ web: { backdropFilter: 'blur(8px)' } }) },
  accHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  accBadge: { backgroundColor: 'rgba(168,85,247,0.12)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  accBadgeTxt: { color: market.purple, fontWeight: '900', fontSize: 9, letterSpacing: 0.5 },
  accDate: { fontSize: 10, color: market.textMuted },
  accSeller: { fontSize: 11, color: market.cyan, fontWeight: '700', marginBottom: 4 },
  accItem: { fontSize: 12, color: market.textMuted, marginBottom: 10, lineHeight: 17 },
  accCreds: { backgroundColor: 'rgba(251,191,36,0.06)', borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)' },
  accCredsTitle: { fontSize: 9, fontWeight: '900', color: market.gold, letterSpacing: 1, marginBottom: 6 },
  accCredsRow: { fontSize: 11, color: market.textMuted, marginBottom: 3 },
  accCredsVal: { color: market.textBright, fontWeight: '700' },
  accBtns: { flexDirection: 'row', gap: 8 },
  accApprove: { flex: 1, backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 8, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' },
  accApproveTxt: { color: market.green, fontWeight: '900', fontSize: 12 },
  accReject: { flex: 1, backgroundColor: 'rgba(255,59,92,0.08)', borderRadius: 8, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,59,92,0.25)' },
  accRejectTxt: { color: market.red, fontWeight: '900', fontSize: 12 },

  statsRow: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 10, gap: 8 },
  statCard: {
    flex: 1, backgroundColor: 'rgba(13,20,40,0.85)', borderRadius: 12, paddingVertical: 12,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,240,255,0.08)', borderTopWidth: 3,
    ...Platform.select({ web: { backdropFilter: 'blur(8px)' } }),
  },
  statVal: { fontSize: 14, fontWeight: '900', marginBottom: 2 },
  statLbl: { fontSize: 8, color: market.textMuted, fontWeight: '800', letterSpacing: 0.5 },

  grantPanel: {
    marginHorizontal: 10, marginBottom: 8,
    backgroundColor: market.darkCard, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: market.borderGlow, gap: 8,
  },
  grantTitle: { fontSize: 9, fontWeight: '900', color: market.cyan, letterSpacing: 1, marginBottom: 2 },
  inp: {
    backgroundColor: market.darkSurface, borderRadius: 10, borderWidth: 1, borderColor: market.border,
    paddingHorizontal: 12, paddingVertical: 9, color: market.textBright, fontSize: 13,
  },
  grantAmtRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grantDollar: { color: market.gold, fontWeight: '900', fontSize: 16 },
  grantSend: {
    backgroundColor: market.cyan, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  grantSendTxt: { color: market.dark, fontWeight: '900', fontSize: 13 },

  filters: { flexDirection: 'row', paddingHorizontal: 10, gap: 6, marginBottom: 4 },
  filterTab: {
    flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center',
    backgroundColor: market.darkCard, borderWidth: 1, borderColor: market.border,
  },
  filterTabOn: { backgroundColor: market.cyan, borderColor: market.cyan },
  filterTxt: { fontSize: 10, fontWeight: '800', color: market.textMuted },
  filterTxtOn: { color: market.dark },

  list: { paddingHorizontal: 10, paddingTop: 4, paddingBottom: 40 },

  row: {
    backgroundColor: 'rgba(13,20,40,0.85)', borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0,240,255,0.08)',
    ...Platform.select({ web: { backdropFilter: 'blur(8px)' } }),
  },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 },
  rowEmail: { fontSize: 13, fontWeight: '700', color: market.textBright, marginBottom: 2 },
  rowDate: { fontSize: 10, color: market.textMuted },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  badgeTxt: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  rowAmt: { fontSize: 22, fontWeight: '900', color: market.gold, marginBottom: 4 },
  rowNote: { fontSize: 11, color: market.textMuted, lineHeight: 15, marginBottom: 8 },
  rowBtns: { flexDirection: 'row', gap: 8 },
  approveBtn: { flex: 1, backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: 8, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' },
  approveTxt: { color: market.green, fontWeight: '800', fontSize: 12 },
  rejectBtn: { flex: 1, backgroundColor: 'rgba(255,59,92,0.1)', borderRadius: 8, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,59,92,0.2)' },
  rejectTxt: { color: market.red, fontWeight: '800', fontSize: 12 },

  guard: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 30 },
  guardTitle: { fontSize: 22, fontWeight: '900', color: market.red, letterSpacing: 2 },
  guardSub: { fontSize: 13, color: market.textMuted, textAlign: 'center', lineHeight: 20 },
  guardEmail: { backgroundColor: market.darkCard, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: market.border },
  guardEmailTxt: { fontSize: 12, color: market.textMuted },

  empty: { paddingVertical: 40, alignItems: 'center', gap: 8 },
  emptyT: { fontSize: 13, fontWeight: '700', color: market.textMuted },
});
