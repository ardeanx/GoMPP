import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { CustomBadge } from '@/components/landing/custom/badge';
import { CustomSubtitle } from '@/components/landing/custom/subtitle';
import { CustomTitle } from '@/components/landing/custom/title';

const Contact = () => {
  const contactInfo = [
    {
      icon: Mail,
      title: 'Email',
      content: 'ardeanbimasaputra@gmail.com',
      href: 'mailto:ardeanbimasaputra@gmail.com',
      description: "Send us an email and we'll respond within 24 hours.",
    },
    {
      icon: Phone,
      title: 'Telegram',
      content: '@ardeanbimasaputra',
      href: 'https://t.me/ardeanbimasaputra',
      description: 'Chat with us directly on Telegram for quick support.',
    },
  ];

  return (
    <section
      id="contact"
      className="py-24 bg-zinc-50 dark:bg-zinc-950 border-b border-border/50"
    >
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="flex items-center justify-center flex-col text-center gap-5 mb-25"
        >
          <CustomBadge>Get in Touch</CustomBadge>

          <CustomTitle>Contact Us</CustomTitle>

          <CustomSubtitle>
            Have questions or ready to get started with GoMPP? Reach out to us
            through any of the channels below.
          </CustomSubtitle>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {contactInfo.map((info, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Link
                href={info.href}
                target={info.title === 'Telegram' ? '_blank' : undefined}
                rel={
                  info.title === 'Telegram' ? 'noopener noreferrer' : undefined
                }
                className="block group"
              >
                <Card className="border-border/50 transition-all duration-200 hover:border-indigo-500/30 hover:shadow-md h-full">
                  <CardContent className="p-8 flex flex-col items-center text-center gap-4">
                    <div className="size-12 rounded-full bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                      <info.icon className="size-5 text-indigo-500" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground text-lg mb-1">
                        {info.title}
                      </h4>
                      <p className="text-muted-foreground text-sm mb-3">
                        {info.description}
                      </p>
                      <span className="text-indigo-500 group-hover:text-indigo-400 font-medium text-sm transition-colors">
                        {info.content}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Contact;
