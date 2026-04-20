export const baseWeightPresets: Record<string, Array<{title: string, condition: string, weight: number}>> = {
  'SIAM ECO': [
    { title: 'ความจุ', condition: 'ไม่เกิน 1,210 cc. (AT)', weight: 900 },
    { title: 'ความจุ', condition: 'ไม่เกิน 1,210 cc. (MT)', weight: 950 },
    { title: 'ความจุ', condition: '1,210 - 1,250 cc. (AT)', weight: 915 },
    { title: 'ความจุ', condition: '1,210 - 1,250 cc. (MT)', weight: 960 },
    { title: 'ความจุ', condition: '1,251 - 1,300 cc. (AT)', weight: 960 },
    { title: 'ความจุ', condition: '1,251 - 1,300 cc. (MT)', weight: 1010 },
    { title: 'ความจุ', condition: 'Swift K12m (AT)', weight: 915 },
    { title: 'ความจุ', condition: 'Swift K12m (MT)', weight: 965 },
  ],
  'SIAM Group N': [
    { title: 'น้ำหนักรวมคนขับ', condition: 'ไม่ต่ำกว่า 1,050 kg', weight: 1050 }
  ],
  'SIAM Group A': [
    { title: 'ความจุ', condition: 'ไม่เกิน 1,030 cc. เบนซิน (Turbo)', weight: 1040 },
    { title: 'ความจุ', condition: 'ไม่เกิน 1,230 cc. เบนซิน (Turbo)', weight: 1070 },
    { title: 'ความจุ', condition: 'ไม่เกิน 1,330 cc. เบนซิน (Turbo)', weight: 1085 },
    { title: 'ความจุ', condition: 'ไม่เกิน 1,370 cc. เบนซิน (Turbo)', weight: 1090 },
    { title: 'ความจุ', condition: 'ไม่เกิน 1,530 cc. เบนซิน (N/A)', weight: 995 },
    { title: 'ความจุ', condition: 'ไม่เกิน 1,530 cc. เบนซิน (Turbo)', weight: 1115 },
    { title: 'ความจุ', condition: 'ไม่เกิน 1,530 cc. ดีเซล (Turbo)', weight: 1115 },
    { title: 'ความจุ', condition: 'ไม่เกิน 1,580 cc. เบนซิน (N/A)', weight: 1020 },
    { title: 'ความจุ', condition: 'ไม่เกิน 1,630 cc. เบนซิน (N/A)', weight: 1045 },
    { title: 'ความจุ', condition: 'ไม่เกิน 1,810 cc. เบนซิน (N/A)', weight: 1145 }
  ],
  'SIAM GTMC': [
    { title: 'เครื่องยนต์', condition: '4 สูบ, 2 โรเตอร์ (2WD) - Amateur/Pro Class 2', weight: 1170 },
    { title: 'เครื่องยนต์', condition: '4 สูบ, 2 โรเตอร์ (2WD) - Pro Class 1', weight: 1200 },
    { title: 'เครื่องยนต์', condition: '3 สูบ (4WD) - Amateur/Pro Class 2', weight: 1170 },
    { title: 'เครื่องยนต์', condition: '3 สูบ (4WD) - Pro Class 1', weight: 1200 },
    { title: 'เครื่องยนต์', condition: '4 สูบ, 2 โรเตอร์ (4WD) - Amateur/Pro Class 2', weight: 1270 },
    { title: 'เครื่องยนต์', condition: '4 สูบ, 2 โรเตอร์ (4WD) - Pro Class 1', weight: 1300 },
    { title: 'เครื่องยนต์', condition: '6 สูบ, 3 โรเตอร์ (2WD) - Amateur/Pro Class 2', weight: 1300 },
    { title: 'เครื่องยนต์', condition: '6 สูบ, 3 โรเตอร์ (2WD) - Pro Class 1', weight: 1330 },
    { title: 'เครื่องยนต์', condition: '6 สูบ, 3 โรเตอร์ (4WD) - Amateur/Pro Class 2', weight: 1400 },
    { title: 'เครื่องยนต์', condition: '6 สูบ, 3 โรเตอร์ (4WD) - Pro Class 1', weight: 1430 },
    { title: 'เครื่องยนต์', condition: '8 สูบ, 4 โรเตอร์ (2WD) - Amateur/Pro Class 2', weight: 1430 },
    { title: 'เครื่องยนต์', condition: '8 สูบ, 4 โรเตอร์ (2WD) - Pro Class 1', weight: 1460 },
    { title: 'เครื่องยนต์', condition: '8 สูบ, 4 โรเตอร์ (4WD) - Amateur/Pro Class 2', weight: 1530 },
    { title: 'เครื่องยนต์', condition: '8 สูบ, 4 โรเตอร์ (4WD) - Pro Class 1', weight: 1560 }
  ],
  'SIAM GTRC': [
    { title: 'เครื่องยนต์', condition: '4 สูบ, 2 โรเตอร์ (2WD) - Amateur/Pro Class 2', weight: 1170 },
    { title: 'เครื่องยนต์', condition: '4 สูบ, 2 โรเตอร์ (2WD) - Pro Class 1', weight: 1200 },
    { title: 'เครื่องยนต์', condition: '3 สูบ (4WD) - Amateur/Pro Class 2', weight: 1170 },
    { title: 'เครื่องยนต์', condition: '3 สูบ (4WD) - Pro Class 1', weight: 1200 },
    { title: 'เครื่องยนต์', condition: '4 สูบ, 2 โรเตอร์ (4WD) - Amateur/Pro Class 2', weight: 1270 },
    { title: 'เครื่องยนต์', condition: '4 สูบ, 2 โรเตอร์ (4WD) - Pro Class 1', weight: 1300 },
    { title: 'เครื่องยนต์', condition: '6 สูบ, 3 โรเตอร์ (2WD) - Amateur/Pro Class 2', weight: 1300 },
    { title: 'เครื่องยนต์', condition: '6 สูบ, 3 โรเตอร์ (2WD) - Pro Class 1', weight: 1330 },
    { title: 'เครื่องยนต์', condition: '6 สูบ, 3 โรเตอร์ (4WD) - Amateur/Pro Class 2', weight: 1400 },
    { title: 'เครื่องยนต์', condition: '6 สูบ, 3 โรเตอร์ (4WD) - Pro Class 1', weight: 1430 },
    { title: 'เครื่องยนต์', condition: '8 สูบ, 4 โรเตอร์ (2WD) - Amateur/Pro Class 2', weight: 1430 },
    { title: 'เครื่องยนต์', condition: '8 สูบ, 4 โรเตอร์ (2WD) - Pro Class 1', weight: 1460 },
    { title: 'เครื่องยนต์', condition: '8 สูบ, 4 โรเตอร์ (4WD) - Amateur/Pro Class 2', weight: 1530 },
    { title: 'เครื่องยนต์', condition: '8 สูบ, 4 โรเตอร์ (4WD) - Pro Class 1', weight: 1560 }
  ],
  'SIAM TRUCK': [
    { title: 'พิกัดความจุ', condition: 'ต่ำกว่า 2,150 cc.', weight: 1415 },
    { title: 'พิกัดความจุ', condition: '2,151 - 2,250 cc.', weight: 1450 },
    { title: 'พิกัดความจุ', condition: '2,251 - 2,350 cc.', weight: 1485 },
    { title: 'พิกัดความจุ', condition: '2,351 - 2,450 cc.', weight: 1510 },
    { title: 'พิกัดความจุ', condition: '2,451 - 2,550 cc.', weight: 1540 },
    { title: 'พิกัดความจุ', condition: '2,551 - 2,650 cc.', weight: 1605 },
    { title: 'พิกัดความจุ', condition: '2,651 - 2,750 cc.', weight: 1645 },
    { title: 'พิกัดความจุ', condition: '2,751 - 2,850 cc.', weight: 1690 },
    { title: 'พิกัดความจุ', condition: '2,851 - 2,950 cc.', weight: 1720 },
    { title: 'พิกัดความจุ', condition: '2,951 - 3,050 cc.', weight: 1750 },
    { title: 'พิกัดความจุ', condition: '3,051 - 3,150 cc.', weight: 1780 },
    { title: 'พิกัดความจุ', condition: '3,151 - 3,250 cc.', weight: 1810 },
    { title: 'พิกัดความจุ', condition: 'RZF-TC 2,164 cc (Committee Weight)', weight: 0 }
  ]
};

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
    { title: 'รายการ', condition: 'เฉพาะนักแข่ง PRO Class 1 & 2 หากใช้ H Pattern Gearbox สามารถลดน้ำหนักตัวรถได้ 30 กิโลกรัม', weight: -30 },
    { title: 'รายการ', condition: 'เครื่องยนต์วางกลาง หรือ วางหลัง', weight: 100 }
  ],
  'SIAM GTRC': [
    { title: 'รายการ', condition: 'ระบบเบรก ABS', weight: 20 },
    { title: 'รายการ', condition: 'เฉพาะนักแข่ง PRO Class 1 & 2 หากใช้ H Pattern Gearbox สามารถลดน้ำหนักตัวรถได้ 30 กิโลกรัม', weight: -30 },
    { title: 'รายการ', condition: 'เครื่องยนต์วางกลาง หรือ วางหลัง', weight: 100 }
  ],
  'SIAM TRUCK': [
    { title: 'รายการ', condition: 'เกียร์อัตโนมัติเกิน 6 จังหวะ', weight: 100 },
    { title: 'รายการ', condition: 'ใช้ระบบเปลี่ยนเกียร์ที่พวงมาลัย เช่น paddle shift', weight: 35 }
  ],
  'ISUZU Challenge Thailand': []
};
