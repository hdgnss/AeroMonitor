import { useState, useEffect } from 'react';
import axios from 'axios';
import { Bell, User, Globe, Mail, MessageSquare, Users, Send, Monitor, Plus, Trash2, Edit2, X } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface NotificationChannel {
    id: string;
    name: string;
    type: string;
    config: string;
}

const NOTIFICATION_TYPES = {
    bark: {
        name: 'Bark (iOS)',
        icon: Globe,
        colorClass: 'text-blue-400',
        fields: [{ key: 'url', label: 'Bark URL', placeholder: 'https://bark.host/... (include your key)' }]
    },
    slack: {
        name: 'Slack Webhook',
        icon: MessageSquare,
        colorClass: 'text-emerald-400',
        fields: [{ key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://hooks.slack.com/services/...' }]
    },
    teams: {
        name: 'Microsoft Teams',
        icon: Users,
        colorClass: 'text-indigo-400',
        fields: [{ key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://xxx.webhook.office.com/...' }]
    },
    email: {
        name: 'Email (SMTP)',
        icon: Mail,
        colorClass: 'text-amber-400',
        fields: [
            { key: 'host', label: 'SMTP Host', placeholder: 'smtp.gmail.com' },
            { key: 'port', label: 'Port', type: 'number', placeholder: '587' },
            { key: 'from', label: 'From Address', placeholder: 'alerts@domain.com' },
            { key: 'to', label: 'To Address', placeholder: 'you@domain.com' },
            { key: 'username', label: 'Username' },
            { key: 'password', label: 'Password', type: 'password' },
        ]
    }
};

const Settings = () => {
    const { showToast } = useToast();
    const [notifChannels, setNotifChannels] = useState<NotificationChannel[]>([]);

    // Auth Settings State
    const [settings, setSettings] = useState({
        allow_password_auth: 'false',
        oidc_enabled: 'false',
        oidc_client_id: '',
        oidc_client_secret: '',
        oidc_auth_url: '',
        oidc_token_url: '',
        oidc_userinfo_url: '',
        oidc_redirect_url: window.location.origin + '/api/auth/callback',
        app_title: 'Monitor',
        app_logo_url: ''
    });

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({
        name: '',
        type: 'slack',
        config: {} as any
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [settingsRes, notifRes] = await Promise.all([
                axios.get('/api/settings'),
                axios.get('/api/notifications')
            ]);
            setSettings(prev => ({ ...prev, ...settingsRes.data }));
            setNotifChannels(notifRes.data || []);
        } catch (err) {
            console.error("Failed to load settings", err);
        }
    };

    const handleSaveAuth = async () => {
        try {
            await axios.post('/api/settings', settings);
            showToast('Authentication settings saved!', 'success');
        } catch (err) {
            showToast('Failed to save settings', 'error');
        }
    };

    const updateSetting = (key: string, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const openAddModal = () => {
        setEditingId(null);
        setEditForm({ name: '', type: 'slack', config: {} });
        setIsModalOpen(true);
    };

    const openEditModal = (channel: NotificationChannel) => {
        setEditingId(channel.id);
        let config = {};
        try {
            config = JSON.parse(channel.config);
        } catch (e) { }
        setEditForm({ name: channel.name, type: channel.type, config });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete ${name}?`)) return;
        try {
            await axios.delete(`/api/notifications/${id}`);
            setNotifChannels(prev => prev.filter(n => n.id !== id));
            showToast('Notification deleted', 'info');
        } catch (err) {
            showToast('Failed to delete notification', 'error');
        }
    };

    const handleSaveNotification = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                name: editForm.name,
                type: editForm.type,
                config: JSON.stringify(editForm.config)
            };

            if (editingId) {
                await axios.put(`/api/notifications/${editingId}`, payload);
                showToast('Notification updated', 'success');
            } else {
                await axios.post('/api/notifications', payload);
                showToast('Notification created', 'success');
            }
            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            showToast('Failed to save notification', 'error');
        }
    };

    const handleTestNotification = async () => {
        try {
            await axios.post('/api/notifications/test', {
                type: editForm.type,
                config: JSON.stringify(editForm.config)
            });
            showToast('Test notification sent!', 'success');
        } catch (err) {
            showToast('Failed to send test notification', 'error');
        }
    };

    const currentType = NOTIFICATION_TYPES[editForm.type as keyof typeof NOTIFICATION_TYPES];

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <section className="bg-card border border-border rounded-2xl p-8">
                <div className="flex items-center gap-4 mb-8">
                    <div className="bg-primary/10 p-3 rounded-xl text-primary">
                        <Monitor size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold">General Settings</h3>
                        <p className="text-muted-foreground text-sm">Customize application appearance</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="grid gap-2">
                        <label className="text-sm font-medium text-muted-foreground">Application Title</label>
                        <input
                            value={settings.app_title || ''}
                            onChange={e => updateSetting('app_title', e.target.value)}
                            className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                            placeholder="Monitor"
                        />
                    </div>
                    <div className="grid gap-2">
                        <label className="text-sm font-medium text-muted-foreground">Logo URL</label>
                        <input
                            value={settings.app_logo_url || ''}
                            onChange={e => updateSetting('app_logo_url', e.target.value)}
                            className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                            placeholder="https://example.com/logo.png"
                        />
                        <p className="text-xs text-muted-foreground">Leave empty to use default. Recommended height: 32px.</p>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={handleSaveAuth}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 px-6 rounded-lg transition-colors shadow-lg shadow-primary/40"
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </section>

            <section className="bg-card border border-border rounded-2xl p-8">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary/10 p-3 rounded-xl text-primary">
                            <Bell size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">Notifications</h3>
                            <p className="text-muted-foreground text-sm">Configure how you want to be alerted</p>
                        </div>
                    </div>
                    <button
                        onClick={openAddModal}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Plus size={16} /> Add Notification
                    </button>
                </div>

                <div className="space-y-4">
                    {notifChannels.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-border rounded-xl">
                            <p className="text-muted-foreground">No notification channels configured.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {notifChannels.map(channel => {
                                const typeDef = NOTIFICATION_TYPES[channel.type as keyof typeof NOTIFICATION_TYPES];
                                const Icon = typeDef?.icon || Bell;
                                const colorClass = typeDef?.colorClass || 'text-muted-foreground';

                                return (
                                    <div key={channel.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between group hover:border-primary/30 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 bg-secondary rounded-lg flex items-center justify-center ${colorClass}`}>
                                                <Icon size={24} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold">{channel.name}</h4>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span className="bg-secondary px-2 py-0.5 rounded capitalize">{channel.type}</span>
                                                    <span className="font-mono opacity-50 text-[10px]">{channel.id}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => openEditModal(channel)}
                                                className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                                                title="Edit"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(channel.id, channel.name)}
                                                className="p-2 hover:bg-destructive/10 rounded-lg transition-colors text-muted-foreground hover:text-destructive"
                                                title="Delete"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>

            <section className="bg-card border border-border rounded-2xl p-8">
                <div className="flex items-center gap-4 mb-8">
                    <div className="bg-purple-500/10 p-3 rounded-xl text-purple-500">
                        <User size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold">Authentication</h3>
                        <p className="text-muted-foreground text-sm">Manage users and OAuth providers</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Password Auth Toggle */}
                    <div className="flex items-center justify-between p-4 bg-muted/40 rounded-xl border border-border">
                        <div>
                            <p className="font-bold">Password Authentication</p>
                            <p className="text-xs text-muted-foreground">Allow users to login with email/password</p>
                        </div>
                        <button
                            onClick={() => updateSetting('allow_password_auth', settings.allow_password_auth === 'true' ? 'false' : 'true')}
                            className={`w-12 h-6 rounded-full relative transition-colors ${settings.allow_password_auth === 'true' ? 'bg-primary' : 'bg-input'
                                }`}
                        >
                            <div
                                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.allow_password_auth === 'true' ? 'right-1' : 'left-1'
                                    }`}
                            />
                        </button>
                    </div>

                    {/* OIDC Section */}
                    <div className="space-y-4 pt-4 border-t border-border">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="font-bold text-lg">Pocket ID (OIDC)</h4>
                                <p className="text-sm text-muted-foreground">Configure OpenID Connect provider</p>
                            </div>
                            <button
                                onClick={() => updateSetting('oidc_enabled', settings.oidc_enabled === 'true' ? 'false' : 'true')}
                                className={`w-12 h-6 rounded-full relative transition-colors ${settings.oidc_enabled === 'true' ? 'bg-emerald-600' : 'bg-input'
                                    }`}
                            >
                                <div
                                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.oidc_enabled === 'true' ? 'right-1' : 'left-1'
                                        }`}
                                />
                            </button>
                        </div>

                        {settings.oidc_enabled === 'true' && (
                            <div className="grid gap-4 pl-4 border-l-2 border-border mt-4">
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium text-muted-foreground">Client ID</label>
                                    <input
                                        value={settings.oidc_client_id}
                                        onChange={e => updateSetting('oidc_client_id', e.target.value)}
                                        className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium text-muted-foreground">Client Secret</label>
                                    <input
                                        type="password"
                                        value={settings.oidc_client_secret}
                                        onChange={e => updateSetting('oidc_client_secret', e.target.value)}
                                        className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium text-muted-foreground">Auth URL</label>
                                    <input
                                        value={settings.oidc_auth_url}
                                        onChange={e => updateSetting('oidc_auth_url', e.target.value)}
                                        className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                                        placeholder="https://pocket.domain.com/authorize"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium text-muted-foreground">Token URL</label>
                                    <input
                                        value={settings.oidc_token_url}
                                        onChange={e => updateSetting('oidc_token_url', e.target.value)}
                                        className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                                        placeholder="https://pocket.domain.com/api/oidc/token"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium text-muted-foreground">User Info URL</label>
                                    <input
                                        value={settings.oidc_userinfo_url}
                                        onChange={e => updateSetting('oidc_userinfo_url', e.target.value)}
                                        className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                                        placeholder="https://pocket.domain.com/api/oidc/userinfo"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <label className="text-sm font-medium text-muted-foreground">Redirect URL</label>
                                    <input
                                        value={settings.oidc_redirect_url}
                                        onChange={e => updateSetting('oidc_redirect_url', e.target.value)}
                                        className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                    <button
                        onClick={handleSaveAuth}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 px-6 rounded-lg transition-colors shadow-lg shadow-primary/40"
                    >
                        Save Changes
                    </button>
                </div>
            </section>

            {/* Notification Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center">
                            <h3 className="text-xl font-bold">{editingId ? 'Edit Notification' : 'Add Notification'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveNotification} className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-muted-foreground">Friendly Name</label>
                                <input
                                    required
                                    value={editForm.name}
                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
                                    placeholder="e.g. DevOps Slack"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-muted-foreground">Type</label>
                                <select
                                    value={editForm.type}
                                    onChange={e => setEditForm({ ...editForm, type: e.target.value, config: {} })}
                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-primary outline-none transition-all appearance-none"
                                >
                                    {Object.entries(NOTIFICATION_TYPES).map(([key, def]) => (
                                        <option key={key} value={key}>{def.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-4 pt-2 border-t border-border">
                                {currentType?.fields.map((field: any) => (
                                    <div key={field.key} className="space-y-1.5">
                                        <label className="text-sm font-medium text-muted-foreground">{field.label}</label>
                                        <input
                                            type={field.type || "text"}
                                            value={editForm.config[field.key] || ''}
                                            onChange={e => setEditForm({
                                                ...editForm,
                                                config: { ...editForm.config, [field.key]: e.target.value }
                                            })}
                                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
                                            placeholder={field.placeholder}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={handleTestNotification}
                                    className="flex-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                    <Send size={16} /> Test
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 rounded-lg transition-colors shadow-lg shadow-primary/40"
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
