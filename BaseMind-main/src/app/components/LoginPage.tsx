import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useTheme } from "../context/ThemeContext";
import { Compass, Eye, EyeOff, Sun, Moon, Mail, Copy, CheckCircle, Loader2 } from "lucide-react";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const { login, loading: authLoading } = useAuth();
  const { settings } = useData();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setError("");
    
    try {
      const err = await login(email, password);
      if (err) {
        setError(err);
      } else {
        navigate("/");
      }
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setLoggingIn(false);
    }
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
    let pw = "";
    for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    return pw;
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    // Placeholder for actual Supabase Reset Logic
    setTimeout(() => {
      setResetMsg("If an account exists, a reset link has been sent.");
      setSending(false);
    }, 1500);
    setEmailError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <button onClick={toggleTheme} className="absolute top-4 right-4 p-2 rounded-lg hover:bg-accent text-muted-foreground">
        {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
      </button>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Compass className="w-10 h-10 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">BaseMind</h1>
          <p className="text-muted-foreground text-sm mt-2">Equipment & Camp Management System</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          {!showReset ? (
            <>
              <h2 className="text-center mb-6 text-foreground">Sign In</h2>
              {error && <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">{error}</div>}
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-sm mb-1 text-foreground">Email</label>
                  <input id="login-email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary" placeholder="admin@scouts.org" />
                </div>
                <div>
                  <label htmlFor="login-password" className="block text-sm mb-1 text-foreground">Password</label>
                  <div className="relative">
                    <input id="login-password" name="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary pr-10" placeholder="Enter password" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loggingIn || authLoading} className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2">
                  {loggingIn || authLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : "Sign In"}
                </button>
              </form>
              <div className="mt-4 text-center space-y-2">
                <button onClick={() => setShowReset(true)} className="text-sm text-primary hover:underline">Forgot password?</button>
                {settings?.registrationEnabled && (
                  <p className="text-sm text-muted-foreground">
                    New here? <Link to="/register" className="text-primary hover:underline">Request access</Link>
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <h2 className="text-center mb-6 text-foreground">Reset Password</h2>
              {resetMsg && (
                <div className={`mb-4 p-3 rounded-lg text-sm ${newPassword ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400" : "bg-destructive/10 text-destructive"}`}>
                  <div className="flex items-center gap-2">
                    {newPassword ? <CheckCircle className="w-4 h-4 shrink-0" /> : <Mail className="w-4 h-4 shrink-0" />}
                    {resetMsg}
                  </div>
                  {emailError && <p className="text-xs text-destructive mt-2 ml-6">{emailError}</p>}
                </div>
              )}
              {!newPassword && (
                <form onSubmit={handleReset} className="space-y-4">
                  <div>
                    <label className="block text-sm mb-1 text-foreground">Email</label>
                    <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary" placeholder="Enter your email address" />
                  </div>
                  <button type="submit" disabled={sending} className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-60">
                    {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : <><Mail className="w-4 h-4" /> Reset Password</>}
                  </button>
                </form>
              )}
              <button onClick={() => { setShowReset(false); setResetMsg(""); setNewPassword(""); setResetEmail(""); setCopied(false); setEmailError(""); }} className="mt-4 w-full text-center text-sm text-primary hover:underline">Back to login</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}