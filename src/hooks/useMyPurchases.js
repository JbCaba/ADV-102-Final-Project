import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

/** Real-time list of items the current user has purchased.
 *  Sorted client-side to avoid needing a Firestore composite index. */
export function useMyPurchases() {
  const [purchases, setPurchases] = useState([]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Simple query — no orderBy to avoid needing a composite index
    const q = query(
      collection(db, 'purchases'),
      where('buyerUid', '==', user.uid),
    );

    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort newest first client-side
      list.sort((a, b) => {
        const ta = a.purchasedAt?.seconds ?? 0;
        const tb = b.purchasedAt?.seconds ?? 0;
        return tb - ta;
      });
      setPurchases(list);
    }, err => {
      console.warn('useMyPurchases error:', err.message);
      setPurchases([]);
    });

    return unsub;
  }, []);

  return purchases;
}
