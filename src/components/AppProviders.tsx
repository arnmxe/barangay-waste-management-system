"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from "lucide-react";
import { Lang, t, TranslationKey } from "@/lib/i18n";
import type { AuthUser } from "@/lib/auth";

interface ToastItem {
  id: number;
  type: "success" | "error" | "info";
  message: string;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface AppContextValue {
  user: AuthUser | null;
  loadingUser: boolean;
  unreadNotifications: number;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  lang: Lang;
  setLang: (next: Lang) => void;
  tr: (key: TranslationKey) => string;
  toast: (type: "success" | "error" | "info", message: string) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  canInstallPwa: boolean;
  installPwa: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [lang, setLangState] = useState<Lang>("en");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);
  const confirmResolverRef = useRef<((val: boolean) => void) | null>(null);
  const deferredInstallRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstallPwa, setCanInstallPwa] = useState(false);

  const toast = useCallback((type: "success" | "error" | "info", message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user ?? null);
        setUnreadNotifications(data.unreadNotifications ?? 0);
        if (data.user?.preferredLang === "fil" || data.user?.preferredLang === "en") {
          const savedLocal =
            typeof window !== "undefined" ? localStorage.getItem("brgy_lang") : null;
          if (!savedLocal) {
            setLangState(data.user.preferredLang);
          }
        }
      }
    } catch {
      // ignore offline transient
    } finally {
      setLoadingUser(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = localStorage.getItem("brgy_lang");
      if (saved === "fil" || saved === "en") {
        setLangState(saved);
      }
      void refreshUser();
    }, 0);

    // Register PWA service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredInstallRef.current = e as BeforeInstallPromptEvent;
      setCanInstallPwa(true);
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
    };
  }, [refreshUser]);

  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      localStorage.setItem("brgy_lang", next);
      if (user) {
        fetch("/api/auth/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferredLang: next }),
        }).catch(() => undefined);
      }
    },
    [user]
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setUnreadNotifications(0);
      toast("info", lang === "fil" ? "Naka-logout ka na." : "You have been signed out.");
      router.push("/login");
      router.refresh();
    } catch {
      toast("error", "Could not sign out cleanly.");
    }
  }, [lang, router, toast]);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmState(opts);
    });
  }, []);

  const resolveConfirm = (val: boolean) => {
    setConfirmState(null);
    if (confirmResolverRef.current) {
      confirmResolverRef.current(val);
      confirmResolverRef.current = null;
    }
  };

  const installPwa = useCallback(async () => {
    if (!deferredInstallRef.current) return;
    await deferredInstallRef.current.prompt();
    const choice = await deferredInstallRef.current.userChoice;
    if (choice.outcome === "accepted") {
      setCanInstallPwa(false);
      toast("success", "App installed to your home screen!");
    }
    deferredInstallRef.current = null;
  }, [toast]);

  const tr = useCallback((key: TranslationKey) => t(lang, key), [lang]);

  return (
    <AppContext.Provider
      value={{
        user,
        loadingUser,
        unreadNotifications,
        refreshUser,
        logout,
        lang,
        setLang,
        tr,
        toast,
        confirm,
        canInstallPwa,
        installPwa,
      }}
    >
      {children}

      {/* Accessible Toast Notifications */}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-[90] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)]"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            role="status"
            className={`flex items-start gap-3 rounded-xl border p-4 shadow-lg text-sm font-medium ${
              item.type === "success"
                ? "bg-green-50 border-green-300 text-green-900"
                : item.type === "error"
                ? "bg-red-50 border-red-300 text-red-900"
                : "bg-slate-900 border-slate-700 text-white"
            }`}
          >
            {item.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-700 mt-0.5" />
            ) : item.type === "error" ? (
              <AlertCircle className="h-5 w-5 shrink-0 text-red-700 mt-0.5" />
            ) : (
              <Info className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
            )}
            <span className="flex-1 leading-snug">{item.message}</span>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== item.id))}
              aria-label="Dismiss notification"
              className="p-1 rounded hover:bg-black/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Destructive Action Confirmation Dialog */}
      {confirmState && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                  confirmState.destructive
                    ? "bg-red-100 text-red-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3
                  id="confirm-dialog-title"
                  className="text-lg font-bold text-slate-900"
                >
                  {confirmState.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  {confirmState.message}
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-3">
              <button
                type="button"
                onClick={() => resolveConfirm(false)}
                className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {confirmState.cancelLabel ?? tr("cancel")}
              </button>
              <button
                type="button"
                onClick={() => resolveConfirm(true)}
                className={`min-h-[44px] rounded-xl px-5 py-2.5 text-sm font-semibold text-white ${
                  confirmState.destructive
                    ? "bg-red-700 hover:bg-red-800"
                    : "bg-[#166534] hover:bg-[#14532d]"
                }`}
              >
                {confirmState.confirmLabel ?? tr("confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProviders");
  return ctx;
}
