import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyBMKUpD3YnUCFa5xx8putdw_XN5u_-nMAw',
  authDomain: 'aget-d507b.firebaseapp.com',
  databaseURL: 'https://aget-d507b-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'aget-d507b',
  storageBucket: 'aget-d507b.firebasestorage.app',
  messagingSenderId: '1002867318824',
  appId: '1:1002867318824:web:b25ba4525196904199151d',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export default app;
