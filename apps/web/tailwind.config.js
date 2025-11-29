/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    screens: {
      xs: '410px',
      // => @media (min-width: 410px) { ... }

      sm: '640px',
      // => @media (min-width: 640px) { ... }

      md: '768px',
      // => @media (min-width: 768px) { ... }

      lg: '1024px',
      // => @media (min-width: 1024px) { ... }

      xl: '1280px',
      // => @media (min-width: 1280px) { ... }

      '2xl': '1536px'
      // => @media (min-width: 1536px) { ... }
    },
    extend: {
      scale: {
        101: '1.01',
        102: '1.02'
      },
      keyframes: {
        'slide-up': {
          '0%': {
            transform: 'translateY(10px)',
            opacity: '0',
            visibility: 'hidden'
          },
          '1%': {
            visibility: 'visible'
          },
          '100%': {
            transform: 'translateY(0)',
            opacity: '1',
            visibility: 'visible'
          }
        },
        glow: {
          '0%': {
            'box-shadow': '0 0 10px 2px green'
          },
          '100%': {
            'box-shadow': '0 0 10px 2px green'
          },
          '50%': {
            'box-shadow': 'none'
          }
        }
      },
      animation: {
        'slide-up': 'slide-up 0.15s ease-out forwards var(--delay, 0ms)',
        'fill-forwards': 'forwards',
        pulsate: 'glow 0.75s ease-in-out infinite'
      },
      animationDelay: {
        ...Array.from({ length: 20 }, (_, i) => i * 50).reduce((acc, delay) => ({
          ...acc,
          [delay]: `${delay}ms`
        }), {})
      },
      spacing: {
        190: '190px',
        280: '280px',
        300: '300px',
        320: '320px'
      },
      borderWidth: {
        3: '3px'
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      colors: {
        black: 'hsl(var(--black) / <alpha-value>)',
        darkening: 'hsl(var(--darkening) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        midground: 'hsl(var(--midground) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        focus: 'hsl(var(--focus) / <alpha-value>)',
        selected: 'hsl(var(--selected) / <alpha-value>)',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        error: {
          DEFAULT: 'hsl(var(--error))',
          foreground: 'hsl(var(--error-foreground))'
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))'
        },
        'theme-background': 'hsl(var(--theme-background))',
        'theme-foreground': 'hsl(var(--theme-foreground))'
      },
      fontSize: {
        '2xs': '0.625rem'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}
