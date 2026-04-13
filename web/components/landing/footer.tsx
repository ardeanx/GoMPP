import { motion } from 'framer-motion';
import { Mail, X } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import Logo from '@/components/landing/logo';

const GitHubIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.31.975.975 1.248 2.243 1.31 3.608.058 1.266.069 1.645.069 4.85s-.012 3.584-.07 4.85c-.062 1.366-.334 2.633-1.31 3.608-.975.975-2.243 1.248-3.608 1.31-1.266.058-1.645.069-4.85.069s-3.584-.012-4.85-.07c-1.366-.062-2.633-.334-3.608-1.31-.975-.975-1.248-2.243-1.31-3.608C2.175 15.584 2.163 15.204 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.31-3.608C4.518 2.497 5.785 2.224 7.15 2.163c1.266-.058 1.645-.069 4.85-.069zM12 0C8.741 0 8.332.013 7.052.072c-1.675.077-3.167.36-4.364 1.556C1.44 2.823 1.156 4.315 1.08 5.991c-.059 1.28-.072 1.689-.072 4.948s0 3.668.072 4.948c0 1.676 .36 3 .556 4 .196 .999 .46 1 .556 1 .096 .001 .36-.001 .556-1 .196 -1 .556 -2 .556 -4s0 -3668 -.072 -4948c-.077 -1676 -.36 -3 -1 -4C3 .432 2 .149 .556 .072C-.332 -.013 -.741 -.001 -12 -.001zM12 5a7 7 0 100 14A7 7 0 0012 5zm0 11a4 4 0 110-8A4 4 0 0112 16zm6 -11a1 .9999 0 11-2 .00001A1 .9999 0 0118 .9999z" />
  </svg>
);

const Footer = () => {
  const links = {
    Information: [
      { name: 'API', href: 'https://docs.gompp.net/api-reference' },
      { name: 'Documentation', href: 'https://docs.gompp.net' },
      {
        name: 'Community',
        href: 'https://github.com/ardeanx/gompp/discussions',
      },
      { name: 'Status', href: '/api/health' },
      { name: 'Who Created GoMPP?', href: 'https://ardeanbimasaputra.com' },
    ],
  };

  const socialLinks = [
    {
      icon: InstagramIcon,
      href: 'https://instagram.com/ardeanbimasaputra',
      label: 'Instagram',
    },
    { icon: GitHubIcon, href: 'https://github.com/ardeanx', label: 'GitHub' },
    {
      icon: LinkedInIcon,
      href: 'https://linkedin.com/in/ardeanbimasptra',
      label: 'LinkedIn',
    },
    { icon: Mail, href: 'mailto:ardeanbimasaputra@gmail.com', label: 'Email' },
  ];

  return (
    <footer className="bg-background relative overflow-hidden">
      <div className="container px-6 mx-auto pt-14 pb-6 border-b border-border/50">
        <div className="flex flex-col lg:flex-row justify-between items-start">
          {/* Logo and description - Left side */}
          <div className="lg:w-1/3 mb-12 lg:mb-0">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center mb-3">
                <Logo />
              </div>
              <p className="text-muted-foreground mb-6 max-w-sm">
                Open-source Media Processing Platform. Upload, process, and
                deliver media at scale with FFmpeg.
              </p>
              <div className="flex space-x-4">
                {socialLinks.map((social, index) => (
                  <motion.a
                    key={index}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="size-9 border border-border/60 text-muted-foreground rounded-md flex items-center justify-center hover:text-foreground transition-colors"
                    aria-label={social.label}
                  >
                    <social.icon className="size-4" />
                  </motion.a>
                ))}
              </div>
            </motion.div>
          </div>

          {/* 3 Column Menu - Right aligned */}
          <div className="flex justify-end">
            <div className="flex flex-wrap gap-8 lg:gap-16">
              {Object.entries(links).map(([category, items], categoryIndex) => (
                <motion.div
                  key={category}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: categoryIndex * 0.1 }}
                  viewport={{ once: true }}
                >
                  <h3 className="font-medium text-base mb-4 capitalize text-muted-foreground/80">
                    {category}
                  </h3>
                  <ul className="text-base space-y-2">
                    {items.map((item, index) => (
                      <li key={index}>
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent-foreground hover:text-indigo-600 transition-colors hover:underline"
                        >
                          {item.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        <Separator className="my-6 bg-border/50" />

        <div className="flex flex-col md:flex-row justify-between items-center">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} GoMPP. Made with ❤️ by{' '}
            <a
              href="https://ardeanbimasaputra.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-foreground hover:text-indigo-600 transition-colors hover:underline"
            >
              Ardean Bima Saputra
            </a>
            .
          </p>
          <p className="text-muted-foreground text-sm mt-4 md:mt-0">
            Inspired by Cloudflare Stream, Bunny Stream, AWS MediaConvert, and Mux Video.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
