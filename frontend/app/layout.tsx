import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Voice to Chart - 미용 클리닉 상담 차트',
  description: '음성 상담을 실시간으로 차트로 변환',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-[#f8f9fa]">{children}</body>
    </html>
  );
}
