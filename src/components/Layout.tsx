import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

const Layout = () => {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="container mx-auto flex-grow px-4 py-8 text-sm leading-relaxed text-foreground">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
