// src/pages/AuthPage.jsx
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import "./AuthPage.css";

function validateUsername(username) {
  const u = (username || "").trim();

  if (!u) return "Username is required.";
  if (u.length < 3) return "Username must be at least 3 characters.";
  if (u.length > 20) return "Username must be 20 characters or less.";
  if (!/^[a-zA-Z0-9_]+$/.test(u)) {
    return "Username can only use letters, numbers, and underscores.";
  }
  return "";
}

// Generate Matrix rain characters once
function generateMatrixChars(count) {
  const chars = [];
  for (let i = 0; i < count; i++) {
    chars.push({
      char: String.fromCharCode(0x30A0 + Math.floor(Math.random() * 96)),
      left: Math.random() * 100,
      delay: Math.random() * 8,
      duration: 4 + Math.random() * 8,
      opacity: 0.1 + Math.random() * 0.4,
    });
  }
  return chars;
}

// Auth providers
const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider("apple.com");

export default function AuthPage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // "login" | "signup" | "forgot" | "username"
  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";
  const isUsernamePrompt = mode === "username";

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [staySignedIn, setStaySignedIn] = useState(true);

  // For social login username prompt
  const [pendingSocialUser, setPendingSocialUser] = useState(null);

  // Generate matrix characters once on mount
  const matrixChars = useMemo(() => generateMatrixChars(80), []);

  // Check if user exists in Firestore (has username)
  const checkUserExists = async (uid) => {
    const userDoc = await getDoc(doc(db, "users", uid));
    return userDoc.exists();
  };

  // Save username for social login user
  const saveUsernameForSocialUser = async (e) => {
    e.preventDefault();
    setError("");

    const msg = validateUsername(username);
    if (msg) {
      setError(msg);
      return;
    }

    try {
      setLoading(true);

      await setDoc(doc(db, "users", pendingSocialUser.uid), {
        username: username.trim(),
        email: pendingSocialUser.email || "",
        createdAt: new Date().toISOString(),
        provider: pendingSocialUser.providerData?.[0]?.providerId || "social",
      });

      navigate("/", { replace: true });
    } catch (err) {
      setError(err?.message || "Failed to save username.");
    } finally {
      setLoading(false);
    }
  };

  // Handle social login
  const handleSocialLogin = async (provider, providerName) => {
    setError("");
    setSuccess("");

    try {
      setLoading(true);

      // Set persistence based on "stay signed in" checkbox
      const persistence = staySignedIn ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);

      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user already has a profile
      const exists = await checkUserExists(user.uid);

      if (!exists) {
        // New user - need to collect username
        setPendingSocialUser(user);
        setMode("username");
        setLoading(false);
        return;
      }

      // Existing user - proceed to app
      navigate("/", { replace: true });
    } catch (err) {
      // Handle specific errors
      if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-in cancelled.");
      } else if (err.code === "auth/account-exists-with-different-credential") {
        setError("An account already exists with this email using a different sign-in method.");
      } else {
        setError(err?.message || `${providerName} sign-in failed.`);
      }
      setLoading(false);
    }
  };

  // Handle forgot password
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    try {
      setLoading(true);
      await sendPasswordResetEmail(auth, cleanEmail);
      setSuccess("Check your email for a reset link");
      setEmail("");
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        setError("No account found with this email.");
      } else {
        setError(err?.message || "Failed to send reset email.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle email/password login/signup
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const cleanEmail = email.trim();

    try {
      setLoading(true);

      // Set persistence based on "stay signed in" checkbox
      const persistence = staySignedIn ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);

      if (isSignup) {
        const msg = validateUsername(username);
        if (msg) throw new Error(msg);

        const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);

        // Save username to Firestore
        await setDoc(doc(db, "users", userCred.user.uid), {
          username: username.trim(),
          email: cleanEmail,
          createdAt: new Date().toISOString(),
          provider: "email",
        });
      } else {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      }

      navigate("/", { replace: true });
    } catch (err) {
      setError(err?.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  // Render username prompt for social login
  if (isUsernamePrompt && pendingSocialUser) {
    return (
      <div className="auth-page">
        {/* Matrix Rain Background */}
        <div className="auth-matrix-rain" aria-hidden="true">
          {matrixChars.map((item, i) => (
            <span
              key={i}
              className="auth-matrix-char"
              style={{
                left: `${item.left}%`,
                animationDelay: `${item.delay}s`,
                animationDuration: `${item.duration}s`,
                opacity: item.opacity,
              }}
            >
              {item.char}
            </span>
          ))}
        </div>

        <div className="auth-container">
          <div className="auth-header">
            <h1 className="auth-logo">SLIPROOMS</h1>
            <p className="auth-tagline">one last thing...</p>
          </div>

          <form onSubmit={saveUsernameForSocialUser} className="auth-form">
            <p className="auth-username-prompt">
              Choose a username for the chat rooms
            </p>

            <div className="auth-field">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                autoComplete="username"
                disabled={loading}
                className="auth-input"
                autoFocus
              />
            </div>

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? (
                <span className="auth-loading">
                  <span className="auth-spinner"></span>
                  Saving...
                </span>
              ) : (
                "Enter the Room"
              )}
            </button>
          </form>
        </div>

        <footer className="auth-legal">
          <p>
            SlipRooms is a social community for sports fans to connect and chat.
            This is NOT a gambling platform. We do not accept bets, process wagers,
            or handle any real money transactions.
          </p>
        </footer>
      </div>
    );
  }

  // Render forgot password form
  if (isForgot) {
    return (
      <div className="auth-page">
        {/* Matrix Rain Background */}
        <div className="auth-matrix-rain" aria-hidden="true">
          {matrixChars.map((item, i) => (
            <span
              key={i}
              className="auth-matrix-char"
              style={{
                left: `${item.left}%`,
                animationDelay: `${item.delay}s`,
                animationDuration: `${item.duration}s`,
                opacity: item.opacity,
              }}
            >
              {item.char}
            </span>
          ))}
        </div>

        <div className="auth-container">
          <div className="auth-header">
            <h1 className="auth-logo">SLIPROOMS</h1>
            <p className="auth-tagline">reset your password</p>
          </div>

          <form onSubmit={handleForgotPassword} className="auth-form">
            <div className="auth-field">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="email"
                disabled={loading}
                className="auth-input"
                autoFocus
              />
            </div>

            {error && <div className="auth-error">{error}</div>}
            {success && <div className="auth-success">{success}</div>}

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? (
                <span className="auth-loading">
                  <span className="auth-spinner"></span>
                  Sending...
                </span>
              ) : (
                "Send Reset Link"
              )}
            </button>

            <button
              type="button"
              className="auth-back-link"
              onClick={() => {
                setMode("login");
                setError("");
                setSuccess("");
              }}
            >
              Back to login
            </button>
          </form>
        </div>

        <footer className="auth-legal">
          <p>
            SlipRooms is a social community for sports fans to connect and chat.
            This is NOT a gambling platform. We do not accept bets, process wagers,
            or handle any real money transactions.
          </p>
        </footer>
      </div>
    );
  }

  // Main login/signup form
  return (
    <div className="auth-page">
      {/* Matrix Rain Background */}
      <div className="auth-matrix-rain" aria-hidden="true">
        {matrixChars.map((item, i) => (
          <span
            key={i}
            className="auth-matrix-char"
            style={{
              left: `${item.left}%`,
              animationDelay: `${item.delay}s`,
              animationDuration: `${item.duration}s`,
              opacity: item.opacity,
            }}
          >
            {item.char}
          </span>
        ))}
      </div>

      {/* Main Content */}
      <div className="auth-container">
        {/* Logo & Tagline */}
        <div className="auth-header">
          <h1 className="auth-logo">SLIPROOMS</h1>
          <p className="auth-tagline">nobody sweats alone</p>
        </div>

        {/* Mode Toggle */}
        <div className="auth-toggle">
          <button
            type="button"
            className={`auth-toggle-btn ${mode === "login" ? "active" : ""}`}
            onClick={() => {
              setMode("login");
              setError("");
              setSuccess("");
            }}
            disabled={loading}
          >
            Login
          </button>
          <button
            type="button"
            className={`auth-toggle-btn ${mode === "signup" ? "active" : ""}`}
            onClick={() => {
              setMode("signup");
              setError("");
              setSuccess("");
            }}
            disabled={loading}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="auth-form">
          {isSignup && (
            <div className="auth-field">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                autoComplete="username"
                disabled={loading}
                className="auth-input"
              />
            </div>
          )}

          <div className="auth-field">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              disabled={loading}
              className="auth-input"
            />
          </div>

          <div className="auth-field">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              disabled={loading}
              className="auth-input"
            />
          </div>

          {/* Stay Signed In & Forgot Password Row */}
          {!isSignup && (
            <div className="auth-options-row">
              <label className="auth-checkbox-label">
                <input
                  type="checkbox"
                  checked={staySignedIn}
                  onChange={(e) => setStaySignedIn(e.target.checked)}
                  disabled={loading}
                  className="auth-checkbox"
                />
                <span className="auth-checkbox-custom"></span>
                Stay signed in
              </label>
              <button
                type="button"
                className="auth-forgot-link"
                onClick={() => {
                  setMode("forgot");
                  setError("");
                  setSuccess("");
                }}
                disabled={loading}
              >
                Forgot password?
              </button>
            </div>
          )}

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? (
              <span className="auth-loading">
                <span className="auth-spinner"></span>
                Working...
              </span>
            ) : isSignup ? (
              "Create Account"
            ) : (
              "Enter the Room"
            )}
          </button>
        </form>

        {/* Social Login Divider */}
        <div className="auth-divider">
          <span>or continue with</span>
        </div>

        {/* Social Login Buttons */}
        <div className="auth-social">
          <button
            type="button"
            className="auth-social-btn"
            onClick={() => handleSocialLogin(googleProvider, "Google")}
            disabled={loading}
          >
            <svg className="auth-social-icon" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          <button
            type="button"
            className="auth-social-btn"
            onClick={() => handleSocialLogin(appleProvider, "Apple")}
            disabled={loading}
          >
            <svg className="auth-social-icon" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
              />
            </svg>
            Continue with Apple
          </button>
        </div>
      </div>

      {/* Legal Disclosure */}
      <footer className="auth-legal">
        <p>
          SlipRooms is a social community for sports fans to connect and chat.
          This is NOT a gambling platform. We do not accept bets, process wagers,
          or handle any real money transactions. Any references to odds or bets
          are for discussion purposes only. Please gamble responsibly through
          licensed sportsbooks. You must be 18 years or older to use this app.
        </p>
      </footer>
    </div>
  );
}
