import type { Config } from 'tailwindcss';
import preset from '@buisnez/config/tailwind/preset';

const config: Config = { presets: [preset], content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'] };

export default config;