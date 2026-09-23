import React from 'react';
import { Header } from './Header';
import { Footer } from './Footer';

interface LayoutProps {
  children: React.ReactNode;
  headerProps?: {
    onRefresh?: () => void;
    isLoading?: boolean;
    lastUpdated?: string | null;
    showLiveStatus?: boolean;
  };
}

export const Layout: React.FC<LayoutProps> = ({ children, headerProps }) => {
  return (
    <div className="min-h-screen bg-aviation-950 flex flex-col text-slate-100 font-sans">
      <Header {...headerProps} />
      <main className="flex-1 w-full">{children}</main>
      <Footer />
    </div>
  );
};
