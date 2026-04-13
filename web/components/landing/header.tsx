import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Menu, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { GithubStars } from '@/components/landing/GithubStars';
import Logo from '@/components/landing/logo';

const Header = () => {
  const navItems = ['Home', 'Features', 'FAQ', 'Contact'];

  const { resolvedTheme, setTheme } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);

      // Always set 'home' as active when at the very top
      if (window.scrollY < 50) {
        setActiveSection('home');
        return;
      }

      // Track active section based on scroll position
      const sections = ['features', 'how-it-works', 'faq', 'contact'];
      const scrollPosition = window.scrollY + 200;
      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (
            scrollPosition >= offsetTop &&
            scrollPosition < offsetTop + offsetHeight
          ) {
            if (activeSection !== section) setActiveSection(section);
            return;
          }
        }
      }
      // Do not update activeSection if not at top and not in any section (last matched section stays active)
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeSection]);

  const handleNavClick = (item: string) => {
    setIsOpen(false);
    if (item === 'Home') {
      // Scroll to top of page for Home link
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    } else {
      const targetId = item.toLowerCase().replace(' ', '-');
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    }
  };

  const isActiveItem = (item: string) => {
    const sectionMap: { [key: string]: string } = {
      Home: 'home',
      Features: 'features',
      FAQ: 'faq',
      Contact: 'contact',
    };
    return activeSection === sectionMap[item];
  };

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-40 flex justify-center px-4 pt-4"
    >
      <div
        className={cn(
          'flex items-center justify-between gap-4 rounded-full px-5 py-2 transition-all duration-300 w-full max-w-6xl',
          'bg-white/10 dark:bg-white/5 backdrop-blur-xl shadow-lg border border-white/15 dark:border-white/10',
        )}
      >
        {/* Logo */}
        <div className="shrink-0">
          <Logo />
        </div>

        {/* Desktop Navigation - Center */}
        <nav className="hidden md:flex items-center gap-1 rounded-full bg-black/20 dark:bg-white/10 px-1.5 py-1">
          {navItems.map((item, index) => (
            <motion.button
              key={item}
              onClick={() => handleNavClick(item)}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: (index + 1) * 0.05 }}
              className={cn(
                'cursor-pointer relative px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200',
                isActiveItem(item)
                  ? 'bg-white/20 dark:bg-white/15 text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item}
            </motion.button>
          ))}
        </nav>

        {/* Right side: theme toggle, divider, buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Theme Toggle */}
          {mounted && (
            <Button
              className="cursor-pointer text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-full"
              variant="ghost"
              size="icon"
              onClick={() =>
                setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
              }
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
            </Button>
          )}

          {/* Divider */}
          <div className="hidden md:block h-6 w-px bg-foreground/15" />

          {/* Desktop CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <GithubStars
              repoUrl="https://github.com/gompp/gompp"
              count="33.0k"
            />
            <Button
              variant="ghost"
              className="cursor-pointer rounded-full text-foreground/80 hover:text-foreground hover:bg-white/10 border border-foreground/15 px-5"
              asChild
            >
              <a href="/signin">Login</a>
            </Button>
            <Button
              className="cursor-pointer rounded-full bg-indigo-500 hover:bg-indigo-600 text-white px-5"
              asChild
            >
              <a href="/signin">Sign up</a>
            </Button>
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden">
            <Drawer open={isOpen} onOpenChange={setIsOpen}>
              <DrawerTrigger asChild>
                <Button
                  className="cursor-pointer text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-full"
                  variant="ghost"
                  size="icon"
                >
                  <Menu className="size-4" />
                </Button>
              </DrawerTrigger>
              <DrawerContent className="px-6 pb-8">
                <DrawerTitle></DrawerTitle>
                <nav className="flex flex-col space-y-4 mt-6">
                  {navItems.map((item) => (
                    <Button
                      key={item}
                      onClick={() => handleNavClick(item)}
                      variant="ghost"
                      className={cn(
                        'w-full justify-start hover:text-indigo-600 dark:hover:text-indigo-400',
                        isActiveItem(item) &&
                          'text-indigo-600 dark:text-indigo-400 font-medium',
                      )}
                    >
                      {item}
                    </Button>
                  ))}
                  <div className="pt-4 flex flex-col gap-2">
                    <Button
                      variant="outline"
                      className="w-full rounded-full"
                      asChild
                    >
                      <a href="/signin">Login</a>
                    </Button>
                    <Button
                      className="w-full rounded-full bg-indigo-500 hover:bg-indigo-600 text-white"
                      asChild
                    >
                      <a href="/signin">Sign up</a>
                    </Button>
                  </div>
                </nav>
              </DrawerContent>
            </Drawer>
          </div>
        </div>
      </div>
    </motion.header>
  );
};

export default Header;
