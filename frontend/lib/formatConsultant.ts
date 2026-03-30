// 상담 유형 + 이름 → 표시 문자열 변환
export function formatConsultant(consultType: string, doctorName: string, managerName: string): string {
  switch (consultType) {
    case 'doctor': return doctorName ? `${doctorName} 원장` : '';
    case 'manager': return managerName ? `${managerName} 실장` : '';
    case 'doctor-to-manager': {
      const parts: string[] = [];
      if (doctorName) parts.push(`${doctorName} 원장`);
      if (managerName) parts.push(`${managerName} 실장`);
      return parts.join('→');
    }
    case 'manager-to-doctor': {
      const parts: string[] = [];
      if (managerName) parts.push(`${managerName} 실장`);
      if (doctorName) parts.push(`${doctorName} 원장`);
      return parts.join('→');
    }
    default: return '';
  }
}
