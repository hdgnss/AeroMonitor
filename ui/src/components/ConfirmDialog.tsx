import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog = ({
    isOpen,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    variant = 'warning'
}: ConfirmDialogProps) => {
    if (!isOpen) return null;

    const variantStyles = {
        danger: 'bg-destructive hover:bg-destructive/90',
        warning: 'bg-yellow-600 hover:bg-yellow-700', // Keep specific warning color
        info: 'bg-primary hover:bg-primary/90'
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-xl ${variant === 'danger' ? 'bg-destructive/10 text-destructive' : variant === 'warning' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-primary/10 text-primary'}`}>
                            <AlertTriangle size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-bold mb-2">{title}</h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">{message}</p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 p-6 border-t border-border bg-muted/40">
                    <button
                        onClick={onCancel}
                        className="flex-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium py-2.5 rounded-lg transition-colors text-sm"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-1 ${variantStyles[variant]} text-primary-foreground font-medium py-2.5 rounded-lg transition-colors shadow-lg text-sm`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};
