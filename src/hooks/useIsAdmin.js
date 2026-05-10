import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

/** Only jb@Admin.com is admin. Hardcoded — cannot be changed via Firestore. */
const ADMIN_EMAIL = 'jb@Admin.com';

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      if (!user) { setIsAdmin(false); return; }
      const adminFlag = user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      setIsAdmin(adminFlag);

      // Keep Firestore in sync — ensure the admin user doc has isAdmin:true
      if (adminFlag) {
        try {
          await setDoc(
            doc(db, 'users', user.uid),
            { isAdmin: true, email: user.email, uid: user.uid, updatedAt: serverTimestamp() },
            { merge: true }
          );
        } catch (_) { /* silent */ }
      }
    });
    return unsub;
  }, []);

  return isAdmin;
}
