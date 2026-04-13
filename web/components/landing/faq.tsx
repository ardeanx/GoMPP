import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { CustomBadge } from '@/components/landing/custom/badge';
import { CustomSubtitle } from '@/components/landing/custom/subtitle';
import { CustomTitle } from '@/components/landing/custom/title';

const FAQ = () => {
  const faqs = [
    {
      question: 'What video formats does GoMPP support?',
      answer:
        'GoMPP supports all major formats including MP4, MKV, WebM, AVI, MOV, and more. It uses FFmpeg under the hood, so virtually any format is supported for both input and output.',
    },
    {
      question: 'Is GoMPP open-source?',
      answer:
        'Yes, GoMPP is fully open-source. You can self-host it on your own infrastructure, inspect the code, and contribute to its development on GitHub.',
    },
    {
      question: 'Does it support hardware acceleration?',
      answer:
        'Yes, GoMPP supports NVIDIA NVENC, Intel QSV, and VAAPI hardware acceleration for significantly faster transcoding on compatible hardware.',
    },
    {
      question: 'Can I create custom encoding presets?',
      answer:
        'Absolutely! GoMPP lets you create, save, and reuse custom presets with specific resolution, bitrate, codec, and audio settings tailored to your needs.',
    },
    {
      question: 'How does subtitle integration work?',
      answer:
        'You can burn-in or soft-embed subtitles in SRT, VTT, or ASS formats. GoMPP lets you customize font, size, position, and styling for professional results.',
    },
    {
      question: 'What storage backends are supported?',
      answer:
        'GoMPP supports local storage and S3-compatible object storage (AWS S3, MinIO, etc.) for both input sources and output destinations.',
    },
    {
      question: 'Can I monitor transcoding progress?',
      answer:
        'Yes, the analytics dashboard provides real-time progress tracking, job status, error reporting, and performance metrics for all your transcoding jobs.',
    },
    {
      question: 'Is there a limit on video file size?',
      answer:
        "There are no built-in file size limits. The only constraints are your server's storage capacity and the upload settings you configure.",
    },
  ];

  return (
    <section className="py-24 bg-background" id="faq">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="flex items-center justify-center flex-col text-center gap-5 mb-25"
        >
          <CustomBadge>FAQ</CustomBadge>

          <CustomTitle>Frequently Asked Questions</CustomTitle>

          <CustomSubtitle>
            Got questions? We&apos;ve got answers. Here are the most common
            questions about GoMPP.
          </CustomSubtitle>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <AccordionItem
                  value={`item-${index}`}
                  className="bg-background rounded-lg border! border-border px-6 hover:shadow-md transition-shadow"
                >
                  <AccordionTrigger className="text-start font-semibold text-foreground hover:text-indigo-600 data-[state=open]:text-indigo-600 transition-colors cursor-pointer">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-foreground leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              </motion.div>
            ))}
          </Accordion>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
          className="flex flex-col justify-center items-center gap-1.5 text-center mt-12"
        >
          <span className="text-muted-foreground">Still have questions?</span>

          <Link
            href="https://t.me/ardeanbimasaputra"
            className="text-indigo-600 hover:text-indigo-700 transition-colors hover:underline"
          >
            Contact Me
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default FAQ;
