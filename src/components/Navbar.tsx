import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiUser } from 'react-icons/fi';

const Navbar = () => {
  const { user, loading } = useAuth();

  return (
    <nav className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link to="/" className="flex items-center space-x-2">
            <img src="/src/assets/favicon.svg" alt="SousChef Logo" className="h-8 w-8" />
            <span className="text-xl font-bold text-text">SousChef</span>
          </Link>
          <div className="flex space-x-6 items-center">
            <Link to="/grocery-list" className="text-text hover:text-primary transition-colors">
              Grocery Lists
            </Link>
            
            {!loading && (
              user ? (
                <div className="flex items-center space-x-4">
                  <Link to="/profile" className="text-text hover:text-primary transition-colors flex items-center">
                    <FiUser className="mr-1" />
                  </Link>
                </div>
              ) : (
                <Link to="/login" className="text-text hover:text-primary transition-colors">
                  Sign In
                </Link>
              )
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
