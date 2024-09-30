import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

const config: Config = {
  content: [
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './features/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      animation: {
        progress: 'progress 1s infinite linear',
      },
      keyframes: {
        progress: {
          '0%': {
            transform: ' translateX(0) scaleX(0)',
          },
          '40%': {
            transform: 'translateX(0) scaleX(0.4)',
          },
          '100%': {
            transform: 'translateX(100%) scaleX(0.5)',
          },
        },
      },
      transformOrigin: {
        'left-right': '0% 50%',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
    require('@tailwindcss/aspect-ratio'),
    require('@tailwindcss/container-queries'),
    plugin(({ addUtilities }) => {
      addUtilities({
        '.link': {
          color: '#3182ce',
          textDecoration: 'underline',
          '&:hover': {
            color: '#2c5282',
          },
        },
      });
    }),
  ],
};
export default config;
