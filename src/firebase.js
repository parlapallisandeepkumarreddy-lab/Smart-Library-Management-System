
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBL4IApXveDuV9RWwU79ffWBQfz5oTI9yQ",
  authDomain: "smart-library-management-52ffc.firebaseapp.com",
  projectId: "smart-library-management-52ffc",
  storageBucket: "smart-library-management-52ffc.firebasestorage.app",
  messagingSenderId: "928425598363",
  appId: "1:928425598363:web:00cba65959b3ccec4f553e"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
