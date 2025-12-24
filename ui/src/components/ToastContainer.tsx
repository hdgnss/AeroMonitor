import React from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { type ToastType } from '../contexts/ToastContext';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContainerProps {
    toasts: Toast[];
    removeToast: (id: string) => void;
}

const icons = {
    success: <CheckCircle className="text-emerald-500" size={18} />,
    error: <XCircle className="text-red-500" size={18} />,
    warning: <AlertCircle className="text-amber-500" size={18} />,
    info: <Info className="text-blue-500" size={18} />,
};

const styles = {
    success: 'border-emerald-500/20 bg-emerald-500/10',
    error: 'border-red-500/20 bg-red-500/10',
    warning: 'border-amber-500/20 bg-amber-500/10',
    info: 'border-blue-500/20 bg-blue-500/10',
};

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
    return (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`
                        pointer-events-auto
                        flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md
                        shadow-2xl animate-in slide-in-from-right-full duration-300
                        ${styles[toast.type]}
                    `}
                >
                    {icons[toast.type]}
                    <p className="text-sm font-medium text-slate-200">{toast.message}</p>
                    <button
                        onClick={() => removeToast(toast.id)}
                        className="text-slate-500 hover:text-slate-300 transition-colors ml-2"
                    >
                        <X size={16} />
                    </button>
                </div>
            ))}
        </div>
    );
};
