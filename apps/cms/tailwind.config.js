/** @type {import('tailwindcss').Config} */
export default {
	darkMode: ['class'],
	content: [
		'./app/**/*.{js,ts,jsx,tsx,mdx}',
		'./pages/**/*.{js,ts,jsx,tsx,mdx}',
		'./components/**/*.{js,ts,jsx,tsx,mdx}',
	],
	theme: {
		extend: {
			colors: {
				// Linear-inspired color system
				background: {
					DEFAULT: 'rgb(var(--background) / <alpha-value>)',
					secondary: 'rgb(var(--background-secondary) / <alpha-value>)',
					tertiary: 'rgb(var(--background-tertiary) / <alpha-value>)',
				},
				foreground: {
					DEFAULT: 'rgb(var(--foreground) / <alpha-value>)',
					muted: 'rgb(var(--foreground-muted) / <alpha-value>)',
					subtle: 'rgb(var(--foreground-subtle) / <alpha-value>)',
				},
				border: {
					DEFAULT: 'rgb(var(--border) / <alpha-value>)',
					hover: 'rgb(var(--border-hover) / <alpha-value>)',
				},
				accent: {
					blue: 'rgb(var(--accent-blue) / <alpha-value>)',
					pink: 'rgb(var(--accent-pink) / <alpha-value>)',
					purple: 'rgb(var(--accent-purple) / <alpha-value>)',
					green: 'rgb(var(--accent-green) / <alpha-value>)',
					red: 'rgb(var(--accent-red) / <alpha-value>)',
					orange: 'rgb(var(--accent-orange) / <alpha-value>)',
				},
				// shadcn/ui compatibility
				card: {
					DEFAULT: 'rgb(var(--card) / <alpha-value>)',
					foreground: 'rgb(var(--card-foreground) / <alpha-value>)'
				},
				popover: {
					DEFAULT: 'rgb(var(--popover) / <alpha-value>)',
					foreground: 'rgb(var(--popover-foreground) / <alpha-value>)'
				},
				primary: {
					DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
					foreground: 'rgb(var(--primary-foreground) / <alpha-value>)'
				},
				secondary: {
					DEFAULT: 'rgb(var(--secondary) / <alpha-value>)',
					foreground: 'rgb(var(--secondary-foreground) / <alpha-value>)'
				},
				muted: {
					DEFAULT: 'rgb(var(--muted) / <alpha-value>)',
					foreground: 'rgb(var(--muted-foreground) / <alpha-value>)'
				},
				destructive: {
					DEFAULT: 'rgb(var(--destructive) / <alpha-value>)',
					foreground: 'rgb(var(--destructive-foreground) / <alpha-value>)'
				},
				input: 'rgb(var(--input) / <alpha-value>)',
				ring: 'rgb(var(--ring) / <alpha-value>)',
				sidebar: {
					DEFAULT: 'rgb(var(--sidebar-background) / <alpha-value>)',
					foreground: 'rgb(var(--sidebar-foreground) / <alpha-value>)',
					primary: 'rgb(var(--sidebar-primary) / <alpha-value>)',
					'primary-foreground': 'rgb(var(--sidebar-primary-foreground) / <alpha-value>)',
					accent: 'rgb(var(--sidebar-accent) / <alpha-value>)',
					'accent-foreground': 'rgb(var(--sidebar-accent-foreground) / <alpha-value>)',
					border: 'rgb(var(--sidebar-border) / <alpha-value>)',
					ring: 'rgb(var(--sidebar-ring) / <alpha-value>)'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			fontSize: {
				'display': ['2rem', { lineHeight: '1.2', fontWeight: '600' }],
				'h1': ['1.5rem', { lineHeight: '1.2', fontWeight: '600' }],
				'h2': ['1.25rem', { lineHeight: '1.2', fontWeight: '600' }],
				'h3': ['1rem', { lineHeight: '1.2', fontWeight: '600' }],
				'body': ['0.875rem', { lineHeight: '1.5', fontWeight: '400' }],
				'small': ['0.8125rem', { lineHeight: '1.4', fontWeight: '400' }],
				'tiny': ['0.75rem', { lineHeight: '1.4', fontWeight: '400' }],
			},
			spacing: {
				'0': '0px',
				'1': '4px',
				'2': '8px',
				'3': '12px',
				'4': '16px',
				'5': '20px',
				'6': '24px',
				'8': '32px',
				'10': '40px',
				'12': '48px',
				'16': '64px',
				'20': '80px',
			},
			fontFamily: {
				sans: [
					'-apple-system',
					'BlinkMacSystemFont',
					'"Segoe UI"',
					'Roboto',
					'Oxygen',
					'Ubuntu',
					'Cantarell',
					'"Fira Sans"',
					'"Droid Sans"',
					'"Helvetica Neue"',
					'sans-serif',
				],
			},
			boxShadow: {
				'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
				'DEFAULT': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
				'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
				'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
			},
			keyframes: {
				'progress-bar': {
					'0%': { transform: 'translateX(-100%)' },
					'100%': { transform: 'translateX(400%)' },
				},
			},
			animation: {
				'progress-bar': 'progress-bar 1.2s ease-in-out infinite',
			},
			transitionTimingFunction: {
				'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
			},
			transitionDuration: {
				'smooth': '150ms',
			},
		},
	},
	plugins: [require("tailwindcss-animate")],
};
