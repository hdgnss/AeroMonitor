import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { CheckCircle2, XCircle, Zap, ShieldCheck, Clock, Trash2, Activity, Pause, Play, Download } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { ConfirmDialog } from '../components/ConfirmDialog';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

interface Heartbeat {
    id: number;
    status: string;
    latency: number;
    timestamp: string;
    data: string;
    message: string;
}

const MonitorDetail = ({ user }: { user: any }) => {
    const { showToast } = useToast();
    const { id } = useParams();
    const navigate = useNavigate();
    const [monitor, setMonitor] = useState<any>(null);
    const [heartbeats, setHeartbeats] = useState<Heartbeat[]>([]);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('basic');
    const [availableNotifs, setAvailableNotifs] = useState<any[]>([]);
    const [selectedNotifs, setSelectedNotifs] = useState<string[]>([]);
    const [editForm, setEditForm] = useState({
        name: '',
        target: '',
        interval: 60,
        metadata: '{}',
        notification_channels: '[]',
        expected_update_interval: 15,
        username: '',
        password: '',
        push_token: '',
        monitor_group: ''
    });
    const [exportForm, setExportForm] = useState({
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        end: new Date().toISOString().slice(0, 16)
    });

    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        variant?: 'danger' | 'warning' | 'info';
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, [id]);

    useEffect(() => {
        if (isEditModalOpen) {
            axios.get('/api/notifications').then(res => {
                setAvailableNotifs(res.data || []);
            });
        }
    }, [isEditModalOpen]);

    const handleEditClick = () => {
        if (!monitor) return;
        let expectedInterval = 15;
        let username = '';
        let password = '';
        let pushToken = '';
        try {
            const meta = JSON.parse(monitor?.monitor?.metadata || '{}');
            if (meta.expected_update_interval) expectedInterval = meta.expected_update_interval;
            if (meta.username) username = meta.username;
            if (meta.password) password = meta.password;
            if (meta.push_token) pushToken = meta.push_token;
        } catch (e) { }

        setEditForm({
            name: monitor.monitor.name,
            target: monitor.monitor.target,
            interval: monitor.monitor.interval,
            metadata: monitor.monitor.metadata,
            notification_channels: monitor.monitor.notification_channels,
            expected_update_interval: expectedInterval,
            username: username,
            password: password,
            push_token: pushToken,
            monitor_group: monitor.monitor.monitor_group || ''
        });
        setSelectedNotifs(monitor.notification_ids || []);
        setActiveTab('basic');
        setIsEditModalOpen(true);
    };

    const handleSaveMonitor = async () => {
        try {
            let finalMetadata = editForm.metadata;
            if (monitor?.monitor?.type === 'file_update') {
                try {
                    const metaObj = JSON.parse(finalMetadata || '{}');
                    metaObj.expected_update_interval = editForm.expected_update_interval;
                    metaObj.username = editForm.username;
                    metaObj.password = editForm.password;
                    finalMetadata = JSON.stringify(metaObj);
                } catch (e) {
                    finalMetadata = JSON.stringify({
                        expected_update_interval: editForm.expected_update_interval,
                        username: editForm.username,
                        password: editForm.password
                    });
                }
            } else if (monitor?.monitor?.type === 'push') {
                try {
                    const metaObj = JSON.parse(finalMetadata || '{}');
                    metaObj.push_token = editForm.push_token;
                    finalMetadata = JSON.stringify(metaObj);
                } catch (e) {
                    finalMetadata = JSON.stringify({
                        push_token: editForm.push_token
                    });
                }
            }

            await axios.put(`/api/monitors/${id}`, {
                ...editForm,
                metadata: finalMetadata,
                notification_ids: selectedNotifs
            });
            setIsEditModalOpen(false);
            fetchData();
            showToast('Monitor updated successfully!', 'success');
        } catch (err) {
            showToast('Failed to update monitor', 'error');
            console.error(err);
        }
    };

    const handleDeleteMonitor = async () => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Monitor',
            message: 'Are you sure you want to delete this monitor? This action cannot be undone.',
            variant: 'danger',
            onConfirm: async () => {
                setConfirmDialog({ ...confirmDialog, isOpen: false });
                try {
                    await axios.delete(`/api/monitors/${id}`);
                    showToast('Monitor deleted', 'info');
                    navigate('/');
                } catch (err) {
                    showToast('Failed to delete monitor', 'error');
                    console.error(err);
                }
            }
        });
    };

    const handlePause = async () => {
        setConfirmDialog({
            isOpen: true,
            title: 'Pause Monitor',
            message: 'Are you sure you want to pause this monitor? It will stop all health checks.',
            variant: 'warning',
            onConfirm: async () => {
                setConfirmDialog({ ...confirmDialog, isOpen: false });
                try {
                    await axios.put(`/api/monitors/${id}/pause`);
                    showToast('Monitor paused', 'info');
                    fetchData();
                } catch (err) {
                    showToast('Failed to pause monitor', 'error');
                }
            }
        });
    };

    const handleResume = async () => {
        setConfirmDialog({
            isOpen: true,
            title: 'Resume Monitor',
            message: 'Are you sure you want to resume this monitor?',
            variant: 'info',
            onConfirm: async () => {
                setConfirmDialog({ ...confirmDialog, isOpen: false });
                try {
                    await axios.put(`/api/monitors/${id}/resume`);
                    showToast('Monitor resumed', 'success');
                    fetchData();
                } catch (err) {
                    showToast('Failed to resume monitor', 'error');
                }
            }
        });
    };

    const handleClearHistory = async () => {
        setConfirmDialog({
            isOpen: true,
            title: 'Clear History',
            message: 'Are you sure you want to clear all history for this monitor? This cannot be undone.',
            variant: 'danger',
            onConfirm: async () => {
                setConfirmDialog({ ...confirmDialog, isOpen: false });
                try {
                    await axios.delete(`/api/monitors/${id}/heartbeats`);
                    fetchData();
                    showToast('History cleared successfully', 'success');
                } catch (err) {
                    showToast('Failed to clear history', 'error');
                    console.error(err);
                }
            }
        });
    };



    const handleExport = () => {
        const url = `/api/monitors/${id}/export?start=${exportForm.start}:00Z&end=${exportForm.end}:00Z`;
        window.location.href = url;
        setIsExportModalOpen(false);
        showToast('Export started', 'info');
    };

    const fetchData = async () => {
        try {
            const [mRes, hRes] = await Promise.all([
                axios.get(`/api/monitors/${id}`),
                axios.get(`/api/monitors/${id}/heartbeats`)
            ]);
            setMonitor(mRes.data);
            setHeartbeats(hRes.data || []);
        } catch (err) {
            console.error('Failed to fetch data', err);
        }
    };

    const toggleNotif = (id: string) => {
        setSelectedNotifs(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const calculateUptime = () => {
        if (heartbeats.length === 0) return "100.0";
        const upCount = heartbeats.filter(h => h.status === 'up').length;
        return ((upCount / heartbeats.length) * 100).toFixed(1);
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { mode: 'index' as const, intersect: false },
        },
        scales: {
            y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
            x: {
                grid: { display: false },
                ticks: {
                    maxRotation: 0,
                    autoSkip: true,
                    maxTicksLimit: 10
                }
            },
        },
    };

    const renderChart = (title: string, data: any[], color: string, isFill: boolean = true) => {
        const chartData = {
            labels: heartbeats.map(h => new Date(h.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })).reverse(),
            datasets: [
                {
                    label: title,
                    data: data.reverse(),
                    borderColor: color,
                    backgroundColor: isFill ? `${color}1A` : 'transparent',
                    fill: isFill,
                    tension: 0.4,
                    pointRadius: heartbeatDataPoints > 100 ? 0 : 3,
                },
            ],
        };

        return (
            <div key={title} className="bg-card border border-border p-8 rounded-2xl w-full">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg">{title}</h3>
                    <div className="flex gap-2 text-xs">
                        <span className="bg-secondary px-2 py-1 rounded text-muted-foreground">7 Days History</span>
                    </div>
                </div>
                <div className="h-72 w-full">
                    <Line data={chartData} options={options} />
                </div>
            </div>
        );
    };

    if (!monitor) return <div className="p-8 text-center text-muted-foreground">Loading monitor data...</div>;

    const currentMonitor = monitor.monitor;
    const heartbeatDataPoints = heartbeats.length;
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#06b6d4'];

    // Get all custom data keys
    const customKeys = new Set<string>();
    heartbeats.forEach(h => {
        try {
            const data = JSON.parse(h.data || '{}');
            Object.keys(data).forEach(k => customKeys.add(k));
        } catch (e) { }
    });

    return (
        <div className="w-full space-y-8">
            {/* Header Info */}
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-3xl font-bold">{currentMonitor.name}</h2>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${heartbeats[0]?.status === 'up' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                            {heartbeats[0]?.status || 'Unknown'}
                        </span>
                        {currentMonitor.paused && (
                            <span className="bg-secondary text-muted-foreground px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border border-border flex items-center gap-1">
                                <Pause size={10} /> Paused
                            </span>
                        )}
                    </div>
                    <p className="text-muted-foreground font-mono text-sm">
                        {currentMonitor.type === 'push'
                            ? `${window.location.origin}/api/push/${currentMonitor.id}`
                            : currentMonitor.target}
                    </p>
                    {user?.role === 'admin' && currentMonitor.type === 'push' && (() => {
                        try {
                            const meta = JSON.parse(currentMonitor.metadata || '{}');
                            if (meta.push_token) {
                                return (
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-bold uppercase">Auth Required</span>
                                        <span className="text-xs text-muted-foreground">Bearer: {meta.push_token}</span>
                                    </div>
                                );
                            }
                        } catch (e) { }
                        return null;
                    })()}
                </div>
                <div className="flex gap-2">
                    {user?.role === 'admin' && (
                        <>
                            <button onClick={() => setIsExportModalOpen(true)} className="bg-secondary hover:bg-secondary/80 text-secondary-foreground px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
                                <Download size={16} /> Export
                            </button>
                            <button onClick={handleEditClick} className="bg-secondary hover:bg-secondary/80 text-secondary-foreground px-4 py-2 rounded-lg font-medium transition-colors">Edit</button>
                            {currentMonitor.paused ? (
                                <button
                                    onClick={handleResume}
                                    className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                                >
                                    <Play size={16} /> Resume
                                </button>
                            ) : (
                                <button
                                    onClick={handlePause}
                                    className="bg-red-600/10 hover:bg-red-600/20 text-red-400 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                                >
                                    <Pause size={16} /> Pause
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card border border-border p-6 rounded-2xl flex items-center gap-4">
                    <div className="bg-emerald-500/10 p-4 rounded-xl text-emerald-500">
                        <Zap size={24} />
                    </div>
                    <div>
                        <p className="text-muted-foreground text-sm font-medium">Uptime (7d)</p>
                        <p className="text-2xl font-bold">{calculateUptime()}%</p>
                    </div>
                </div>
                <div className="bg-card border border-border p-6 rounded-2xl flex items-center gap-4">
                    <div className="bg-blue-500/10 p-4 rounded-xl text-blue-500">
                        <Clock size={24} />
                    </div>
                    <div>
                        <p className="text-muted-foreground text-sm font-medium">Avg Latency</p>
                        <p className="text-2xl font-bold">
                            {heartbeats.length > 0
                                ? Math.round(heartbeats.reduce((acc, h) => acc + h.latency, 0) / heartbeats.length)
                                : 0}ms
                        </p>
                    </div>
                </div>
                <div className="bg-card border border-border p-6 rounded-2xl flex items-center gap-4">
                    <div className="bg-purple-500/10 p-4 rounded-xl text-purple-500">
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <p className="text-muted-foreground text-sm font-medium">Monitoring Type</p>
                        <p className="text-2xl font-bold uppercase text-sm tracking-widest">{currentMonitor.type}</p>
                    </div>
                </div>
            </div>

            {/* File Update Stats */}
            {currentMonitor.type === 'file_update' && heartbeats.length > 0 && (() => {
                try {
                    // Find last 'up' heartbeat to show stats
                    const lastUp = heartbeats.find(h => h.status === 'up') || heartbeats[0];
                    const data = JSON.parse(lastUp?.data || '{}');
                    return (
                        <div className="bg-card border border-border p-6 rounded-2xl">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                <Activity size={20} className="text-primary" /> File Status
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <p className="text-muted-foreground text-sm font-medium mb-1">Current MD5 Hash</p>
                                    <p className="font-mono text-xs bg-muted p-2 rounded border border-border break-all">{data.current_md5 || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-sm font-medium mb-1">Last File Change</p>
                                    <p className="text-lg font-bold">
                                        {data.last_changed ? new Date(data.last_changed).toLocaleString() : 'Never/Unknown'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                } catch (e) { return null; }
            })()}

            {/* Charts Section */}
            <div className="space-y-6">
                {/* Always show Latency chart (now contains 'ping' data for push monitors) */}
                {renderChart(
                    'Response Times (ms)',
                    heartbeats.map(h => h.status === 'up' ? h.latency : null),
                    colors[0]
                )}

                {/* File Freshness Chart for File Update Monitor */}
                {currentMonitor.type === 'file_update' && renderChart(
                    'Time Since Last Update (seconds)',
                    heartbeats.map(h => {
                        if (h.status !== 'up') return null;
                        try {
                            const data = JSON.parse(h.data || '{}');
                            if (!data.last_changed) return null;
                            const lastChanged = new Date(data.last_changed).getTime();
                            const checkTime = new Date(h.timestamp).getTime();
                            return Math.max(0, Math.round((checkTime - lastChanged) / 1000));
                        } catch (e) { return null; }
                    }),
                    '#f59e0b'
                )}

                {/* Individual charts for push data */}
                {Array.from(customKeys).filter(k => k !== 'ping').map((key, idx) => {
                    const dataPoints = heartbeats.map(h => {
                        if (h.status !== 'up') return null;
                        try {
                            const data = JSON.parse(h.data || '{}');
                            if (key === 'current_md5' && data[key]) {
                                // Use first 4 hex chars as integer value for charting
                                return parseInt(data[key].substring(0, 4), 16);
                            }
                            return data[key] !== undefined ? parseFloat(data[key]) : null;
                        } catch (e) { return null; }
                    });

                    let chartLabel = key.charAt(0).toUpperCase() + key.slice(1);
                    if (key === 'current_md5') {
                        chartLabel = 'MD5';
                    } else if (key === 'last_changed') {
                        return null; // Don't chart timestamp
                    }

                    return renderChart(
                        chartLabel,
                        dataPoints,
                        colors[(idx + 1) % colors.length]
                    );
                })}
            </div>
            {/* Recent History */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-border bg-muted/40">
                    <h3 className="font-bold text-lg">Recent Checks</h3>
                </div>
                <div className="divide-y divide-border">
                    {heartbeats.slice(0, 15).map((h) => {
                        let md5Display = '';
                        try {
                            const d = JSON.parse(h.data || '{}');
                            // Show full MD5 if available
                            if (d.current_md5) md5Display = d.current_md5;
                        } catch (e) { }

                        return (
                            <div key={h.id} className="p-4 hover:bg-muted/50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        {h.status === 'up' ? <CheckCircle2 className="text-emerald-500" size={18} /> : <XCircle className="text-red-500" size={18} />}
                                        <span className="font-mono text-sm text-muted-foreground">{new Date(h.timestamp).toLocaleString()}</span>
                                        {md5Display && <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">{md5Display}</span>}
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <span className="text-sm font-medium text-foreground">{h.latency}ms</span>
                                        <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded capitalize">{h.status}</span>
                                    </div>
                                </div>
                                {h.message && (
                                    <div className={`mt-2 ml-7 text-xs ${h.status === 'down' ? 'text-red-400' : 'text-muted-foreground'}`}>
                                        {h.message}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center">
                            <h3 className="text-xl font-bold">Edit Monitor</h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                                <XCircle size={20} />
                            </button>
                        </div>

                        <div className="flex border-b border-border">
                            <button
                                onClick={() => setActiveTab('basic')}
                                className={`flex-1 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'basic' ? "border-primary text-primary" : "border-transparent text-slate-500"}`}
                            >
                                Basic Config
                            </button>
                            <button
                                onClick={() => setActiveTab('notifs')}
                                className={`flex-1 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'notifs' ? "border-primary text-primary" : "border-transparent text-slate-500"}`}
                            >
                                Enabled Notifications {selectedNotifs.length > 0 && `(${selectedNotifs.length})`}
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {activeTab === 'basic' ? (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-muted-foreground">Name</label>
                                            <input
                                                value={editForm.name}
                                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                className="w-full bg-secondary border border-transparent rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-medium text-muted-foreground">Group</label>
                                            <input
                                                value={editForm.monitor_group}
                                                onChange={e => setEditForm({ ...editForm, monitor_group: e.target.value })}
                                                className="w-full bg-secondary border border-transparent rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
                                                placeholder="e.g. Production"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-muted-foreground">Target URL / IP</label>
                                        <input
                                            value={editForm.target}
                                            onChange={e => setEditForm({ ...editForm, target: e.target.value })}
                                            className="w-full bg-secondary border border-transparent rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-sm font-medium text-muted-foreground">Interval (seconds)</label>
                                        <input
                                            type="number"
                                            value={editForm.interval}
                                            onChange={e => setEditForm({ ...editForm, interval: parseInt(e.target.value) })}
                                            className="w-full bg-secondary border border-transparent rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
                                        />
                                    </div>
                                    {currentMonitor.type === 'push' && (
                                        <div className="space-y-4 pt-2 border-t border-border">
                                            <h4 className="text-sm font-bold text-foreground">Push Configuration</h4>
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium text-muted-foreground">Push Token (Authorization Bearer)</label>
                                                <input
                                                    value={editForm.push_token}
                                                    onChange={e => setEditForm({ ...editForm, push_token: e.target.value })}
                                                    className="w-full bg-secondary border border-transparent rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
                                                    placeholder="Leave empty for no auth"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {currentMonitor.type === 'file_update' && (
                                        <div className="space-y-4 pt-2 border-t border-border">
                                            <h4 className="text-sm font-bold text-foreground">File Update Config</h4>
                                            <div className="space-y-1.5">
                                                <label className="text-sm font-medium text-muted-foreground">Expected Update Interval (minutes)</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={editForm.expected_update_interval}
                                                    onChange={e => setEditForm({ ...editForm, expected_update_interval: parseInt(e.target.value) })}
                                                    className="w-full bg-secondary border border-transparent rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium text-muted-foreground">Username (Optional)</label>
                                                    <input
                                                        value={editForm.username}
                                                        onChange={e => setEditForm({ ...editForm, username: e.target.value })}
                                                        className="w-full bg-secondary border border-transparent rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
                                                        autoComplete="off"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-sm font-medium text-muted-foreground">Password (Optional)</label>
                                                    <input
                                                        type="password"
                                                        value={editForm.password}
                                                        onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                                                        className="w-full bg-secondary border border-transparent rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
                                                        autoComplete="new-password"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2 min-h-[300px]">
                                    <p className="text-sm text-muted-foreground mb-4">Select the channels you want to receive alerts on for this monitor.</p>
                                    <div className="space-y-2">
                                        {availableNotifs.map(n => (
                                            <label key={n.id} className="flex items-center justify-between p-4 bg-secondary/50 border border-border rounded-xl cursor-pointer hover:border-primary/30 transition-all">
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
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4 items-center border-t border-border mt-4">
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleDeleteMonitor}
                                        className="bg-destructive/10 hover:bg-destructive/20 text-destructive p-2 rounded-lg transition-colors"
                                        title="Delete Monitor"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                    <button
                                        onClick={handleClearHistory}
                                        className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 p-2 rounded-lg transition-colors"
                                        title="Clear History"
                                    >
                                        <Clock size={20} />
                                    </button>
                                </div>
                                <div className="flex-1 flex gap-3">
                                    <button
                                        onClick={() => setIsEditModalOpen(false)}
                                        className="flex-1 bg-secondary hover:bg-secondary/80 text-foreground font-medium py-2 rounded-lg transition-colors text-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveMonitor}
                                        className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 rounded-lg transition-colors shadow-lg shadow-primary/40 text-sm"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Export Modal */}
            {isExportModalOpen && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card border border-border w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center">
                            <h3 className="text-xl font-bold">Export Data</h3>
                            <button onClick={() => setIsExportModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                                <XCircle size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-muted-foreground">Start Date</label>
                                    <input
                                        type="date"
                                        value={exportForm.start.split('T')[0]}
                                        onChange={e => setExportForm({ ...exportForm, start: `${e.target.value}T${exportForm.start.split('T')[1]}` })}
                                        className="w-full bg-secondary border border-transparent rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-muted-foreground">Start Time</label>
                                    <input
                                        type="time"
                                        value={exportForm.start.split('T')[1]}
                                        onChange={e => setExportForm({ ...exportForm, start: `${exportForm.start.split('T')[0]}T${e.target.value}` })}
                                        className="w-full bg-secondary border border-transparent rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-muted-foreground">End Date</label>
                                    <input
                                        type="date"
                                        value={exportForm.end.split('T')[0]}
                                        onChange={e => setExportForm({ ...exportForm, end: `${e.target.value}T${exportForm.end.split('T')[1]}` })}
                                        className="w-full bg-secondary border border-transparent rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-muted-foreground">End Time</label>
                                    <input
                                        type="time"
                                        value={exportForm.end.split('T')[1]}
                                        onChange={e => setExportForm({ ...exportForm, end: `${exportForm.end.split('T')[0]}T${e.target.value}` })}
                                        className="w-full bg-secondary border border-transparent rounded-lg px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary outline-none"
                                    />
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    onClick={() => setIsExportModalOpen(false)}
                                    className="flex-1 bg-secondary hover:bg-secondary/80 text-foreground font-medium py-2 rounded-lg transition-colors text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleExport}
                                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 rounded-lg transition-colors shadow-lg shadow-primary/40 text-sm flex items-center justify-center gap-2"
                                >
                                    <Download size={16} /> Download CSV
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Dialog */}
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                variant={confirmDialog.variant}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
            />
        </div>
    );
};

export default MonitorDetail;
