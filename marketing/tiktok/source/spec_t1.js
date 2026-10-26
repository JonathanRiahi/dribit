window.SPEC = { id: 't1', scenes: [
 { type: 'chat', dur: 3.4, title: 'הקבוצה של החבר\'ה:', at: [0.2, 0.9, 1.6, 2.5], msgs: [
   { name: 'דני', text: 'נכנסתי ל-S&P 500 😎' },
   { name: 'רועי', text: 'ETF או קרן מחקה?' },
   { name: 'דני', text: 'ETF ברור. דמי ניהול 0.07' },
   { name: 'אתם', me: true, text: '🫠 ???' } ] },
 { type: 'hook', dur: 2.6, pre: 'נשמע לכם', num: 'סינית?', q: 'זה לא אתם.<br>פשוט אף אחד לא לימד אתכם.', qAt: 0.7 },
 { type: 'phone', dur: 1.6, cap: ['לומדים את זה', 'בכמה דקות ביום'], shot: 'q1.png', y0: 80, y1: 100, taps: [[0.9, 585, 1405]] },
 { type: 'phone', dur: 1.9, cap: ['לומדים את זה', 'בכמה דקות ביום'], shot: 'q3.png', y0: 100, y1: 140 },
 { type: 'phone', dur: 2.2, cap: ['כמו משחק:', 'נקודות, רצף, שלבים'], shot: 'prof.png', y0: 60, y1: 420 },
 { type: 'end', dur: 3.3 } ] };
