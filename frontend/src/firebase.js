
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// REPLACE THIS with your Firebase project configuration
// You can copy this from the Firebase Console -> Project Settings -> General -> Your apps
const firebaseConfig = {
    apiKey: "AIzaSyDXqCJhKr92bOa-eHWNv22nGWpHNN4UiYI",
    authDomain: "stocksimulator-3a021.firebaseapp.com",
    projectId: "stocksimulator-3a021",
    storageBucket: "stocksimulator-3a021.firebasestorage.app",
    messagingSenderId: "51030633358",
    appId: "1:51030633358:web:ddebed88902429f7fa12df",
    measurementId: "G-YCLFTKQQZK"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Google Auth Provider Scopes (optional)
googleProvider.addScope('email');
googleProvider.addScope('profile');
