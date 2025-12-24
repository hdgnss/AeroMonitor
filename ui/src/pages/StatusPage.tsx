import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, AlertCircle, Globe } from 'lucide-react';

interface MonitorStatus {
    id: string;
    name: string;
    type: string;
    status: string;
    uptime: number;
}

interface StatusPageData {
    name: string;
    monitors: MonitorStatus[];
}

const StatusPage = () => {
    const { slug } = useParams();
    const [data, setData] = useState<StatusPageData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get(`/api/status-pages/${slug}`);
                setData(res.data);
            } catch (err) {
                console.error('Failed to fetch status page', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [slug]);

    if (loading) return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
    );

    if (!data) return (
        <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
            <div className="text-center">
                <AlertCircle size={48} className="mx-auto mb-4 text-muted-foreground" />
                <h1 className="text-2xl font-bold">Status Page Not Found</h1>
                <p>The requested status page does not exist or is private.</p>
            </div>
        </div>
    );

    const allUp = data.monitors.every(m => m.status === 'up');
    const someDown = data.monitors.some(m => m.status === 'down');

    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
            <div className="max-w-4xl mx-auto px-6 py-12 md:py-20">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                    <div>
                        <div className="flex items-center gap-3 text-primary font-semibold mb-2">
                            <Globe size={18} />
                            <span className="tracking-widest uppercase text-xs">System Status</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black">{data.name}</h1>
                    </div>
                    <div className="text-muted-foreground text-sm font-medium bg-secondary/50 px-4 py-2 rounded-full border border-border">
                        Updated every 30s
                    </div>
                </div>

                {/* Overall Status Banner */}
                <div className={`p-8 rounded-3xl mb-12 flex items-center gap-6 border ${allUp
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                    : someDown
                        ? 'bg-red-500/5 border-red-500/20 text-red-400'
                        : 'bg-amber-500/5 border-amber-500/20 text-amber-400'
                    }`}>
                    {allUp ? <CheckCircle2 size={40} /> : <AlertCircle size={40} />}
                    <div>
                        <h2 className="text-2xl font-bold">
                            {allUp ? 'All Systems Operational' : someDown ? 'Partial System Outage' : 'Degraded Performance'}
                        </h2>
                        <p className="opacity-80">
                            {allUp ? 'Everyone is happy! All services are functioning normally.' : 'We are currently investigating issues with some services.'}
                        </p>
                    </div>
                </div>

                {/* Services List */}
                <div className="bg-card border border-border rounded-3xl overflow-hidden backdrop-blur-sm">
                    <div className="px-8 py-6 border-b border-border bg-muted/40">
                        <h3 className="font-bold text-lg">Services Status</h3>
                    </div>
                    <div className="divide-y divide-border">
                        {data.monitors.map((m) => (
                            <div key={m.id} className="px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`w-3 h-3 rounded-full animate-pulse ${m.status === 'up' ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]' : 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                                        }`} />
                                    <div>
                                        <div className="font-bold text-lg">{m.name}</div>
                                        <div className="text-xs text-muted-foreground uppercase tracking-tighter">{m.type}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-8">
                                    <div className="text-right">
                                        <div className="text-muted-foreground text-xs font-medium uppercase mb-0.5">Uptime (24h)</div>
                                        <div className="font-mono font-bold text-lg">{m.uptime.toFixed(2)}%</div>
                                    </div>
                                    <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border ${m.status === 'up'
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                                        }`}>
                                        {m.status}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-12 text-center text-muted-foreground text-sm">
                    Powered by <span className="text-foreground font-bold">AeroMonitor</span>
                </div>
            </div>
        </div>
    );
};

export default StatusPage;
