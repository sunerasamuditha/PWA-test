import { Link } from 'react-router-dom';

function Home() {
  return (
    <div className="page">
      {/* Hero Section */}
      <section className="hero">
        <h1 className="hero-title">Welcome to WeCare</h1>
        <p className="hero-subtitle">
          Your comprehensive healthcare partner providing quality medical services 
          with compassionate care and modern technology.
        </p>
        <div className="hero-actions">
          <Link to="/register" className="btn btn-primary btn-lg">
            Get Started
          </Link>
          <Link to="/login" className="btn btn-secondary btn-lg">
            Patient Login
          </Link>
        </div>
      </section>

      {/* Services Overview */}
      <section className="services">
        <h2 className="text-center mb-8" style={{ fontSize: 'var(--font-size-3xl)', fontWeight: '600' }}>
          Our Services
        </h2>
        <div className="services-grid">
          <div className="service-card">
            <h3 className="service-card-title">Online Appointments</h3>
            <p className="service-card-description">
              Book and manage your medical appointments online. Choose your preferred 
              time slots and receive confirmation notifications.
            </p>
          </div>
          
          <div className="service-card">
            <h3 className="service-card-title">Medical Records</h3>
            <p className="service-card-description">
              Access your complete medical history, test results, and treatment 
              records securely from anywhere, anytime.
            </p>
          </div>
          
          <div className="service-card">
            <h3 className="service-card-title">Document Management</h3>
            <p className="service-card-description">
              Upload and manage your medical documents, insurance cards, and 
              prescriptions in one secure location.
            </p>
          </div>
          
          <div className="service-card">
            <h3 className="service-card-title">Billing & Payments</h3>
            <p className="service-card-description">
              View and pay your medical bills online. Track payment history and 
              download receipts for your records.
            </p>
          </div>
          
          <div className="service-card">
            <h3 className="service-card-title">Insurance Support</h3>
            <p className="service-card-description">
              Seamless insurance processing and verification. We work with major 
              insurance providers for your convenience.
            </p>
          </div>
          
          <div className="service-card">
            <h3 className="service-card-title">Travel Healthcare</h3>
            <p className="service-card-description">
              Specialized services for travelers including emergency care, 
              travel insurance, and medical assistance.
            </p>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="text-center mt-8">
        <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div className="card-body">
            <h3 className="mb-4" style={{ fontSize: 'var(--font-size-2xl)', fontWeight: '600' }}>
              Ready to Get Started?
            </h3>
            <p className="mb-4" style={{ color: 'var(--color-gray-600)' }}>
              Join thousands of patients who trust WeCare for their healthcare needs. 
              Create your account today and experience modern healthcare management.
            </p>
            <div style={{ display: 'flex', gap: 'var(--spacing-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/register" className="btn btn-primary">
                Create Account
              </Link>
              <Link to="/login" className="btn btn-secondary">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;