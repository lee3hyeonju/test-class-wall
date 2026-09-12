import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC2yOp5b52HLCo0LTKZWeGCw6ZFdVJOlWU",
  authDomain: "test-class-31357.firebaseapp.com",
  projectId: "test-class-31357",
  storageBucket: "test-class-31357.firebasestorage.app",
  messagingSenderId: "727597155281",
  appId: "1:727597155281:web:1b6e321c44d0927f5396f0",
  measurementId: "G-70HWR0KJ8L"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

const wall = document.getElementById("wall");
const input = document.getElementById("input");
const userArea = document.getElementById("userArea");
let isListening = false;
let authReadyResolve = null;
const authReady = new Promise((resolve) => {
  authReadyResolve = resolve;
});

function createGoogleLoginButton() {
  if (document.getElementById("googleLoginBtn")) return;

  const button = document.createElement("button");
  button.id = "googleLoginBtn";
  button.type = "button";
  button.textContent = "Google 로그인";
  button.style.cssText =
    "margin: 8px 0 12px; border: none; border-radius: 10px; padding: 8px 12px; background: #1f6fff; color: #fff; font-weight: 700; cursor: pointer;";

  button.addEventListener("click", async () => {
    try {
      setStatus("Google 로그인 중...");
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      if (error.code === "auth/popup-blocked" || error.code === "auth/popup-closed-by-user") {
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectErr) {
          console.error("Google 리다이렉트 로그인 실패:", redirectErr);
          setStatus(`로그인 실패 (${redirectErr.code || redirectErr.message})`);
        }
        return;
      }

      console.error("Google 로그인 실패:", error);
      setStatus(`로그인 실패 (${error.code || error.message})`);
    }
  });

  userArea?.insertAdjacentElement("afterend", button);
}

function removeGoogleLoginButton() {
  const button = document.getElementById("googleLoginBtn");
  if (button) button.remove();
}

function setStatus(message) {
  if (userArea) userArea.textContent = message;
}

function toMillis(value) {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "object" && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  return Number(value) || 0;
}

function makeMemo(memoDoc) {
  const data = memoDoc.data();
  const div = document.createElement("div");
  div.className = "memo";

  const del = document.createElement("button");
  del.textContent = "삭제";
  del.type = "button";
  del.addEventListener("click", async () => {
    try {
      await deleteDoc(doc(db, "memos", memoDoc.id));
      setStatus("삭제 완료");
    } catch (error) {
      console.error("메모 삭제 실패:", error);
      setStatus(`삭제 실패 (${error.code || error.message})`);
    }
  });
  div.appendChild(del);

  const span = document.createElement("span");
  span.textContent = data.text ?? "";
  div.appendChild(span);

  return div;
}

function render(snapshot) {
  if (!wall) return;

  const docs = snapshot.docs
    .slice()
    .sort((a, b) => {
      const t1 = toMillis(a.data().createdAt);
      const t2 = toMillis(b.data().createdAt);
      return t1 - t2;
    });

  wall.innerHTML = "";
  docs.forEach((memoDoc) => {
    wall.appendChild(makeMemo(memoDoc));
  });
}

async function startListening() {
  if (isListening) return;
  try {
    onSnapshot(
      collection(db, "memos"),
      (snapshot) => {
        if (snapshot.empty) {
          setStatus("메모가 없습니다.");
        } else {
          setStatus("Firebase 연결 완료");
        }
        render(snapshot);
      },
      (error) => {
        console.error("Firestore 구독 실패:", error);
        setStatus(`메모 불러오기 실패 (${error.code || error.message})`);
      }
    );
    isListening = true;
  } catch (error) {
    console.error("Firestore 초기화 실패:", error);
    setStatus("Firestore 연결 실패: 설정 또는 보안 규칙을 확인해 주세요.");
  }
}

async function addMemo(text) {
  await authReady;
  if (!auth.currentUser) {
    createGoogleLoginButton();
    throw new Error("로그인이 필요합니다. Google 로그인 후 다시 시도해 주세요.");
  }

  await addDoc(collection(db, "memos"), {
    text,
    createdAt: Date.now(),
  });
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    authReadyResolve();
    removeGoogleLoginButton();
    setStatus(`로그인 상태: ${user.displayName ?? user.email ?? "Google 사용자"}`);
    startListening();
  } else {
    authReadyResolve();
    setStatus("Google 로그인 필요");
    createGoogleLoginButton();
    isListening = false;
  }
});

startListening();

input?.addEventListener("keydown", async (e) => {
  if (e.key !== "Enter" || e.shiftKey) return;

  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  const backup = input.value;
  input.value = "";

  try {
    await addMemo(text);
    setStatus("저장 완료");
  } catch (error) {
    input.value = backup;
    console.error("메모 저장 실패:", error);
    if (error.code === "permission-denied") {
      setStatus("저장 실패: Firestore 쓰기 권한 없음(규칙/배포 확인)");
      return;
    }
    if (error.message === "로그인이 필요합니다. Google 로그인 후 다시 시도해 주세요.") {
      setStatus(error.message);
      return;
    }
    setStatus(`저장 실패 (${error.code || error.message})`);
  }

  input.focus();
});

if (input) input.focus();
