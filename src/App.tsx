import { HashRouter as Router, Routes, Route } from "react-router-dom";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import AuthDialog from "@/components/AuthDialog";
import Analysis from "@/pages/Analysis";
import Quant from "@/pages/Quant";
import Portfolio from "@/pages/Portfolio";
import { useAuth } from "@/hooks/useAuth";

export default function App() {
  const [showAuth, setShowAuth] = useState(false);
  const { user } = useAuth();

  return (
    <Router>
      <div className="flex h-screen bg-[#0a0e27] overflow-hidden">
        <Sidebar onLoginClick={() => setShowAuth(true)} />
        <main className="flex-1 min-w-0 overflow-hidden pb-16 md:pb-0">
          <Routes>
            <Route path="/" element={<Analysis />} />
            <Route path="/quant" element={<Quant />} />
            <Route
              path="/portfolio"
              element={
                user ? (
                  <Portfolio userId={user.uid} />
                ) : (
                  <NotLoggedIn onLoginClick={() => setShowAuth(true)} />
                )
              }
            />
          </Routes>
        </main>
        {showAuth && <AuthDialog onClose={() => setShowAuth(false)} />}
      </div>
    </Router>
  );
}

function NotLoggedIn({ onLoginClick }: { onLoginClick: () => void }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-xl bg-[#0d1333]/60 border border-[#1e3a5f]/30 flex items-center justify-center mx-auto">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4a6fa5" strokeWidth="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>
        <h2 className="text-white/80 text-lg font-semibold">请先登录</h2>
        <p className="text-[#4a6fa5] text-sm">登录后可以管理您的持仓</p>
        <button
          onClick={onLoginClick}
          className="px-6 py-2.5 bg-gradient-to-r from-[#00ff88] to-[#1e90ff] text-[#0a0e27] font-bold rounded-xl text-sm hover:opacity-90 transition-opacity"
        >
          登录 / 注册
        </button>
      </div>
    </div>
  );
}
