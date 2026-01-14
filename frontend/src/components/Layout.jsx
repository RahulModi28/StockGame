import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';

import NewsTicker from './NewsTicker';

const Layout = () => {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-background">
            <Header />
            <NewsTicker />
            <main>
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
