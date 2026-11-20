import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B0F19',
        foreground: '#F3F4F6',
        card: {
          DEFAULT: '#111827',
          foreground: '#F9FAFB',
        },
        popover: {
          DEFAULT: '#111827',
          foreground: '#F9FAFB',
        },
        primary: {
          DEFAULT: '#2563EB',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#1F2937',
          foreground: '#E5E7EB',
        },
        muted: {
          DEFAULT: '#1E293B',
          foreground: '#94A3B8',
        },
        accent: {
          DEFAULT: '#1E293B',
          foreground: '#F8FAFC',
        },
        destructive: {
          DEFAULT: '#DC2626',
          foreground: '#FFFFFF',
        },
        border: '#1E293B',
        input: '#1E293B',
        ring: '#3B82F6',
        
        // Financial Workstation Semantic Colors
        financial: {
          gain: '#10B981',    // Positive returns / green
          loss: '#EF4444',    // Negative returns / red
          neutral: '#64748B', // Unchanged / slate
          exceptional: '#059669', // Stage A verdict >= 7.5
          excellent: '#2563EB',   // Stage A verdict >= 6.5
          good: '#D97706',        // Stage A verdict >= 5.5
          avoid: '#DC2626',       // Stage A verdict < 5.5
          hardstop: '#991B1B',    // Hard red flag trigger
          warning: '#B45309',     // Conditional / Data Quality warning
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        lg: '0.5rem',
        md: '0.375rem',
        sm: '0.25rem',
      },
    },
  },
  plugins: [],
};

export default config;
