import { NavLink } from 'react-router-dom';
import { BarChart3, Brain, Briefcase, TrendingUp, LogIn, LogOut, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { to: '/', icon: BarChart3, label: '行情' },
  { to: '/quant', icon: Brain, label: '量化' },
  { to: '/portfolio', icon: Briefcase, label: '持仓', requireAuth: true },
];

export default function Sidebar({ onLoginClick }: { onLoginClick: () => void }) {
  const { user, logout } = useAuth();

  return (
    <>
      {/* 桌面端左侧导航 */}
      <aside className="hidden md:flex w-16 lg:w-52 bg-[#0a0e27]/80 backdrop-blur-xl border-r border-[#1e3a5f]/30 flex-col h-full shrink-0">
        {/* Logo */}
        <div className="p-3 lg:p-4 border-b border-[#1e3a5f]/30">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00ff88] to-[#1e90ff] flex items-center justify-center shrink-0">
              <TrendingUp size={20} className="text-[#0a0e27]" />
            </div>
            <div className="hidden lg:block">
              <h1 className="text-white font-bold text-sm leading-tight">A股量化</h1>
              <p className="text-[#4a6fa5] text-xs">交易预测工具</p>
            </div>
          </div>
        </div>

        {/* 导航 */}
        <nav className="flex-1 p-2 lg:p-3 space-y-1">
          {navItems.map((item) => {
            const disabled = item.requireAuth && !user;
            return (
              <NavLink
                key={item.to}
                to={disabled ? '#' : item.to}
                onClick={(e) => { if (disabled) { e.preventDefault(); onLoginClick(); } }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 ${
                    disabled
                      ? 'text-[#4a6fa5]/40 cursor-pointer'
                      : isActive
                      ? 'bg-gradient-to-r from-[#00ff88]/10 to-[#1e90ff]/10 text-[#00ff88] border border-[#00ff88]/20'
                      : 'text-[#4a6fa5] hover:text-white/80 hover:bg-[#1e3a5f]/20'
                  }`
                }
              >
                <item.icon size={20} className="shrink-0" />
                <span className="hidden lg:block text-sm font-medium">{item.label}</span>
                {item.requireAuth && !user && <span className="hidden lg:block text-[10px] text-[#ff4757] ml-auto">需登录</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* 用户区域 */}
        <div className="p-2 lg:p-3 border-t border-[#1e3a5f]/30">
          {user ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00ff88] to-[#1e90ff] flex items-center justify-center shrink-0">
                  <User size={14} className="text-[#0a0e27]" />
                </div>
                <div className="hidden lg:block min-w-0">
                  <p className="text-white/80 text-xs truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[#4a6fa5] hover:text-[#ff4757] hover:bg-[#ff4757]/10 transition-all text-sm"
              >
                <LogOut size={18} className="shrink-0" />
                <span className="hidden lg:block">退出登录</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onLoginClick}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-[#00ff88]/10 to-[#1e90ff]/10 text-[#00ff88] border border-[#00ff88]/20 hover:border-[#00ff88]/40 transition-all text-sm"
            >
              <LogIn size={18} className="shrink-0" />
              <span className="hidden lg:block font-medium">登录 / 注册</span>
            </button>
          )}
        </div>
      </aside>

      {/* 移动端底部导航 */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0a0e27]/95 backdrop-blur-xl border-t border-[#1e3a5f]/30 flex items-center justify-around px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {navItems.map((item) => {
          const disabled = item.requireAuth && !user;
          return (
            <NavLink
              key={item.to}
              to={disabled ? '#' : item.to}
              onClick={(e) => { if (disabled) { e.preventDefault(); onLoginClick(); } }}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all ${
                  disabled
                    ? 'text-[#4a6fa5]/40'
                    : isActive
                    ? 'text-[#00ff88]'
                    : 'text-[#4a6fa5]'
                }`
              }
            >
              <item.icon size={20} className="shrink-0" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          );
        })}
        {/* 登录/用户按钮 */}
        {user ? (
          <button
            onClick={logout}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[#4a6fa5]"
          >
            <LogOut size={20} className="shrink-0" />
            <span className="text-[10px] font-medium">退出</span>
          </button>
        ) : (
          <button
            onClick={onLoginClick}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[#00ff88]"
          >
            <LogIn size={20} className="shrink-0" />
            <span className="text-[10px] font-medium">登录</span>
          </button>
        )}
      </nav>
    </>
  );
}
