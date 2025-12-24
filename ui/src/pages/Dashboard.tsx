import { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, CheckCircle2, Clock, Activity, X, Bell, XCircle, Pause } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Monitor {
    id: string;
    name: string;
    type: string;
    target: string;
    status: string;
    latency: number;
    uptime: number;
    paused: boolean;
    monitor_group?: string;
}

const Dashboard = ({ user }: { user: any }) => {
    const { showToast } = useToast();
    const [monitors, setMonitors] = useState<Monitor[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('basic');
    const [availableNotifs, setAvailableNotifs] = useState<any[]>([]);
    const [selectedNotifs, setSelectedNotifs] = useState<string[]>([]);
    const [newMonitor, setNewMonitor] = useState({
        name: '',
        type: 'http',
        target: '',
        interval: 20,
        expected_update_interval: 15, // Default for file update
        username: '',
        password: '',
        push_token: '',
        monitor_group: ''
    });

    useEffect(() => {
        fetchMonitors();
        const interval = setInterval(fetchMonitors, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (isModalOpen) {
            axios.get('/api/notifications').then(res => {
                setAvailableNotifs(res.data || []);
            });
        }
    }, [isModalOpen]);

    const fetchMonitors = async () => {
        try {
            const res = await axios.get('/api/monitors');
            setMonitors(res.data || []);
        } catch (err) {
            console.error('Failed to fetch monitors', err);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            let metadata = '{}';
            if (newMonitor.type === 'file_update') {
                metadata = JSON.stringify({
                    expected_update_interval: newMonitor.expected_update_interval,
                    username: newMonitor.username,
                    password: newMonitor.password
                });
            } else if (newMonitor.type === 'push') {
                metadata = JSON.stringify({
                    push_token: newMonitor.push_token
                });
            }

            await axios.post('/api/monitors', {
                ...newMonitor,
                owner_id: user?.email || 'default-user',
                notification_channels: '[]',
                metadata: metadata,
                notification_ids: selectedNotifs
            });
            setIsModalOpen(false);
            setNewMonitor({ name: '', type: 'http', target: '', interval: 20, expected_update_interval: 15, username: '', password: '', push_token: '', monitor_group: '' });
            setSelectedNotifs([]);
            setActiveTab('basic');
            fetchMonitors();
            showToast('Monitor created successfully!', 'success');
        } catch (err) {
            showToast('Failed to create monitor', 'error');
        }
    };

    const toggleNotif = (id: string) => {
        setSelectedNotifs(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                <div className="flex items-center space-x-2">
                    {user?.role === 'admin' && (
                        <button
                            onClick={() => { setIsModalOpen(true); setActiveTab('basic'); }}
                            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2"
                        >
                            <Plus size={16} className="mr-2" />
                            Add Monitor
                        </button>
                    )}
                </div>
            </div>

            <div className="flex items-center space-x-4 border-b border-border pb-4 mb-4">
                <button className="text-sm font-medium transition-colors hover:text-primary text-foreground border-b-2 border-primary pb-1">Overview</button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="text-sm font-medium tracking-tight text-muted-foreground">Total Monitors</div>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-2xl font-bold">{monitors.length}</div>
                    <p className="text-xs text-muted-foreground">+2 from last month</p>
                </div>
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="text-sm font-medium tracking-tight text-muted-foreground">Services Up</div>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-500">{monitors.filter(m => m.status === 'up').length}</div>
                    <p className="text-xs text-muted-foreground">All systems operational</p>
                </div>
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="text-sm font-medium tracking-tight text-muted-foreground">Services Down</div>
                        <XCircle className="h-4 w-4 text-red-500" />
                    </div>
                    <div className="text-2xl font-bold text-red-500">{monitors.filter(m => m.status !== 'up' && !m.paused).length}</div>
                    <p className="text-xs text-muted-foreground">Requires attention</p>
                </div>
                <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
                    <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="text-sm font-medium tracking-tight text-muted-foreground">Services Paused</div>
                        <Pause className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-2xl font-bold">{monitors.filter(m => m.paused).length}</div>
                    <p className="text-xs text-muted-foreground">Currently inactive</p>
                </div>
            </div>

            <div className="space-y-8">
                {monitors.length === 0 ? (
                    <div className="col-span-full py-20 border border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground">
                        <p>No monitors found</p>
                    </div>
                ) : (
                    (() => {
                        const grouped = monitors.reduce((acc, monitor) => {
                            const group = monitor.monitor_group || 'Ungrouped';
                            if (!acc[group]) acc[group] = [];
                            acc[group].push(monitor);
                            return acc;
                        }, {} as Record<string, Monitor[]>);

                        // Sort groups: defined groups first, then Ungrouped
                        const groups = Object.keys(grouped).sort((a, b) => {
                            if (a === 'Ungrouped') return 1;
                            if (b === 'Ungrouped') return -1;
                            return a.localeCompare(b);
                        });

                        return groups.map(groupName => (
                            <div key={groupName} className="space-y-4">
                                {groupName !== 'Ungrouped' && (
                                    <h3 className="text-xl font-bold tracking-tight text-foreground/80 flex items-center gap-2">
                                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                        {groupName}
                                    </h3>
                                )}
                                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                                    {grouped[groupName].map((monitor) => (
                                        <Link
                                            to={`/monitor/${monitor.id}`}
                                            key={monitor.id}
                                            className="rounded-xl border border-border bg-card text-card-foreground shadow-sm hover:border-primary/50 transition-all hover:shadow-md group block"
                                        >
                                            <div className="p-6 space-y-4">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-1">
                                                        <h3 className="font-semibold leading-none tracking-tight">{monitor.name}</h3>
                                                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{monitor.target}</p>
                                                    </div>
                                                    <div className={cn(
                                                        "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                                                        monitor.paused
                                                            ? "bg-secondary text-muted-foreground border border-border"
                                                            : monitor.status === 'up'
                                                                ? "bg-emerald-500/10 text-emerald-500"
                                                                : "bg-red-500/10 text-red-500"
                                                    )}>
                                                        {monitor.paused ? 'PAUSED' : monitor.status}
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between pt-4">
                                                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                                        <Activity className="h-4 w-4" />
                                                        <span>{monitor.type}</span>
                                                    </div>
                                                    <div className="flex items-center space-x-2 text-sm">
                                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                                        <span className="font-mono">{monitor.latency || 0}ms</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        ));
                    })()
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center">
                            <h3 className="text-xl font-bold">New Monitor</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex border-b border-border">
                            <button
                                onClick={() => setActiveTab('basic')}
                                className={cn(
                                    "flex-1 py-3 text-sm font-bold transition-all border-b-2",
                                    activeTab === 'basic' ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                                )}
                            >
                                Basic Config
                            </button>
                            <button
                                onClick={() => setActiveTab('notifs')}
                                className={cn(
                                    "flex-1 py-3 text-sm font-bold transition-all border-b-2",
                                    activeTab === 'notifs' ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                                )}
                            >
                                Notifications {selectedNotifs.length > 0 && `(${selectedNotifs.length})`}
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            {activeTab === 'basic' ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-muted-foreground">Name</label>
                                            <input
                                                required
                                                value={newMonitor.name}
                                                onChange={e => setNewMonitor({ ...newMonitor, name: e.target.value })}
                                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/50"
                                                placeholder="My Website"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-muted-foreground">Group (Optional)</label>
                                            <input
                                                value={newMonitor.monitor_group}
                                                onChange={e => setNewMonitor({ ...newMonitor, monitor_group: e.target.value })}
                                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/50"
                                                placeholder="e.g. Production"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-muted-foreground">Type</label>
                                            <select
                                                value={newMonitor.type}
                                                onChange={e => setNewMonitor({ ...newMonitor, type: e.target.value })}
                                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-primary outline-none transition-all appearance-none"
                                            >
                                                <option value="http">HTTP(s)</option>
                                                <option value="tcp">TCP</option>
                                                <option value="ping">Ping</option>
                                                <option value="push">Push</option>
                                                <option value="file_update">File Update</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-muted-foreground">Interval (s)</label>
                                            <input
                                                type="number"
                                                min="20"
                                                value={newMonitor.interval}
                                                onChange={e => setNewMonitor({ ...newMonitor, interval: parseInt(e.target.value) })}
                                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    {newMonitor.type === 'push' && (
                                        <div className="space-y-4 pt-2 border-t border-border">
                                            <h4 className="text-sm font-bold text-foreground">Push Configuration</h4>
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium text-muted-foreground">Push Token (Authorization Bearer)</label>
                                                <input
                                                    value={newMonitor.push_token}
                                                    onChange={e => setNewMonitor({ ...newMonitor, push_token: e.target.value })}
                                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/50"
                                                    placeholder="Leave empty for no auth"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {newMonitor.type === 'file_update' && (
                                        <div className="space-y-4 pt-2 border-t border-border">
                                            <h4 className="text-sm font-bold text-foreground">File Update Config</h4>
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium text-muted-foreground">Expected Update Interval (minutes)</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={newMonitor.expected_update_interval}
                                                    onChange={e => setNewMonitor({ ...newMonitor, expected_update_interval: parseInt(e.target.value) })}
                                                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium text-muted-foreground">Username (Optional)</label>
                                                    <input
                                                        value={newMonitor.username}
                                                        onChange={e => setNewMonitor({ ...newMonitor, username: e.target.value })}
                                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
                                                        autoComplete="off"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium text-muted-foreground">Password (Optional)</label>
                                                    <input
                                                        type="password"
                                                        value={newMonitor.password}
                                                        onChange={e => setNewMonitor({ ...newMonitor, password: e.target.value })}
                                                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
                                                        autoComplete="new-password"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-muted-foreground">Target / URL</label>
                                        <input
                                            required={newMonitor.type !== 'push'}
                                            value={newMonitor.target}
                                            onChange={e => setNewMonitor({ ...newMonitor, target: e.target.value })}
                                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/50"
                                            placeholder={newMonitor.type === 'push' ? 'Auto-generated' : 'https://example.com'}
                                            disabled={newMonitor.type === 'push'}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2 min-h-[300px]">
                                    <p className="text-sm text-muted-foreground mb-4">Select the channels you want to receive alerts on for this monitor.</p>
                                    <div className="space-y-2">
                                        {availableNotifs.map(n => (
                                            <label key={n.id} className="flex items-center justify-between p-4 bg-secondary/50 border border-border rounded-xl cursor-pointer hover:border-primary/50 transition-all">
                                                <div className="flex flex-col">
                                                    <span className="font-bold">{n.name} <span className="text-[10px] text-muted-foreground font-mono uppercase bg-secondary px-1.5 py-0.5 rounded">{n.type}</span></span>
                                                    <span className="text-xs text-muted-foreground">ID: {n.id}</span>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedNotifs.includes(n.id)}
                                                    onChange={() => toggleNotif(n.id)}
                                                    className="w-5 h-5 rounded border-border bg-card text-primary focus:ring-primary"
                                                />
                                            </label>
                                        ))}
                                        {availableNotifs.length === 0 && (
                                            <div className="py-10 text-center">
                                                <Bell className="mx-auto mb-2 text-muted-foreground" size={24} />
                                                <p className="text-sm text-muted-foreground">No notification channels enabled.</p>
                                                <Link to="/settings" className="text-xs text-primary hover:underline">Go to Settings</Link>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium py-2 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 rounded-lg transition-colors shadow-lg shadow-primary/40"
                                >
                                    Create Monitor
                                </button>
                            </div>
                        </form>
                    </div >
                </div >
            )}
        </div >
    );
};

export default Dashboard;
