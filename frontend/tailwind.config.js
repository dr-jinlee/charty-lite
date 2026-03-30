/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // 미용 클리닉 느낌의 컬러 팔레트
        clinic: {
          50: '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
        },
        doctor: '#3b82f6',    // 의사 발화 색상 (파랑)
        patient: '#10b981',   // 환자 발화 색상 (초록)
        warning: '#ef4444',   // 경고/알러지
      },
    },
  },
  plugins: [],
};
