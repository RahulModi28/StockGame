import React, { createContext, useState, useContext, useEffect } from 'react';
import { loginTeam } from '../api';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, setPersistence, browserLocalPersistence } from 'firebase/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('user');
        return saved ? JSON.parse(saved) : null;
    });

    // Firebase Login (Google)
    const loginWithGoogle = async () => {
        try {
            console.log("Starting Google Sign In...");
            await setPersistence(auth, browserLocalPersistence);
            const result = await signInWithPopup(auth, googleProvider);
            console.log("Google Sign In Success, User:", result.user.email);
            return await handleAuthResult(result.user);
        } catch (error) {
            console.error("Google Login Error", error);
            return { success: false, message: error.message };
        }
    };

    // Firebase Login (Email)
    const loginWithEmail = async (email, password) => {
        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            return await handleAuthResult(result.user);
        } catch (error) {
            console.error("Email Login Error", error);
            return { success: false, message: error.message };
        }
    };

    // Firebase Signup (Email)
    const signupWithEmail = async (email, password) => {
        try {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            return await handleAuthResult(result.user);
        } catch (error) {
            console.error("Email Signup Error", error);
            return { success: false, message: error.message };
        }
    };

    // Common Auth Handler
    const handleAuthResult = async (user) => {
        try {
            console.log("Getting ID Token...");
            const token = await user.getIdToken();
            console.log("Calling Backend Login...");
            const response = await loginTeam(token);
            console.log("Backend Login Success:", response.data);

            const userData = {
                ...response.data,
                email: user.email,  // Include email for team management
                token: token
            };

            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
            return { success: true };
        } catch (error) {
            console.error("Auth Handler Error:", error);
            const errorMessage = error.response?.data?.detail || error.message;
            if (error.code === 'ECONNABORTED') {
                return { success: false, message: "Server timeout. Please try again." };
            }
            return { success: false, message: errorMessage };
        }
    };

    // Auto-refresh token
    useEffect(() => {
        const unsubscribe = auth.onIdTokenChanged(async (firebaseUser) => {
            if (firebaseUser) {
                try {
                    const token = await firebaseUser.getIdToken();
                    // Update user state and localStorage if a user is currently logged in
                    setUser(prev => {
                        if (prev && (prev.email === firebaseUser.email || prev.firebase_uid === firebaseUser.uid)) {
                            const updated = { ...prev, token };
                            localStorage.setItem('user', JSON.stringify(updated));
                            console.log("Token refreshed automatically");
                            return updated;
                        }
                        return prev;
                    });
                } catch (err) {
                    console.error("Failed to refresh token", err);
                }
            } else {
                // Optional: If Firebase thinks we are logged out, should we clear our app state?
                // For now, let's strictly handle token refreshes to avoid session flapping.
                // setUser(null);
                // localStorage.removeItem('user');
            }
        });

        return () => unsubscribe();
    }, []);

    // Handle 401/403 Errors from API
    useEffect(() => {
        const handleAuthError = async () => {
            console.warn("Auth Error Detected (401). Attempting to refresh token...");

            if (auth.currentUser) {
                try {
                    // Force refresh ID token
                    const token = await auth.currentUser.getIdToken(true);

                    setUser(prev => {
                        if (prev) {
                            const updated = { ...prev, token };
                            localStorage.setItem('user', JSON.stringify(updated));
                            console.log("Token force-refreshed successfully.");
                            // Optional: Reload page to retry failed requests state cleanly
                            // window.location.reload(); 
                            return updated;
                        }
                        return prev;
                    });
                } catch (err) {
                    console.error("Force refresh failed", err);
                    logout(); // Session truly dead
                }
            } else {
                logout();
            }
        };

        window.addEventListener('auth-error', handleAuthError);
        return () => window.removeEventListener('auth-error', handleAuthError);
    }, []);

    const logout = () => {
        setUser(null);
        localStorage.removeItem('user');
        auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ user, loginWithGoogle, loginWithEmail, signupWithEmail, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
