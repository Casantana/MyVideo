// Fix: Use Firebase v9 compat libraries to support the v8 namespaced API and resolve import errors.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// TODO: Replace the following with your app's Firebase project configuration.
// See: https://firebase.google.com/docs/web/learn-more#config-object
const firebaseConfig = {
  apiKey: "AIzaSyDNspTYAoXupKUnfXJs61jk4QZLmonW9So",
  authDomain: "video-translator-723ba.firebaseapp.com",
  projectId: "video-translator-723ba",
  storageBucket: "video-translator-723ba.firebasestorage.app",
  messagingSenderId: "872189236263",
  appId: "1:872189236263:web:b6fc5a13d56b0f56196a02"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Initialize Firebase Authentication and get a reference to the service
export const auth = firebase.auth();

// Initialize Cloud Firestore and get a reference to the service
export const db = firebase.firestore();