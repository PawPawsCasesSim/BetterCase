import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyAzdpsocb-EM2vvKTTiu1fkpIELcMsFpMw",
    authDomain: "cs2-case-simulator-e8765.firebaseapp.com",
    projectId: "cs2-case-simulator-e8765",
    databaseURL: "https://cs2-case-simulator-e8765-default-rtdb.europe-west1.firebasedatabase.app",
    storageBucket: "cs2-case-simulator-e8765.firebasestorage.app",
    messagingSenderId: "495725567536",
    appId: "1:495725567536:web:98d38f3e97af59c41517f5"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);