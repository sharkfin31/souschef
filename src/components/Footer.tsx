import { FaGithub } from 'react-icons/fa';

const Footer = () => {
  return (
    <footer className="bg-text text-white py-6">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <p className="text-sm">© {new Date().getFullYear()} SousChef. All rights reserved.</p>
          </div>
          <div className="flex space-x-4">
            <a
              href="https://github.com/yourusername/souschef"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-accent transition-colors"
            >
              <FaGithub className="text-xl" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
