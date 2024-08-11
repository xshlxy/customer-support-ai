import { signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "../firebase";

export function Auth() {
  const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
  const logOut = () => signOut(auth);

  return (
    <div>
      <button onClick={signInWithGoogle}>Sign In with Google</button>
      <button onClick={logOut}>Log Out</button>
    </div>
  );
}
