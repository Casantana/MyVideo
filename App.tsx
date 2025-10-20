import React, { useState, useEffect, useRef, useCallback } from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { auth, db } from './firebaseConfig';
import { AuthModal } from './components/AuthModal';
import { translations } from './lib/i18n';

type LanguageKey = keyof typeof translations;

const App: React.FC = () => {
    // --- STATE MANAGEMENT ---
    // Auth & Loading
    const [user, setUser] = useState<firebase.User | null>(null);
    const [loading, setLoading] = useState(true);

    // UI Visibility & Interaction
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isTranslationStopped, setIsTranslationStopped] = useState(false);

    // Language & Translation
    const [detectedLang, setDetectedLang] = useState<LanguageKey>('en');
    const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
    const [audioEnabled, setAudioEnabled] = useState(true); // Default to on
    const [subtitleSize, setSubtitleSize] = useState('medium');
    const [currentSubtitle, setCurrentSubtitle] = useState('');
    
    // Refs for timers and elements
    const inactivityTimerRef = useRef<number | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLDivElement>(null);

    const t = translations[detectedLang] || translations.en;

    // --- LOGIC & EFFECTS ---

    // 1. Core Authentication Listener
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(currentUser => {
            setUser(currentUser);
            setLoading(false);
            if (currentUser) {
                setIsPanelOpen(true); // Open panel on login
            } else {
                // Reset UI on logout
                setIsPanelOpen(false);
                setIsSettingsOpen(false);
            }
        });
        return () => unsubscribe();
    }, []);

    // 2. Profile & Language Loading Logic
    useEffect(() => {
        const loadUserProfile = async () => {
            // Priority 1: Check Firestore for logged-in user
            if (user) {
                const userDocRef = db.collection('users').doc(user.uid);
                try {
                    const doc = await userDocRef.get();
                    if (doc.exists && doc.data()?.language) {
                        setDetectedLang(doc.data()?.language);
                        return; // Found user preference, stop here.
                    }
                } catch (error) {
                    console.error("Error fetching user profile from Firestore:", error);
                }
            }

            // Priority 2: Check Local Storage for returning user (logged out)
            const lastUsedLang = localStorage.getItem('youvoix-lang') as LanguageKey;
            if (lastUsedLang && translations[lastUsedLang]) {
                setDetectedLang(lastUsedLang);
                return;
            }

            // Priority 3: Auto-detect for first-time users
            let langToSet: LanguageKey = 'en'; // Default
            const browserLang = navigator.language.split('-')[0] as LanguageKey;
            if (translations[browserLang]) {
                langToSet = browserLang;
            } else {
                try {
                    const response = await fetch('https://ipapi.co/json/');
                    const data = await response.json();
                    const countryCode = data.country_code?.toLowerCase();
                    const langMap: { [key: string]: LanguageKey } = { 'es': 'es', 'mx': 'es', 'fr': 'fr', 'pt': 'pt', 'br': 'pt' };
                    if (countryCode && langMap[countryCode]) {
                        langToSet = langMap[countryCode];
                    }
                } catch (error) {
                    console.warn('Could not detect language via IP. Using default.');
                }
            }
            
            setDetectedLang(langToSet);
            // If new user, save detected language to their profile
            if (user) {
                db.collection('users').doc(user.uid).set({ language: langToSet }, { merge: true });
            }
        };

        loadUserProfile();
    }, [user]);
    
    // 3. Subtitle Simulation Effect
    useEffect(() => {
        if (user && subtitlesEnabled && !isTranslationStopped) {
            setCurrentSubtitle(t.translationActive);
            const interval = setInterval(() => {
                const samples = t.subtitleSamples;
                const randomIndex = Math.floor(Math.random() * samples.length);
                setCurrentSubtitle(samples[randomIndex]);
            }, 3000);
            return () => clearInterval(interval);
        } else {
            setCurrentSubtitle(''); // Clear subtitles if disabled, stopped, or logged out
        }
    }, [user, subtitlesEnabled, isTranslationStopped, t]);

    // 4. Panel Auto-Close & Outside Click Logic
    const resetInactivityTimer = useCallback(() => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = window.setTimeout(() => setIsPanelOpen(false), 5000);
    }, []);

    useEffect(() => {
        const handleOutsideClick = (event: MouseEvent) => {
            if (
                isPanelOpen &&
                panelRef.current && !panelRef.current.contains(event.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(event.target as Node)
            ) {
                setIsPanelOpen(false);
            }
        };

        if (isPanelOpen) {
            resetInactivityTimer();
            document.addEventListener('mousedown', handleOutsideClick);
            panelRef.current?.addEventListener('mouseenter', () => {
                if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
            });
            panelRef.current?.addEventListener('mouseleave', resetInactivityTimer);
        } else {
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        }

        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        };
    }, [isPanelOpen, resetInactivityTimer]);


    // --- EVENT HANDLERS ---
    
    const handleLanguageChange = async (newLang: LanguageKey) => {
        setDetectedLang(newLang);
        localStorage.setItem('youvoix-lang', newLang); // Persist for logged-out state
        if (user) {
            try {
                await db.collection('users').doc(user.uid).set({ language: newLang }, { merge: true });
            } catch (error) {
                console.error("Failed to save language preference:", error);
                alert("Could not save language preference. Please try again.");
            }
        }
    };
    
    const handleLogout = async () => {
        try {
            await auth.signOut();
        } catch (error) {
            console.error("Error signing out: ", error);
        }
    };
    
    // Draggable Button Logic
    const handleDrag = (e: React.MouseEvent<HTMLDivElement>) => {
        const button = buttonRef.current;
        if (!button) return;

        let hasMoved = false;
        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = button.offsetLeft;
        const startTop = button.offsetTop;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                hasMoved = true;
                button.style.left = `${startLeft + dx}px`;
                button.style.top = `${startTop + dy}px`;
                button.style.right = 'auto';
                button.style.bottom = 'auto';
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (!hasMoved) {
                if (user) {
                    setIsPanelOpen(prev => !prev);
                } else {
                    setIsAuthModalOpen(true);
                }
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    if (loading) return null; // Wait for auth state

    // --- RENDER ---
    return (
      <>
        {/* On-Screen Subtitles & Link */}
        {user && !isTranslationStopped && (
          <div 
            className="fixed bottom-[8vh] left-1/2 -translate-x-1/2 z-[2147483646] flex flex-col items-center gap-2"
            style={{ pointerEvents: 'none' }}
          >
              <a 
                href="https://video-translator-723ba.web.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white font-bold text-lg"
                style={{ pointerEvents: 'auto', textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}
              >
                  youvoix
              </a>
              {subtitlesEnabled && currentSubtitle && (
                  <div className={`bg-black bg-opacity-60 text-white font-semibold px-3 py-1.5 rounded-lg
                      ${subtitleSize === 'small' ? 'text-sm' : ''}
                      ${subtitleSize === 'medium' ? 'text-lg' : ''}
                      ${subtitleSize === 'large' ? 'text-2xl' : ''}
                  `}>
                      {currentSubtitle}
                  </div>
              )}
          </div>
        )}
        
        {/* Main UI Container (Button & Panel) */}
        <div className="fixed" ref={buttonRef} style={{ bottom: '24px', right: '24px' }}>
          {isPanelOpen && user && (
            <div
              ref={panelRef}
              className="absolute right-0 bottom-full mb-3 w-80 bg-[#0b1220] text-[#e5e7eb] p-3.5 rounded-2xl shadow-2xl border border-gray-700/50"
            >
              <a href="https://video-translator-723ba.web.app/" target="_blank" rel="noopener noreferrer" className="block text-center text-xl font-bold text-blue-400 hover:text-blue-300 mb-3">youvoix</a>
              
              <div className="flex items-center justify-between gap-2 my-2 px-1">
                  <label htmlFor="voxly-chk-text">{t.subtitles}</label>
                  <input id="voxly-chk-text" type="checkbox" checked={subtitlesEnabled} onChange={(e) => setSubtitlesEnabled(e.target.checked)} className="h-4 w-4 rounded bg-gray-700 border-gray-600 focus:ring-blue-600" />
              </div>
              <div className="flex items-center justify-between gap-2 my-2 px-1">
                  <label htmlFor="voxly-chk-audio">{t.audio}</label>
                  <input id="voxly-chk-audio" type="checkbox" checked={audioEnabled} onChange={(e) => setAudioEnabled(e.target.checked)} className="h-4 w-4 rounded bg-gray-700 border-gray-600 focus:ring-blue-600" />
              </div>
              <div className="flex items-center justify-between gap-2 my-2 px-1">
                  <label htmlFor="voxly-size">{t.size}</label>
                  <select id="voxly-size" value={subtitleSize} onChange={(e) => setSubtitleSize(e.target.value)} className="w-1/2 p-2 rounded-lg bg-[#111827] text-[#e5e7eb] border border-[#1f2937] focus:outline-none focus:ring-1 focus:ring-blue-500">
                      <option value="small">{t.sizeSmall}</option>
                      <option value="medium">{t.sizeMedium}</option>
                      <option value="large">{t.sizeLarge}</option>
                  </select>
              </div>

              <div className="flex gap-2 my-2 mt-4">
                   <button onClick={() => setIsTranslationStopped(prev => !prev)} className="flex-1 py-2 rounded-lg bg-[#111827] text-[#e5e7eb] border border-[#374151] hover:bg-[#1f2937] transition-colors">{isTranslationStopped ? `▶️ ${t.resume}`: `⏹ ${t.stop}`}</button>
                   <button onClick={() => setIsSettingsOpen(prev => !prev)} className="flex-1 py-2 rounded-lg bg-[#1d4ed8] text-white font-semibold hover:bg-blue-600 transition-colors">⚙️ {t.settings}</button>
              </div>

              {isSettingsOpen && (
                  <div className="mt-3 pt-3 border-t border-gray-700/50 space-y-3">
                      <div className="flex items-center justify-between gap-2 px-1">
                          <span>Email:</span>
                          <div className="py-1.5 px-2.5 rounded-full bg-[#111827] text-sm truncate max-w-[180px]" title={user.email || ''}>{user.email}</div>
                      </div>
                       <div className="flex items-center justify-between gap-2 px-1">
                          <label htmlFor="voxly-lang">{t.translateTo}</label>
                          <select id="voxly-lang" value={detectedLang} onChange={(e) => handleLanguageChange(e.target.value as LanguageKey)} className="w-1/2 p-2 rounded-lg bg-[#111827] text-[#e5e7eb] border border-[#1f2937] focus:outline-none focus:ring-1 focus:ring-blue-500">
                             <option value="en">{t.langEnglish}</option>
                             <option value="es">{t.langSpanish}</option>
                             <option value="fr">{t.langFrench}</option>
                             <option value="pt">{t.langPortuguese}</option>
                          </select>
                      </div>
                      <button onClick={handleLogout} className="w-full mt-1 py-2 rounded-lg bg-[#111827] text-[#e5e7eb] border border-[#374151] hover:bg-[#1f2937] transition-colors">{t.logout}</button>
                  </div>
              )}
            </div>
          )}
          <div
            onMouseDown={handleDrag}
            className="px-4 py-2.5 bg-blue-700 text-white font-semibold rounded-full shadow-lg hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors duration-200 cursor-grab active:cursor-grabbing"
          >
            {t.translateVideo}
          </div>
        </div>
        
        {isAuthModalOpen && !user && (
            <AuthModal lang={detectedLang} onClose={() => setIsAuthModalOpen(false)} />
        )}
      </>
    );
};

export default App;
