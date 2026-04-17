export const weightPresets: Record<string, Array<{title: string, condition: string, weight: number}>> = {
  'SIAM ECO': [
    { title: 'ระบบ', condition: 'Dual Camshaft', weight: 25 },
    { title: 'ระบบ', condition: 'เครื่องยนต์ที่มีกำลังอัดมาจากโรงงานเกิน 11.0:1', weight: 25 },
    { title: 'ระบบ', condition: 'เปลี่ยนจุดยึดโช๊คอัพด้านบนเป็นแบบปรับ Camber ได้', weight: 10 },
    { title: 'ระบบ', condition: 'เปลี่ยน Camshaft เป็นของเครื่อง L15 (GE, GK)', weight: 30 }
  ],
  'SIAM Group A': [
    { title: 'รายการ', condition: 'Direct Injection (N/A)', weight: 25 },
    { title: 'รายการ', condition: 'Direct Injection (Turbo)', weight: 15 },
    { title: 'รายการ', condition: 'ลิ้นไอดีมากกว่า 1 ลิ้น (N/A)', weight: 25 },
    { title: 'รายการ', condition: 'ลิ้นไอดีมากกว่า 1 ลิ้น (Turbo)', weight: 25 },
    { title: 'รายการ', condition: 'Dual Camshaft (N/A)', weight: 25 },
    { title: 'รายการ', condition: 'Dual Camshaft (Turbo)', weight: 15 },
    { title: 'รายการ', condition: 'Sequential / Paddle Shift (N/A)', weight: 25 },
    { title: 'รายการ', condition: 'Sequential / Paddle Shift (Turbo)', weight: 25 },
    { title: 'รายการ', condition: 'Dog Teeth รูปแบบ H Pattern (N/A)', weight: 10 },
    { title: 'รายการ', condition: 'Dog Teeth รูปแบบ H Pattern (Turbo)', weight: 10 },
    { title: 'รายการ', condition: 'Synchromesh รูปแบบ I Pattern (N/A)', weight: 15 },
    { title: 'รายการ', condition: 'Synchromesh รูปแบบ I Pattern (Turbo)', weight: 15 }
  ],
  'SIAM Group N': [
    { title: 'รายการ', condition: 'สามารถใช้เกียร์ DOG BOX ได้เฉพาะแบบ H-Pattern เท่านั้น', weight: 10 }
  ],
  'SIAM GTMC': [
    { title: 'รายการ', condition: 'ระบบเบรก ABS', weight: 20 },
    { title: 'รายการ', condition: 'เฉพาะนักแข่ง PRO Class 1 & 2 หากใช้ H Pattern Gearbox สามารถลดน้ำหนักตัวรถได้ 30 กิโลกรัม', weight: -30 }
  ],
  'SIAM GTRC': [
    { title: 'รายการ', condition: 'ระบบเบรก ABS', weight: 20 },
    { title: 'รายการ', condition: 'เฉพาะนักแข่ง PRO Class 1 & 2 หากใช้ H Pattern Gearbox สามารถลดน้ำหนักตัวรถได้ 30 กิโลกรัม', weight: -30 }
  ],
  'SIAM TRUCK': [
    { title: 'รายการ', condition: 'เกียร์อัตโนมัติเกิน 6 จังหวะ', weight: 100 },
    { title: 'รายการ', condition: 'ใช้ระบบเปลี่ยนเกียร์ที่พวงมาลัย เช่น paddle shift', weight: 35 }
  ],
  'ISUZU Challenge Thailand': []
};
