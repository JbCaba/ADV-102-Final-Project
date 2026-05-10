import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export function useMyListings() {
  const [notes, setNotes] = useState([]);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) {
      setNotes([]);
      return undefined;
    }

    const notesQuery = query(collection(db, 'notes'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(notesQuery, snapshot => {
      const noteList = snapshot.docs.map(noteDoc => ({
        id: noteDoc.id,
        ...noteDoc.data(),
      }));
      noteList.sort((a, b) => {
        const aTime = a.createdAt?.seconds ?? 0;
        const bTime = b.createdAt?.seconds ?? 0;
        return bTime - aTime;
      });
      setNotes(noteList);
    });

    return unsubscribe;
  }, [user]);

  return notes;
}
