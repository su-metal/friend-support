"use client";
import { getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signInWithEmailLink,
  signOut,
  isSignInWithEmailLink,
} from "firebase/auth";
export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}
export async function completeEmailLogin(
  config: FirebaseClientConfig,
  email: string,
) {
  const auth = getAuth(getApps()[0] ?? initializeApp(config));
  await setPersistence(auth, inMemoryPersistence);
  if (!isSignInWithEmailLink(auth, window.location.href))
    throw new Error("ログインリンクを確認してください");
  const result = await signInWithEmailLink(auth, email, window.location.href);
  const token = await result.user.getIdToken();
  await signOut(auth);
  return token;
}
