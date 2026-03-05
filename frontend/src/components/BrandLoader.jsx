import React from 'react';
import { motion } from 'framer-motion';

const BrandLoader = ({ isFullScreen = false, speed = 'fast' }) => {
    const duration = speed === 'fast' ? 1 : 2;
    
    const content = (
        <div className="relative p-[2px] overflow-hidden rounded-full flex items-center justify-center">
            {/* Spinning gradient border */}
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: duration, ease: "linear" }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[conic-gradient(from_0deg,transparent_0_300deg,#8b5cf6_360deg)]"
            />
            {/* Inner content masking the inner gradient */}
            <div className="relative flex items-center gap-2.5 bg-page px-8 py-4 rounded-full">
                <img src="/icon-512.png" height={24} width={24} alt="" />
                <span className="text-md font-bold tracking-[0.15em] text-heading mt-0.5">ATTENDEASE</span>
            </div>
        </div>
    );

    if (isFullScreen) {
        return (
            <motion.div 
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 flex items-center justify-center bg-page z-50"
            >
                {content}
            </motion.div>
        );
    }

    return content;
};

export default BrandLoader;
