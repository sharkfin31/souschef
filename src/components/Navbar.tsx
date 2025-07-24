import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <nav className="bg-white shadow-md">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link to="/" className="flex items-center space-x-2">
            <img src="/src/assets/favicon.svg" alt="SousChef Logo" className="h-8 w-8" />
            <span className="text-xl font-bold text-text">SousChef</span>
          </Link>
          <div className="flex space-x-6">
            <Link to="/grocery-list" className="text-text hover:text-primary transition-colors">
              Grocery Lists
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
