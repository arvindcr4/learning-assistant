import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import LanguageSwitcher from './components/LanguageSwitcher';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  // Enable static rendering
  setRequestLocale(locale);

  const t = useTranslations('common');
  const tDashboard = useTranslations('dashboard');
  const tNavigation = useTranslations('navigation');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('welcome')}
          </h1>
          <LanguageSwitcher />
        </header>

        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 mb-8 text-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              {tDashboard('welcome', { name: 'User' })}
            </h2>
            <p className="text-blue-100 mb-6 text-lg">
              {tDashboard('continueWhere')}
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <h3 className="font-semibold mb-2">{tDashboard('todaysGoal')}</h3>
                <p className="text-blue-100">2 hours of learning</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <h3 className="font-semibold mb-2">{tDashboard('learningStreak')}</h3>
                <p className="text-blue-100">7 days</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <h3 className="font-semibold mb-2">{tDashboard('weeklyProgress')}</h3>
                <p className="text-blue-100">75% complete</p>
              </div>
            </div>

            <button className="bg-white text-blue-600 px-6 py-3 rounded-lg font-medium hover:bg-blue-50 transition-colors">
              {tDashboard('quickActions')}
            </button>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {[
              { key: 'dashboard', icon: '📊' },
              { key: 'courses', icon: '📚' },
              { key: 'progress', icon: '📈' },
              { key: 'analytics', icon: '📊' },
              { key: 'chat', icon: '💬' },
              { key: 'quiz', icon: '❓' },
              { key: 'assessment', icon: '✅' },
              { key: 'recommendations', icon: '🎯' },
            ].map((item) => (
              <div
                key={item.key}
                className="flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group cursor-pointer"
              >
                <span className="text-2xl mb-2 group-hover:scale-110 transition-transform">
                  {item.icon}
                </span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">
                  {tNavigation(item.key as any)}
                </span>
              </div>
            ))}
          </div>
        </nav>

        {/* Main Content */}
        <main className="mt-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Recent Activity Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                {tDashboard('recentActivity')}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {tDashboard('continueWhere')}
              </p>
            </div>

            {/* Progress Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                {tNavigation('progress')}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {tDashboard('weeklyProgress')}
              </p>
            </div>

            {/* Recommendations Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                {tNavigation('recommendations')}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {tDashboard('recommendedForYou')}
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-16 text-center text-gray-600 dark:text-gray-400">
          <p>{t('language')}: {locale.toUpperCase()}</p>
          <p className="mt-2 text-sm">
            Complete internationalization system with RTL support, cultural adaptations, and 6 languages
          </p>
        </footer>
      </div>
    </div>
  );
}