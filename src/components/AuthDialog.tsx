import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { LogIn, UserPlus, X, Loader2 } from 'lucide-react';

export default function AuthDialog({ onClose }: { onClose: () => void }) {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        if (password.length < 6) {
          setError('密码至少6位');
          setLoading(false);
          return;
        }
        await register(email, password);
      }
      onClose();
    } catch (err: any) {
      const msg = err?.code || err?.message || '操作失败';
      const errorMap: Record<string, string> = {
        'auth/invalid-email': '邮箱格式不正确',
        'auth/user-not-found': '用户不存在',
        'auth/wrong-password': '密码错误',
        'auth/email-already-in-use': '邮箱已被注册',
        'auth/weak-password': '密码强度不足',
        'auth/too-many-requests': '请求过于频繁，请稍后',
        'auth/invalid-credential': '邮箱或密码错误',
      };
      setError(errorMap[msg] || msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#0d1333] border border-[#1e3a5f]/50 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg">{isLogin ? '登录' : '注册'}</h2>
          <button onClick={onClose} className="text-[#4a6fa5] hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[#4a6fa5] text-xs block mb-1">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#0a0e27] border border-[#1e3a5f]/50 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[#00ff88]/50 transition-colors"
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="text-[#4a6fa5] text-xs block mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-[#0a0e27] border border-[#1e3a5f]/50 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[#00ff88]/50 transition-colors"
              placeholder="至少6位"
            />
          </div>

          {error && (
            <p className="text-[#ff4757] text-xs bg-[#ff4757]/10 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#00ff88] to-[#1e90ff] text-[#0a0e27] font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : isLogin ? (
              <><LogIn size={18} /> 登录</>
            ) : (
              <><UserPlus size={18} /> 注册</>
            )}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-[#4a6fa5] text-xs hover:text-[#00ff88] transition-colors"
          >
            {isLogin ? '没有账号？点击注册' : '已有账号？点击登录'}
          </button>
        </div>
      </div>
    </div>
  );
}
