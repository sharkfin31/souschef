import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { FaSpinner, FaCheck, FaPen, FaTimes } from 'react-icons/fa';
import { FiUser, FiLogOut } from 'react-icons/fi';
import { format } from 'date-fns';

interface ProfileData {
  id: string;
  full_name: string;
  phone_number: string;
  avatar_url: string | null;
  created_at: string;
}

const Profile = () => {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  
  // Store original values when editing starts
  const [originalFullName, setOriginalFullName] = useState('');
  const [originalPhoneNumber, setOriginalPhoneNumber] = useState('');
  
  // Password update states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Auto-dismiss messages after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
          throw error;
        }

        setProfile(data);
        setFullName(data.full_name || '');
        setPhoneNumber(data.phone_number || '');
      } catch (error) {
        console.error('Error:', error);
        setMessage({ type: 'error', text: 'Failed to load profile data' });
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleStartEditName = () => {
    setOriginalFullName(fullName);
    setIsEditingName(true);
  };

  const handleCancelEditName = () => {
    setFullName(originalFullName);
    setIsEditingName(false);
  };

  const handleStartEditPhone = () => {
    setOriginalPhoneNumber(phoneNumber);
    setIsEditingPhone(true);
  };

  const handleCancelEditPhone = () => {
    setPhoneNumber(originalPhoneNumber);
    setIsEditingPhone(false);
  };

  const handleUpdateName = async () => {
    if (!user?.id) return;
    
    setMessage(null);
    setSaving(true);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      setProfile(prev => prev ? { ...prev, full_name: fullName } : null);
      setIsEditingName(false);
      setMessage({ type: 'success', text: 'Name updated successfully' });
    } catch (error) {
      console.error('Error updating name:', error);
      setMessage({ type: 'error', text: 'Failed to update name' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePhone = async () => {
    if (!user?.id) return;
    
    // Validate phone number
    if (!phoneNumber.match(/^\+?[1-9]\d{1,14}$/)) {
      setMessage({ type: 'error', text: 'Please enter a valid phone number in international format (e.g., +12345678901)' });
      return;
    }
    
    setMessage(null);
    setSaving(true);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          phone_number: phoneNumber,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      setProfile(prev => prev ? { ...prev, phone_number: phoneNumber } : null);
      setIsEditingPhone(false);
      setMessage({ type: 'success', text: 'Phone number updated successfully' });
    } catch (error) {
      console.error('Error updating phone:', error);
      setMessage({ type: 'error', text: 'Failed to update phone number' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: 'Please fill in all password fields' });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    
    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }
    
    setMessage(null);
    setIsChangingPassword(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) {
        throw error;
      }

      setNewPassword('');
      setConfirmPassword('');
      setMessage({ type: 'success', text: 'Password updated successfully' });
    } catch (error) {
      console.error('Error updating password:', error);
      setMessage({ type: 'error', text: 'Failed to update password' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      setMessage({ type: 'error', text: 'Failed to sign out' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <FaSpinner className="animate-spin text-primary text-2xl" />
        <span className="ml-2 text-gray-600">Loading profile...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
        <p className="text-center">Please sign in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || 'User'}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <FiUser className="text-2xl" />
            )}
          </div>
          
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {profile?.full_name || user?.email}
            </h1>
            <p className="text-gray-600 text-sm">
              Member since {user?.created_at ? format(new Date(user.created_at), 'MMMM yyyy') : 'recently'}
            </p>
          </div>
        </div>
        
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-1 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors duration-200"
        >
          <FiLogOut className='text-primary'/> Sign Out
        </button>
      </div>

      {/* Message Display */}
      {message && (
        <div
          className={`p-3 mb-6 rounded-md font-medium ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Profile Information Section */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Profile Information</h3>
        
        {/* Email Field */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-600"
          />
        </div>

        {/* Full Name Field */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm font-medium text-gray-700">
              Full Name
            </label>
            {!isEditingName ? (
              <button
                onClick={handleStartEditName}
                className="flex items-center gap-1 px-2 py-1 text-primary hover:text-primary-dark text-sm"
              >
                <FaPen size={14} />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleUpdateName}
                  disabled={saving}
                  className="flex items-center gap-1 px-2 py-1 text-green-600 hover:text-green-700 text-sm"
                  title="Save changes"
                >
                  {saving ? <FaSpinner className="animate-spin" size={14} /> : <FaCheck size={14} />}
                </button>
                <button
                  onClick={handleCancelEditName}
                  disabled={saving}
                  className="flex items-center gap-1 px-2 py-1 text-red-600 hover:text-red-700 text-sm"
                  title="Cancel changes"
                >
                  <FaTimes size={14} />
                </button>
              </div>
            )}
          </div>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={!isEditingName}
            className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
              isEditingName ? 'bg-white' : 'bg-gray-100'
            }`}
            placeholder="Enter your full name"
          />
        </div>

        {/* Phone Number Field */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm font-medium text-gray-700">
              Phone Number
            </label>
            {!isEditingPhone ? (
              <button
                onClick={handleStartEditPhone}
                className="flex items-center gap-1 px-2 py-1 text-primary hover:text-primary-dark text-sm"
              >
                <FaPen size={14} />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleUpdatePhone}
                  disabled={saving}
                  className="flex items-center gap-1 px-2 py-1 text-green-600 hover:text-green-700 text-sm"
                  title="Save changes"
                >
                  {saving ? <FaSpinner className="animate-spin" size={14} /> : <FaCheck size={14} />}
                </button>
                <button
                  onClick={handleCancelEditPhone}
                  disabled={saving}
                  className="flex items-center gap-1 px-2 py-1 text-red-600 hover:text-red-700 text-sm"
                  title="Cancel changes"
                >
                  <FaTimes size={14} />
                </button>
              </div>
            )}
          </div>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            disabled={!isEditingPhone}
            className={`w-full px-3 py-2 border border-gray-300 rounded-md ${
              isEditingPhone ? 'bg-white' : 'bg-gray-100'
            }`}
            placeholder="Enter phone number with country code (+1...)"
          />
          {isEditingPhone && (
            <p className="text-xs text-gray-500 mt-1">
              Example: +12345678901
            </p>
          )}
        </div>
      </div>

      {/* Change Password Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Change Password</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New Password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Enter new password"
          />
        </div>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Confirm New Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Confirm new password"
          />
        </div>
        
        <button
          onClick={handleUpdatePassword}
          disabled={isChangingPassword || !newPassword || !confirmPassword}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
        >
          {isChangingPassword ? (
            <>
              <FaSpinner className="animate-spin" />
              Updating...
            </>
          ) : (
            'Update Password'
          )}
        </button>
      </div>
    </div>
  );
};

export default Profile;
