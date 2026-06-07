import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyBZ1HdW2wBXZ4sP4YxeMH6HG8H_zvKBxRU",
    authDomain: "ma-services-80545.firebaseapp.com",
    projectId: "ma-services-80545",
    storageBucket: "ma-services-80545.firebasestorage.app",
    messagingSenderId: "822071246752",
    appId: "1:822071246752:web:16c5fb421501b34149eec5",
    measurementId: "G-G5ZLYE8611"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);