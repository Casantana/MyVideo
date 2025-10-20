import React, { useState, useRef, useEffect } from 'react';
// Fix: Use Firebase v9 compat libraries to support the v8 namespaced API.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { auth } from '../firebaseConfig';
import { translations } from '../lib/i18n';


interface AuthModalProps {
    onClose: () => void;
    lang: keyof typeof translations;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, lang }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    // Add: State to track which auth action is in progress for specific loading messages.
    const [actionInProgress, setActionInProgress] = useState<'login' | 'register' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    const t = translations[lang] || translations.en;

    // Fix: Use firebase.auth.AuthError type and access the `code` property directly.
    const handleFirebaseError = (err: firebase.auth.AuthError): string => {
        switch (err.code) {
            case 'auth/email-already-in-use':
                return t.errorEmailInUse;
            case 'auth/invalid-email':
                return t.errorInvalidEmail;
            case 'auth/wrong-password':
            case 'auth/user-not-found':
            case 'auth/invalid-credential':
                return t.errorInvalidCredential;
            case 'auth/weak-password':
                return t.errorWeakPassword;
            default:
                console.error("Unhandled Firebase Auth Error:", err);
                return t.errorUnexpected;
        }
    };
    
    const handleAuthAction = async (action: 'login' | 'register') => {
        if (!email || !password) {
            setError(t.errorFillFields);
            return;
        }
        setLoading(true);
        // Add: Set the action in progress.
        setActionInProgress(action);
        setError(null);
        try {
            if (action === 'register') {
                await auth.createUserWithEmailAndPassword(email, password);
            } else {
                await auth.signInWithEmailAndPassword(email, password);
            }
            onClose();
        } catch (e) {
            setError(handleFirebaseError(e as firebase.auth.AuthError));
        } finally {
            setLoading(false);
            // Add: Reset the action in progress.
            setActionInProgress(null);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
            <div ref={modalRef} className="w-full max-w-sm bg-[#0b1220] text-[#e5e7eb] p-5 rounded-2xl shadow-2xl font-sans"
                 onClick={(e) => e.stopPropagation()}>
                <h3 className="text-xl font-bold mb-4 text-center">{t.loginRegister}</h3>
                <form id="voxly-auth-form" onSubmit={(e) => { e.preventDefault(); handleAuthAction('login'); }}>
                    <div className="grid gap-3">
                        {error && <p className="text-red-500 text-sm text-center bg-red-900/20 p-2 rounded-md">{error}</p>}
                        <input
                            id="voxl-email"
                            type="email"
                            placeholder={t.emailPlaceholder}
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full p-2.5 rounded-lg bg-[#111827] text-[#e5e7eb] border border-[#1f2937] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                        />
                        <input
                            id="voxl-pass"
                            type="password"
                            placeholder={t.passwordPlaceholder}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-2.5 rounded-lg bg-[#111827] text-[#e5e7eb] border border-[#1f2937] focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                        />
                        <div className="flex gap-3 mt-2">
                            <button
                                id="voxl-login"
                                type="submit"
                                disabled={loading}
                                className="flex-1 py-2.5 rounded-lg bg-[#1d4ed8] text-white font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {/* Fix: Show loading text only for login action */}
                                {loading && actionInProgress === 'login' ? t.loadingLogin : t.login}
                            </button>
                            <button
                                id="voxl-register"
                                type="button"
                                onClick={() => window.open('https://video-translator-723ba.web.app/signup.html', '_blank')}
                                disabled={loading}
                                className="flex-1 py-2.5 rounded-lg bg-[#10b981] text-[#00171f] font-semibold hover:bg-green-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t.createAccount}
                            </button>
                        </div>
                        <button
                            id="voxl-close"
                            type="button"
                            onClick={onClose}
                            className="w-full mt-1 py-2.5 rounded-lg bg-[#111827] text-[#e5e7eb] border border-[#374151] hover:bg-[#1f2937] transition-colors"
                        >
                            {t.cancel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};