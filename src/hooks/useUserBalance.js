import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

/** Realtime balance listener for the current user */
export function useUserBalance() {
  const [balance, setBalance] = useState(0);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) {
      setBalance(0);
      return undefined;
    }
    const ref = doc(db, 'users', user.uid);
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        setBalance(snap.data().balance ?? 0);
      } else {
        setBalance(0);
      }
    });
    return unsub;
  }, [user]);

  return balance;
}
