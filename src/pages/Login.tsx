import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoginForm from '../components/auth/LoginForm';
import RegisterForm from '../components/auth/RegisterForm';
import { FaUserPlus, FaSignInAlt } from 'react-icons/fa';

const Login = () => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const { user, loading } = useAuth();
  
  // Redirect if user is already logged in
  if (user && !loading) {
    return <Navigate to="/" replace />;
  }

  const handleSwitchToLogin = () => {
    setActiveTab('login');
  };

  return (
    <div className="max-w-4xl mx-auto mt-8 p-6">
      <h1 className="text-3xl font-bold text-center mb-8">
        Welcome to SousChef!
      </h1>
      
      <div className="flex justify-center mb-6">
        <div className="flex bg-gray-100 rounded-full p-1 border">
          <button
            onClick={() => setActiveTab('login')}
            className={`px-6 py-2 rounded-full font-medium transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'login'
                ? 'bg-primary text-white shadow-md'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <FaSignInAlt /> Sign In
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`px-6 py-2 rounded-full font-medium transition-all duration-200 flex items-center gap-2 ${
              activeTab === 'register'
                ? 'bg-primary text-white shadow-md'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <FaUserPlus /> Register
          </button>
        </div>
      </div>
      
      {activeTab === 'login' ? (
        <LoginForm />
      ) : (
        <RegisterForm onSwitchToLogin={handleSwitchToLogin} />
      )}
    </div>
  );
};

export default Login;
