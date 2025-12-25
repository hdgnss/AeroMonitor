import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [oidcEnabled, setOidcEnabled] = useState(false);
    const [passwordAuthEnabled, setPasswordAuthEnabled] = useState(false);
    const [branding, setBranding] = useState({ title: 'Monitor', logoUrl: '' });
    const navigate = useNavigate();

    useEffect(() => {
        // Check if already authenticated and get public settings
        axios.get('/api/auth/me')
            .then(() => navigate('/'))
            .catch(() => { });

        axios.get('/api/settings/public')
            .then(res => {
                if (res.data.oidc_enabled) {
                    setOidcEnabled(true);
                }
                if (res.data.allow_password_auth) {
                    setPasswordAuthEnabled(true);
                }
                setBranding({
                    title: res.data.app_title || 'Monitor',
                    logoUrl: res.data.app_logo_url || ''
                });
            })
            .catch(() => { });
    }, [navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post('/api/auth/login', { username, password });
            window.location.href = '/';
        } catch (err) {
            setError('Invalid credentials');
        }
    };

    const handleOIDCLogin = () => {
        window.location.href = '/api/auth/oidc/login';
    };

    return (
        <div className="container relative h-[800px] flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-1 lg:px-0">
            <div className="lg:p-8">
                <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
                    <div className="flex flex-col space-y-2 text-center">
                        {branding.logoUrl && (
                            <img src={branding.logoUrl} alt="Logo" className="mx-auto h-12 w-12 object-contain" />
                        )}
                        <h1 className="text-2xl font-semibold tracking-tight">{branding.title}</h1>
                        <p className="text-sm text-muted-foreground">
                            Enter your credentials to sign in
                        </p>
                    </div>

                    <div className="grid gap-6">
                        {error && (
                            <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md text-center">
                                {error}
                            </div>
                        )}

                        {passwordAuthEnabled && (
                            <form onSubmit={handleLogin}>
                                <div className="grid gap-2">
                                    <div className="grid gap-1">
                                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="username">
                                            Username
                                        </label>
                                        <input
                                            id="username"
                                            placeholder="name"
                                            type="text"
                                            autoCapitalize="none"
                                            autoComplete="username"
                                            autoCorrect="off"
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="grid gap-1">
                                        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="password">
                                            Password
                                        </label>
                                        <input
                                            id="password"
                                            placeholder="••••••••"
                                            type="password"
                                            autoCapitalize="none"
                                            autoComplete="current-password"
                                            autoCorrect="off"
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <button
                                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 w-full mt-2"
                                        type="submit"
                                    >
                                        Sign In with Password
                                    </button>
                                </div>
                            </form>
                        )}

                        {passwordAuthEnabled && oidcEnabled && (
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-background px-2 text-muted-foreground">
                                        Or continue with
                                    </span>
                                </div>
                            </div>
                        )}

                        {oidcEnabled && (
                            <button
                                type="button"
                                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 w-full"
                                onClick={handleOIDCLogin}
                            >
                                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                                    <polyline points="10 17 15 12 10 7" />
                                    <line x1="15" y1="12" x2="3" y2="12" />
                                </svg>
                                OIDC
                            </button>
                        )}
                    </div>

                    <p className="px-8 text-center text-sm text-muted-foreground">
                        By clicking continue, you agree to our{" "}
                        <a href="#" className="underline underline-offset-4 hover:text-primary">
                            Terms of Service
                        </a>{" "}
                        and{" "}
                        <a href="#" className="underline underline-offset-4 hover:text-primary">
                            Privacy Policy
                        </a>
                        .
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
