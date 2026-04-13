import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Cable, ChartNoAxesCombined, CloudUpload, Cog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CustomBadge } from '@/components/landing/custom/badge';
import { CustomSubtitle } from '@/components/landing/custom/subtitle';
import { CustomTitle } from '@/components/landing/custom/title';

const HowItWorks = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const manuallyTriggered = useRef(false);

  const steps = [
    {
      id: 1,
      title: 'Upload Your Video',
      description:
        'Upload videos from your local machine or connect cloud storage.',
      image: '/upload-video.png',
      icon: CloudUpload,
    },
    {
      id: 2,
      title: 'Choose a Preset',
      description:
        'Select from built-in presets or create custom encoding profiles.',
      image: '/choose-preset.png',
      icon: Cog,
    },
    {
      id: 3,
      title: 'Transcode & Process',
      description:
        'FFmpeg processes your video with hardware acceleration support.',
      image: '/process.png',
      icon: ChartNoAxesCombined,
    },
    {
      id: 4,
      title: 'Download & Share',
      description:
        'Download the transcoded file or stream it directly from GoMPP.',
      image: '/share.png',
      icon: Cable,
    },
  ];

  const stepDuration = 5000; // 8 secon

  // Auto-advance steps with progress animation
  useEffect(() => {
    if (isPaused) return;

    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + 100 / (stepDuration / 50);
      });
    }, 50);

    const stepTimeout = setTimeout(() => {
      setActiveStep((prevStep) => {
        const next = (prevStep + 1) % steps.length;
        manuallyTriggered.current = false; // reset the manual flag here
        return next;
      });
    }, stepDuration);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(stepTimeout);
    };
  }, [activeStep, isPaused, steps.length]);

  const handleStepClick = (index: number) => {
    setActiveStep(index);
    manuallyTriggered.current = true; // Flag as manual
    setTimeout(() => setIsPaused(false), 4000); // Resume auto
  };

  return (
    <section className="py-24 border-b border-border/50">
      <div className="container mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="flex items-center justify-center flex-col text-center gap-5 mb-16"
        >
          <CustomBadge>Easy Setup</CustomBadge>

          <CustomTitle>How It Works</CustomTitle>

          <CustomSubtitle>
            Get your videos transcoded in four simple steps with GoMPP.
          </CustomSubtitle>
        </motion.div>

        {/* Main Content Grid */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="flex flex-col gap-12 max-w-6xl mx-auto"
        >
          {/* Left Side - Step Navigation */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  'flex flex-col items-center cursor-pointer transition-all duration-300 overflow-hidden',
                )}
                onClick={() => handleStepClick(index)}
              >
                <div className="size-12 bg-indigo-100/40 dark:bg-indigo-950/60 rounded-full flex items-center justify-center">
                  <step.icon className="size-5 text-indigo-500" />
                </div>

                <h3
                  className={cn(
                    'p-5 pb-3 text-xl font-semibold mb-0 transition-colors duration-300',
                    index === activeStep
                      ? 'text-foreground'
                      : 'text-muted-foreground',
                  )}
                >
                  {step.title}
                </h3>

                <div className="w-full h-0.5 bg-border/60">
                  <AnimatePresence>
                    {index === activeStep && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="h-0.5 w-full overflow-hidden"
                      >
                        {/* Progress Bar - moved to bottom */}
                        <motion.div
                          className="h-0.5 bg-gradient-to-r from-indigo-500 to-purple-400"
                          style={{ width: `${progress}%` }}
                          transition={{ duration: 0.05, ease: 'linear' }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>

          {/* Right Side - Fading Images */}
          <div className="relative w-full rounded-xl overflow-hidden border border-border shadow-xs shadow-black/5 bg-background">
            <div className="max-h-[50vh] overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeStep}
                  src={steps[activeStep].image}
                  alt={`${steps[activeStep].title} visualization`}
                  className="w-full h-full object-cover"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                />
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <p className="text-muted-foreground mb-4">
            Ready to get started? Upload your first video now.
          </p>
          <Button size="lg" asChild>
            <Link href="/signin">Upload Video Now</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
