import { auth, db } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    GoogleAuthProvider, 
    signInWithPopup,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { ref, get, set, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

export function initAuth(onUserReady) {
    // 1. Находим элементы UI
    const loginScreen = document.getElementById('loginScreen');
    const appContent = document.getElementById('appContent');
    const tabSignIn = document.getElementById('tabSignIn');
    const tabSignUp = document.getElementById('tabSignUp');
    const usernameInput = document.getElementById('loginUsername');
    const emailInput = document.getElementById('loginEmail');
    const passInput = document.getElementById('loginPassword');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    const googleAuthBtn = document.getElementById('googleAuthBtn');
    const errEl = document.getElementById('loginError');

    // 2. Выводим в консоль статус элементов для точной отладки
    console.log("[auth.js] Проверка наличия элементов в DOM:", {
        tabSignIn: !!tabSignIn,
        tabSignUp: !!tabSignUp,
        authSubmitBtn: !!authSubmitBtn,
        googleAuthBtn: !!googleAuthBtn
    });

    let currentMode = 'signIn'; 
    let googleUserSession = null; 

    // 3. БЕЗОПАСНОЕ НАВЕШИВАНИЕ СОБЫТИЙ (Каждое в своем изолированном блоке `if`)
    if (tabSignIn) {
        tabSignIn.addEventListener('click', () => {
            currentMode = 'signIn';
            tabSignIn.classList.add('active');
            if (tabSignUp) tabSignUp.classList.remove('active');
            if (usernameInput) usernameInput.style.display = 'none';
            if (authSubmitBtn) authSubmitBtn.textContent = 'ВОЙТИ';
            if (errEl) errEl.style.display = 'none';
        });
    }

    if (tabSignUp) {
        tabSignUp.addEventListener('click', () => {
            currentMode = 'signUp';
            tabSignUp.classList.add('active');
            if (tabSignIn) tabSignIn.classList.remove('active');
            if (usernameInput) usernameInput.style.display = 'block';
            if (authSubmitBtn) authSubmitBtn.textContent = 'ЗАРЕГИСТРИРОВАТЬСЯ';
            if (errEl) errEl.style.display = 'none';
        });
    }

    if (authSubmitBtn) {
        authSubmitBtn.addEventListener('click', async () => {
            const email = emailInput ? emailInput.value.trim() : '';
            const password = passInput ? passInput.value.trim() : '';
            const username = usernameInput ? usernameInput.value.trim() : '';

            if (errEl) errEl.style.display = 'none';

            if (googleUserSession && username) {
                await createUserProfile(googleUserSession.uid, username, googleUserSession.email);
                googleUserSession = null;
                return;
            }

            if (!email || !password) return showErr("Заполните почту и пароль!");
            if (password.length < 6) return showErr("Пароль должен быть от 6 символов!");

            if (currentMode === 'signIn') {
                try {
                    await signInWithEmailAndPassword(auth, email, password);
                } catch (err) {
                    handleAuthError(err);
                }
            } else {
                if (!username) return showErr("Введите ваш Никнейм!");
                try {
                    const creds = await createUserWithEmailAndPassword(auth, email, password);
                    await createUserProfile(creds.user.uid, username, email);
                } catch (err) {
                    handleAuthError(err);
                }
            }
        });
    }

    if (googleAuthBtn) {
        googleAuthBtn.addEventListener('click', async () => {
            if (errEl) errEl.style.display = 'none';
            const provider = new GoogleAuthProvider();
            
            try {
                const result = await signInWithPopup(auth, provider);
                const user = result.user;
                
                const userRef = ref(db, `users/${user.uid}`);
                const snapshot = await get(userRef);

                if (snapshot.exists()) {
                    if (loginScreen) loginScreen.style.display = 'none';
                    if (appContent) appContent.style.display = 'block';
                } else {
                    googleUserSession = user;
                    showErr("Почти готово! Введите желаемый никнейм и нажмите кнопку ниже.");
                    if (usernameInput) usernameInput.style.display = 'block';
                    if (emailInput) emailInput.style.display = 'none';
                    if (passInput) passInput.style.display = 'none';
                    if (authSubmitBtn) authSubmitBtn.textContent = 'ПОДТВЕРДИТЬ ПРОФИЛЬ';
                }
            } catch (err) {
                handleAuthError(err);
            }
        });
    }

    // 4. СЛУШАТЕЛЬ СТАТУСА АВТОРИЗАЦИИ Firebase
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userRef = ref(db, `users/${user.uid}`);
            const snapshot = await get(userRef);
            
            if (snapshot.exists()) {
                if (loginScreen) loginScreen.style.display = 'none';
                if (appContent) appContent.style.display = 'block';
                
                onValue(userRef, (snap) => {
                    if (snap.exists() && typeof onUserReady === 'function') {
                        onUserReady(user, snap.val());
                    }
                });
            }
        } else {
            if (loginScreen) loginScreen.style.display = 'flex';
            if (appContent) appContent.style.display = 'none';
        }
    });

    async function createUserProfile(uid, username, email) {
        try {
            await set(ref(db, `users/${uid}`), {
                username: username || email.split('@')[0],
                balance: 250.00,
                inventory: {}
            });
            window.location.reload();
        } catch (error) {
            console.error("Ошибка при создании профиля в БД:", error);
            showErr("Не удалось сохранить профиль в базу данных.");
        }
    }

    function showErr(text) {
        if (errEl) {
            errEl.textContent = text;
            errEl.style.display = 'block';
        }
    }

    function handleAuthError(err) {
        console.error("Код ошибки Firebase:", err.code);
        switch (err.code) {
            case 'auth/invalid-credential':
            case 'auth/wrong-password':
                showErr("Неверный пароль или почта!");
                break;
            case 'auth/user-not-found':
                showErr("Пользователь с таким Email не найден!");
                break;
            case 'auth/email-already-in-use':
                showErr("Этот Email уже зарегистрирован другим игроком!");
                break;
            case 'auth/popup-closed-by-user':
                showErr("Окно входа Google было закрыто.");
                break;
            default:
                showErr(`Ошибка системы: ${err.message}`);
        }
    }
}