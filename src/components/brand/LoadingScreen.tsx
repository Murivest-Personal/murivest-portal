'use client'

import {motion} from 'framer-motion'
import {useReducedMotion} from 'framer-motion'
import {Monogram, Wordmark} from '@/components/brand/Wordmark'
import {BRAND} from '@/lib/constants'
import {cn} from '@/lib/utils'

export function LoadingScreen({
  className,
  title = 'Murivest Private Investor Account',
}: {
  className?: string
  title?: string
}) {
  const reduce = useReducedMotion()

  const float = {
    hidden: { y: reduce ? 0 : 8, opacity: reduce ? 1 : 0.6 },
    animate: {
      y: [reduce ? 0 : -12, reduce ? 0 : 12, reduce ? 0 : -12],
      opacity: [reduce ? 1 : 0.5, reduce ? 1 : 1, reduce ? 1 : 0.5],
    },
    transition: {
      duration: reduce ? 0.001 : 3,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  }

  return (
    <motion.div
      initial={{opacity: 0}}
      animate={{opacity: 1}}
      exit={{opacity: 0}}
      transition={{duration: 0.2}}
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center bg-primary text-ivory',
        className,
      )}
    >
      <motion.div
        variants={float}
        initial="hidden"
        animate="animate"
        className="relative flex flex-col items-center justify-center gap-4"
      >
        <Monogram className="h-20 w-20" />
        <Wordmark size="lg" tone="ivory" />
      </motion.div>

      <motion.div
        initial={{opacity: 0, y: 10}}
        animate={{opacity: 1, y: 0}}
        transition={{duration: 0.6, delay: 0.4}}
        className="mt-8 text-[10px] uppercase tracking-[0.24em] text-ivory/60 font-medium"
      >
        {title}
      </motion.div>

      <motion.div
        initial={{opacity: 0}}
        animate={{opacity: 1}}
        className="mt-6 flex gap-1"
      >
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            initial={{opacity: 0.3}}
            animate={{
              opacity: [0.3, 1, 0.3],
              transition: {duration: 1.2, repeat: Infinity, delay: i * 0.2},
            }}
            className="h-1 w-3 rounded-full bg-gold"
          />
        ))}
      </motion.div>
    </motion.div>
  )
}
