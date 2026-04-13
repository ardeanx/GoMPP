import { motion } from 'framer-motion';
import { useBranding } from '@/components/theme-color-applier';

const Logo = () => {
  const { logoUrl } = useBranding();
  const resolvedLogo = logoUrl || '/gompp.webp';

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className="flex items-center gap-2 leading-0"
    >
      {resolvedLogo ? (
        <img
          src={resolvedLogo}
          alt="Logo"
          className="h-8 w-auto object-contain"
        />
      ) : (
        <>
          <svg
            className="size-5"
            viewBox="15 15 20 30"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g>
              <rect
                x="15"
                y="15"
                width="10"
                height="10"
                rx="2"
                className="transition-fill fill-indigo-300 dark:fill-indigo-600"
              />
              <rect
                x="25"
                y="25"
                width="10"
                height="10"
                rx="2"
                className="transition-fill fill-indigo-300 dark:fill-indigo-600"
              />
              <rect
                x="15"
                y="35"
                width="10"
                height="10"
                rx="2"
                className="transition-fill fill-indigo-300 dark:fill-indigo-600"
              />
            </g>
          </svg>

          <span className="text-2xl font-bold bg-gradient-to-r from-indigo-700 dark:from-indigo-400 to-indigo-400 dark:to-indigo-300 bg-clip-text text-transparent">
            GoMPP
          </span>
        </>
      )}
    </motion.div>
  );
};

export default Logo;
