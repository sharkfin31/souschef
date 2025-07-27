import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { FaSpinner, FaEye, FaEyeSlash, FaQuestionCircle } from 'react-icons/fa';
import WhatsAppHelpModal from './WhatsAppHelpModal';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

const RegisterForm = ({ onSwitchToLogin }: RegisterFormProps) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [whatsappApiKey, setWhatsappApiKey] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWhatsAppHelp, setShowWhatsAppHelp] = useState(false);
  
  const { signUp } = useAuth();
  const { addNotification } = useNotification();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName || !email || !phoneNumber || !whatsappApiKey || !password || !confirmPassword) {
      addNotification('error', 'Please fill in all fields');
      return;
    }
    
    if (password !== confirmPassword) {
      addNotification('error', 'Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      addNotification('error', 'Password must be at least 6 characters');
      return;
    }

    // Validate phone number format
    if (!phoneNumber.match(/^\+?[1-9]\d{1,14}$/)) {
      addNotification('error', 'Please enter a valid phone number in international format (e.g., +12345678901)');
      return;
    }

    setIsSubmitting(true);

    try {
      const { success, error } = await signUp(email, password, fullName, phoneNumber, whatsappApiKey);

      if (success) {
        if (error) {
          // This means signup was successful but needs email confirmation
          addNotification('success', error);
          setTimeout(() => {
            onSwitchToLogin();
          }, 3000);
        } else {
          addNotification('success', 'Registration successful! Welcome to SousChef!');
        }
      } else {
        addNotification('error', error || 'Failed to register');
      }
    } catch (err) {
      addNotification('error', 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-center mb-6">Create Account</h2>
        
        <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="fullName" className="block text-gray-700 mb-1">
            Full Name
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
            placeholder="John Doe"
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="email" className="block text-gray-700 mb-1">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
            placeholder="johndoe@gmail.com"
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="phoneNumber" className="block text-gray-700 mb-1">
            Phone Number
          </label>
          <input
            id="phoneNumber"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
            placeholder="+12345678901"
            required
          />
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="whatsappApiKey" className="block text-gray-700">
              WhatsApp API Key
            </label>
            <button
              type="button"
              onClick={() => setShowWhatsAppHelp(true)}
              className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
            >
              <FaQuestionCircle className="mr-1" size={14} />
              How to get this?
            </button>
          </div>
          <input
            id="whatsappApiKey"
            type="text"
            value={whatsappApiKey}
            onChange={(e) => setWhatsappApiKey(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
            placeholder="*******"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            This allows SousChef to send grocery lists to your WhatsApp
          </p>
        </div>
        
        <div className="mb-4">
          <label htmlFor="password" className="block text-gray-700 mb-1">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary pr-10"
              placeholder="**********"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label htmlFor="confirmPassword" className="block text-gray-700 mb-1">
            Confirm Password
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary pr-10"
              placeholder="**********"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
        </div>
        
        <button
          type="submit"
          className="w-full bg-primary text-white py-2 px-4 rounded-md hover:bg-primary-dark transition-colors duration-200 flex justify-center items-center"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <FaSpinner className="animate-spin mr-2" />
          ) : null}
          {isSubmitting ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>
      </div>
      
      <WhatsAppHelpModal 
        isOpen={showWhatsAppHelp} 
        onClose={() => setShowWhatsAppHelp(false)} 
      />
    </>
  );
};

export default RegisterForm;
