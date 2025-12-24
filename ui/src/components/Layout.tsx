import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useLocation } from 'react-router-dom';
import { Settings as SettingsIcon, LayoutDashboard, User } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const Layout: React.FC<{ children: React.ReactNode, user: any }> = ({ children, user }) => {
    const location = useLocation();
    const [branding, setBranding] = useState({ title: 'GnssMonitor', logoUrl: '' });

    useEffect(() => {
        axios.get('/api/settings/public')
            .then(res => {
                const newBranding = {
                    title: res.data.app_title || 'GnssMonitor',
                    logoUrl: res.data.app_logo_url || ''
                };
                setBranding(newBranding);
                document.title = newBranding.title; // Update browser tab title
                console.log('Branding loaded:', newBranding);
            })
            .catch(err => {
                console.error('Failed to load branding:', err);
            });
    }, []);

    const handleLogout = () => {
        window.location.href = '/api/auth/logout';
    };

    const navItems = [
        { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
        ...(user?.role === 'admin' ? [{ name: 'Settings', icon: SettingsIcon, path: '/settings' }] : []),
    ];

    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
            <div className="border-b border-border">
                <div className="flex h-16 items-center px-4">
                    <div className="flex items-center gap-2 mr-6">
                        <img
                            src={branding.logoUrl || '/logo.svg'}
                            alt="Logo"
                            className="w-6 h-6 object-contain"
                        />
                        <span className="text-lg font-bold tracking-tight">{branding.title}</span>
                    </div>

                    <nav className="flex items-center space-x-4 lg:space-x-6 mx-6">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    "text-sm font-medium transition-colors hover:text-primary",
                                    location.pathname === item.path
                                        ? "text-foreground"
                                        : "text-muted-foreground"
                                )}
                            >
                                {item.name}
                            </Link>
                        ))}
                    </nav>

                    <div className="ml-auto flex items-center space-x-4">


                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/20 border border-border flex items-center justify-center overflow-hidden text-primary">
                                {user?.picture ? (
                                    <img src={user.picture} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={16} />
                                )}
                            </div>
                            <button
                                onClick={handleLogout}
                                className="text-sm font-medium text-muted-foreground hover:text-destructive transition-colors ml-2"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <main className="flex-1 space-y-4 p-8 pt-6">
                {children}
            </main>
        </div>
    );
};

export default Layout;
