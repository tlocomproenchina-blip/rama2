import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export default function MobilePageTransition({ isNative, transitionKey, slideDirection, children }) {
  if (!isNative) {
    return children;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={transitionKey}
        initial={{ opacity: 0, x: slideDirection > 0 ? 28 : -28 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: slideDirection > 0 ? -20 : 20 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}