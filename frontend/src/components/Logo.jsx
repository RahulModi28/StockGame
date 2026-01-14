import React from 'react';

const Logo = ({ variant = 'full', className = '' }) => {
    // New PNG logo
    const imagePath = "/logo.png";

    return (
        <img
            src={imagePath}
            alt="Vantaggio Logo"
            className={`${className} object-contain`}
        />
    );
};

export default Logo;
