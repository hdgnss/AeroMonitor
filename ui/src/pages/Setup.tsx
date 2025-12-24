
import { useState } from 'react';
import axios from 'axios';

const Setup = () => {
    const [formData, setFormData] = useState({
        site_name: 'AeroMonitor',
        admin_user: 'admin',
        admin_password: '',
        admin_email: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await axios.post('/api/setup', formData);
            // After successful setup, redirect to login with a hard reload to reset app state
            window.location.href = '/login';
        } catch (err: any) {
            setError(err.response?.data?.error || 'Setup failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                    Welcome to AeroMonitor
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                    Please configure your admin account to get started.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    <form className="space-y-6" onSubmit={handleSubmit}>
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded relative" role="alert">
                                <span className="block sm:inline">{error}</span>
                            </div>
                        )}

                        <div>
                            <label htmlFor="site_name" className="block text-sm font-medium text-gray-700">
                                Site Name
                            </label>
                            <div className="mt-1">
                                <input
                                    id="site_name"
                                    name="site_name"
                                    type="text"
                                    required
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    value={formData.site_name}
                                    onChange={e => setFormData({ ...formData, site_name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="admin_user" className="block text-sm font-medium text-gray-700">
                                Admin Username
                            </label>
                            <div className="mt-1">
                                <input
                                    id="admin_user"
                                    name="admin_user"
                                    type="text"
                                    required
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    value={formData.admin_user}
                                    onChange={e => setFormData({ ...formData, admin_user: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                Admin Email
                            </label>
                            <div className="mt-1">
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    required
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    value={formData.admin_email}
                                    onChange={e => setFormData({ ...formData, admin_email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                Admin Password
                            </label>
                            <div className="mt-1">
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                    value={formData.admin_password}
                                    onChange={e => setFormData({ ...formData, admin_password: e.target.value })}
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className={`w - full flex justify - center py - 2 px - 4 border border - transparent rounded - md shadow - sm text - sm font - medium text - white bg - blue - 600 hover: bg - blue - 700 focus: outline - none focus: ring - 2 focus: ring - offset - 2 focus: ring - blue - 500 ${loading ? 'opacity-50 cursor-not-allowed' : ''} `}
                            >
                                {loading ? 'Setting up...' : 'Complete Setup'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Setup;
