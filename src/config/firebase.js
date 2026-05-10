import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAGVnUB2FUqYeBTVMjmJ31MXDR0cnizPBQ',
  authDomain: 'adv-firebase-d7967.firebaseapp.com',
  projectId: 'adv-firebase-d7967',
  storageBucket: 'adv-firebase-d7967.firebasestorage.app',
  messagingSenderId: '924719633646',
  appId: '1:924719633646:web:9e4601fa6666916b600fff',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
});
