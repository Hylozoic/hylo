/** @type {import('tailwindcss').Config} */
export default {
  future: {
    hoverOnlyWhenSupported: true
  },
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
      boxShadow: {
        // Sticky headers and menu bars that must read as a layer above the
        // content scrolling under them. The dark variant needs a much heavier
        // alpha: a 0.1 shadow is invisible against a dark surface.
        header: '0 4px 14px 0 rgba(0, 0, 0, 0.16)',
        'header-dark': '0 6px 18px 0 rgba(0, 0, 0, 0.45)'
      },
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
        },
        'menu-flash': {
          '0%, 100%': {
            'box-shadow': '0 0 0 0 hsl(var(--selected) / 0)',
            'background-color': 'hsl(var(--selected) / 0)'
          },
          '18%, 32%': {
            'box-shadow': '0 0 0 3px hsl(var(--selected) / 0.7)',
            'background-color': 'hsl(var(--selected) / 0.28)'
          },
          '50%': {
            'box-shadow': '0 0 0 0 hsl(var(--selected) / 0)',
            'background-color': 'hsl(var(--selected) / 0)'
          },
          '68%, 82%': {
            'box-shadow': '0 0 0 3px hsl(var(--selected) / 0.7)',
            'background-color': 'hsl(var(--selected) / 0.28)'
          }
        },
        'typing-dot': {
          '0%, 60%, 100%': { opacity: '0.25', transform: 'translateY(0)' },
          '30%': { opacity: '1', transform: 'translateY(-2px)' }
        }
      },
      animation: {
        'slide-up': 'slide-up 0.15s ease-out forwards var(--delay, 0ms)',
        'fill-forwards': 'forwards',
        pulsate: 'glow 0.75s ease-in-out infinite',
        'menu-flash': 'menu-flash 1.4s ease-in-out',
        'typing-dot': 'typing-dot 1.1s ease-in-out infinite'
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
        1: '1px',
        3: '3px'
      },
      borderRadius: {
        lg: '0.5rem',
        md: 'calc(0.5rem - 2px)',
        sm: 'calc(0.5rem - 4px)'
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
        'theme-highlight': 'hsl(var(--theme-highlight) / <alpha-value>)',
        'context-menu-background': 'hsl(var(--context-menu-background) / <alpha-value>)',
        chats: 'hsl(var(--chats) / <alpha-value>)',
        discussions: 'hsl(var(--discussions) / <alpha-value>)',
        events: 'hsl(var(--events) / <alpha-value>)',
        offers: 'hsl(var(--offers) / <alpha-value>)',
        projects: 'hsl(var(--projects) / <alpha-value>)',
        proposals: 'hsl(var(--proposals) / <alpha-value>)',
        requests: 'hsl(var(--requests) / <alpha-value>)',
        resources: 'hsl(var(--resources) / <alpha-value>)',
        members: 'hsl(var(--members) / <alpha-value>)'
      },
      fontSize: {
        '2xs': '0.625rem'
      }
    }
  },
  plugins: [require('tailwindcss-animate')]
}
