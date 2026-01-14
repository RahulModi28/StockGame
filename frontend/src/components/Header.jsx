import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Search, Settings, User, LogOut, Menu, TrendingUp } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import Logo from './Logo';

import { useTheme } from '../context/ThemeContext';
import { Moon, Sun } from 'lucide-react';

const Header = () => {
    const { user, logout } = useAuth();
    const { isDarkMode, toggleTheme } = useTheme();
    const location = useLocation();
    const navigate = useNavigate();
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    const menuRef = useRef(null);
    const settingsRef = useRef(null);
    const mobileMenuRef = useRef(null);

    // Click outside handler for dropdowns
    useEffect(() => {
        function handleClickOutside(event) {
            // Profile Menu
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowProfileMenu(false);
            }
            // Settings Menu
            if (settingsRef.current && !settingsRef.current.contains(event.target)) {
                setShowSettingsMenu(false);
            }
            // Mobile Menu
            if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
                setShowMobileMenu(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { name: 'Dashboard', path: '/' },
        { name: 'Market', path: '/market' },
        { name: 'Portfolio', path: '/portfolio' },
        { name: 'News', path: '/news' },
        { name: 'Leaderboard', path: '/leaderboard' },
    ];

    if (user?.is_admin) {
        navItems.push({ name: 'Admin', path: '/admin' });
    }

    const isActive = (path) => location.pathname === path;

    return (
        <header className="flex items-center justify-between px-4 md:px-8 py-4 border-b bg-white dark:bg-header dark:border-border sticky top-0 z-50">
            {/* 1. Left Section - Logo & Navigation */}
            <div className="flex items-center gap-4 md:gap-12">

                {/* Mobile Menu Button (< 1024px) */}
                <div className="lg:hidden relative" ref={mobileMenuRef}>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowMobileMenu(!showMobileMenu)}
                    >
                        <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </Button>

                    {/* Mobile Navigation Dropdown */}
                    {showMobileMenu && (
                        <nav className="absolute left-0 mt-2 w-56 rounded-lg shadow-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 py-2 z-50">
                            {navItems.map((item) => (
                                <Link
                                    key={item.name}
                                    to={item.path}
                                    onClick={() => setShowMobileMenu(false)}
                                    className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${isActive(item.path)
                                        ? 'font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700'
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    {item.name}
                                </Link>
                            ))}
                        </nav>
                    )}
                </div>

                {/* Logo */}
                <Link to="/" className="flex items-center gap-2">
                    <Logo variant="simple" className="h-10 w-auto scale-[2.0]" />
                </Link>

                {/* Desktop Navigation (>= 1024px) */}
                <nav className="hidden lg:flex items-center gap-8">
                    {navItems.map((item) => (
                        <Link
                            key={item.name}
                            to={item.path}
                            className={`text-sm transition-colors ${isActive(item.path)
                                ? 'font-medium text-gray-900 dark:text-white'
                                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                }`}
                        >
                            {item.name}
                        </Link>
                    ))}
                </nav>
            </div>

            {/* 2. Right Section - Actions & Menus */}
            <div className="flex items-center gap-2 md:gap-4">

                {/* Search Bar (Desktop) */}
                <div className="relative hidden md:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        type="text"
                        placeholder="Search here..."
                        className="pl-10 w-64 text-[14px] bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600"
                    />
                </div>

                {/* Settings Dropdown */}
                <div className="relative hidden md:block" ref={settingsRef}>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                        className={showSettingsMenu ? 'bg-gray-100 dark:bg-gray-800' : ''}
                    >
                        <Settings className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </Button>

                    {showSettingsMenu && (
                        <div className="absolute right-0 mt-2 w-64 rounded-xl shadow-xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-4 z-50">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Settings</h3>

                            {/* Theme Toggle */}
                            <button
                                onClick={toggleTheme}
                                className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer text-left group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDarkMode ? 'bg-purple-900/30 text-purple-400' : 'bg-yellow-100 text-yellow-600'}`}>
                                        {isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">Dark Mode</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{isDarkMode ? 'On' : 'Off'}</p>
                                    </div>
                                </div>
                            </button>
                        </div>
                    )}
                </div>

                {/* Profile Profile Dropdown */}
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                        className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-gray-300 rounded-full"
                    >
                        <Avatar className="w-8 h-8 md:w-10 md:h-10 cursor-pointer hover:opacity-80 transition-opacity">
                            <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Rafael" alt="User Avatar" />
                            <AvatarFallback>RF</AvatarFallback>
                        </Avatar>
                    </button>

                    {showProfileMenu && (
                        <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 py-1 z-50">
                            {/* Optional User Info Header - not in strict spec but good UX */}
                            {user && (
                                <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user.name || 'User'}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                                </div>
                            )}

                            <Link
                                to="/profile"
                                onClick={() => setShowProfileMenu(false)}
                                className="w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                <User className="w-4 h-4" />
                                Go to Profile
                            </Link>
                            <button
                                onClick={() => {
                                    setShowProfileMenu(false);
                                    handleLogout();
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 flex items-center gap-2 transition-colors hover:bg-red-50 dark:hover:bg-red-900/10"
                            >
                                <LogOut className="w-4 h-4" />
                                Log Out
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
