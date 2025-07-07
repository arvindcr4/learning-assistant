import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-20 pb-12">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-8">
              Personal Learning Assistant
            </h1>
            <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto">
              Your intelligent learning companion that adapts to your learning style, 
              tracks your progress, and helps you achieve your educational goals.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/auth/register"
                className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Get Started
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center px-8 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
          <div className="text-center">
            <div className="bg-white rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4 shadow-md">
              <span className="text-2xl">🎯</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Personalized Learning
            </h3>
            <p className="text-gray-600">
              Adaptive learning paths tailored to your unique learning style and preferences.
            </p>
          </div>
          
          <div className="text-center">
            <div className="bg-white rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4 shadow-md">
              <span className="text-2xl">📊</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Progress Tracking
            </h3>
            <p className="text-gray-600">
              Monitor your learning journey with detailed analytics and insights.
            </p>
          </div>
          
          <div className="text-center">
            <div className="bg-white rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4 shadow-md">
              <span className="text-2xl">🤖</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              AI-Powered Assistance
            </h3>
            <p className="text-gray-600">
              Get intelligent recommendations and support throughout your learning process.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}