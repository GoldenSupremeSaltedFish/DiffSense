/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: 'var(--surface)',
        'surface-alt': 'var(--surface-alt)',
        border: 'var(--border)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        text: 'var(--text)',
        subtle: 'var(--subtle)',
        muted: 'var(--muted)',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(.2,.0,.0,1)',
        emphasized: 'cubic-bezier(.2,.0,.0,1.2)',
      },
      transitionDuration: {
        fast: '150ms',
        normal: '250ms',
        slow: '400ms',
      },
      boxShadow: {
        token: '0 1px 2px 0 var(--shadow-1), 0 2px 4px -2px var(--shadow-2)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'slide-y-in': {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'scale-in': {
          from: { transform: 'scale(.98)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in':
          'fade-in var(--motion-duration, 250ms) var(--motion-easing, cubic-bezier(.2,.0,.0,1)) forwards',
        'fade-out':
          'fade-out var(--motion-duration, 250ms) var(--motion-easing, cubic-bezier(.2,.0,.0,1)) forwards',
        'slide-y-in':
          'slide-y-in var(--motion-duration, 250ms) var(--motion-easing, cubic-bezier(.2,.0,.0,1)) forwards',
        'scale-in':
          'scale-in var(--motion-duration, 250ms) var(--motion-easing, cubic-bezier(.2,.0,.0,1)) forwards',
        shimmer: 'shimmer 1.2s linear infinite',
      },
    },
  },
  plugins: [],
} 
