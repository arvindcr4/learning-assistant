'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function DashboardPage() {
  const { user, session } = useAuth();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="bg-white shadow">
            <div className="px-4 py-6 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Welcome to your Learning Dashboard
                  </h1>
                  <p className="mt-1 text-sm text-gray-500">
                    Hello, {user?.name || user?.email}!
                  </p>
                </div>
                <SignOutButton className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500" />
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="mt-8">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Profile Card */}
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium">
                            {user?.name?.[0] || user?.email?.[0] || 'U'}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <h3 className="text-lg font-medium text-gray-900">Profile</h3>
                        <p className="text-sm text-gray-500">Manage your account</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Learning Progress Card */}
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 bg-green-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium">📚</span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <h3 className="text-lg font-medium text-gray-900">Learning Progress</h3>
                        <p className="text-sm text-gray-500">Track your progress</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Analytics Card */}
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-6">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 bg-purple-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium">📊</span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <h3 className="text-lg font-medium text-gray-900">Analytics</h3>
                        <p className="text-sm text-gray-500">View your stats</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Session Info */}
              <div className="mt-8 bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Session Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">User ID</h4>
                      <p className="mt-1 text-sm text-gray-900">{user?.id}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Email</h4>
                      <p className="mt-1 text-sm text-gray-900">{user?.email}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Role</h4>
                      <p className="mt-1 text-sm text-gray-900">{user?.role || 'user'}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Session ID</h4>
                      <p className="mt-1 text-sm text-gray-900 break-all">{session?.id}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}