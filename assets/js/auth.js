// assets/js/auth.js
import { auth, db } from './firebase-config.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile 
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

export async function signUp(email, password, name, phone) {
  const userCred = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCred.user;
  await updateProfile(user, { displayName: name });
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    name,
    email,
    phone: phone || '',
    role: 'student',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return user;
}

export async function signIn(email, password) {
  const userCred = await signInWithEmailAndPassword(auth, email, password);
  return userCred.user;
}

export async function getUserRole(uid) {
  const docSnap = await getDoc(doc(db, 'users', uid));
  return docSnap.exists() ? docSnap.data().role : 'student';
}