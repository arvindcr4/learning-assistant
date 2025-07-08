import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="pt-20 pb-12">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-8">
              Personal Learning Assistant
            </h1>
            <p className="text-xl text-muted-foreground mb-12 max-w-3xl mx-auto">
              Your intelligent learning companion that adapts to your learning style, 
              tracks your progress, and helps you achieve your educational goals.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/auth/register"
                className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-primary-foreground bg-learning-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-learning-primary transition-all"
              >
                Get Started
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center px-8 py-3 border border-border text-base font-medium rounded-md text-foreground bg-background hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring transition-all"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
          <div className="text-center">
            <div className="bg-card rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4 shadow-medium border border-border">
              <span className="text-2xl">🎯</span>
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Personalized Learning
            </h3>
            <p className="text-muted-foreground">
              Adaptive learning paths tailored to your unique learning style and preferences.
            </p>
          </div>
          
          <div className="text-center">
            <div className="bg-card rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4 shadow-medium border border-border">
              <span className="text-2xl">📊</span>
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Progress Tracking
            </h3>
            <p className="text-muted-foreground">
              Monitor your learning journey with detailed analytics and insights.
            </p>
          </div>
          
          <div className="text-center">
            <div className="bg-card rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4 shadow-medium border border-border">
              <span className="text-2xl">🤖</span>
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              AI-Powered Assistance
            </h3>
            <p className="text-muted-foreground">
              Get intelligent recommendations and support throughout your learning process.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}