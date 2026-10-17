// הגדרות המוצר. כדי לשנות שם, תמונות, ניקוד, שותף או מדידה, משנים רק כאן.
window.DRIBIT_CONFIG = {
  appName: 'דריבית',
  appNameEn: 'Dribit',
  version: '0.8.0',
  tagline: 'כמה דקות ביום. הידע מצטבר כמו ריבית דריבית.',

  // גרסת ניסיון: מציג באנר משוב במסך הבית
  pilot: true,

  // תמונות (איורי unDraw, פרטים ב-assets/images/CREDITS.md).
  // כדי להחליף: שים קובץ ב-assets/images ורשום כאן את הנתיב. מחרוזת ריקה = בלי תמונה.
  images: {
    welcome: 'assets/images/welcome-growth-curve.svg',
    done: 'assets/images/done-celebration.svg',
    empty: 'assets/images/empty-empty.svg',
    units: {
      1: 'assets/images/unit1-online-banking.svg',
      2: 'assets/images/unit2-savings.svg',
      3: 'assets/images/unit3-watering-plants.svg',
      4: 'assets/images/unit4-bull-market.svg',
      5: 'assets/images/unit5-investing.svg',
      6: 'assets/images/unit6-warning.svg',
      7: 'assets/images/unit7-career-progress.svg',
      8: 'assets/images/unit8-five-year-plan.svg'
    }
  },

  // נקודות: כמה מקבלים על כל דבר
  points: {
    correct: 10,     // תשובה נכונה בניסיון הראשון
    review: 5,       // שאלת חזרה או תרגול
    lessonDone: 10,  // סיום שיעור
    perfect: 10,     // שיעור בלי אף טעות
    speed: 15,       // מסיימים בזמן שכתוב בתחילת השיעור, עם 80% דיוק לפחות
    mission: 25      // משימה מחוץ לאפליקציה
  },

  // שלבים לפי סך הנקודות. כל שלב נקרא על שם סכום כסף.
  levels: [
    { amount: '100 ₪', min: 0 },
    { amount: '500 ₪', min: 100 },
    { amount: '1,000 ₪', min: 250 },
    { amount: '2,500 ₪', min: 500 },
    { amount: '5,000 ₪', min: 850 },
    { amount: '10,000 ₪', min: 1300 },
    { amount: '25,000 ₪', min: 1900 },
    { amount: '50,000 ₪', min: 2600 },
    { amount: '100,000 ₪', min: 3400 },
    { amount: '250,000 ₪', min: 4300 },
    { amount: 'מיליון ₪', min: 5400 }
  ],

  // יעד יומי בנקודות
  goals: [
    { xp: 50, label: 'רגיל', note: 'שיעור אחד ביום' },
    { xp: 100, label: 'רציני', note: 'שיעור מושלם, או שניים' },
    { xp: 150, label: 'אש', note: 'שניים-שלושה שיעורים ביום' }
  ],
  defaultGoal: 50,  // אין מסך יעד בפתיחה: מתחילים מכאן ומשנים בפרופיל

  // הסטטוס קובע אילו שיעורים רואים (שדה audience בתוכן)
  statuses: [
    { id: 'sadir', label: 'בשירות סדיר', note: 'יותר מחצי שנה לשחרור' },
    { id: 'pre', label: 'לפני שחרור', note: 'פחות מחצי שנה לשחרור' },
    { id: 'post', label: 'אחרי שחרור', note: 'כבר השתחררתי' },
    { id: 'civ', label: 'לא בצבא', note: 'לא שירתי, או שזה לא רלוונטי' }
  ],

  // היחידה שפותחת את המסלול לפי סטטוס (מזהה יחידה מ-lessons.json). null = סדר הקובץ (ריבית דריבית קודם).
  startUnit: { sadir: 2, pre: 2, post: 2, civ: null },

  // מה מבטיחים במסך הפתיחה אחרי בחירת סטטוס. בלי סכומים, בלי שמות של חברות ובלי שותף.
  openers: {
    sadir: {
      headline: 'מה עושים עם הכסף של הצבא לפני שהוא נעלם',
      promise: 'מתחילים מהפיקדון האישי ומענק השחרור: כמה נצבר על כל חודש שירות, מה מותר לעשות עם הכסף, ואיך מחליטים עכשיו, כשיש עוד זמן.',
      cta: 'להתחיל מהכסף של הצבא'
    },
    pre: {
      headline: 'מה עושים עם הכסף של הצבא לפני שהוא נעלם',
      promise: 'פחות מחצי שנה לשחרור: הפיקדון, המענק ו-60 הימים הראשונים. תוכנית לפני שהכסף נכנס לחשבון, כדי שהוא לא ייעלם.',
      cta: 'להתחיל מהכסף של השחרור'
    },
    post: {
      headline: 'השתחררת? הפיקדון, המענק ו-60 הימים הראשונים',
      promise: 'מתחילים ממה שכבר בחשבון או בדרך אליו: הפיקדון האישי, מענק השחרור, ומה עושים ב-60 הימים הראשונים כדי שהכסף לא ייעלם. המשכורת הראשונה בהמשך המסלול.',
      cta: 'להתחיל מהכסף של השחרור'
    },
    civ: {
      headline: 'איך כסף גדל, ואיפה הוא נעלם',
      promise: 'מתחילים מריבית דריבית: סיפור של שני אנשים בגילך, וכמה שנים של הבדל. אחר כך השוק, הבלמים, ואיפה משקיעים בישראל.',
      cta: 'יאללה, מתחילים'
    }
  },

  // הצלת רצף: מי שאיבד רצף ארוך יכול להחזיר אותו במבחן קצר
  streakRepair: { minStreak: 7, withinDays: 3, questions: 10, toPass: 8 },

  practiceSize: 8,

  // מדידה (PostHog). בלי מפתח, האירועים נשמרים במכשיר ונשלחים כשהמפתח יתווסף.
  // המפתח שמתחיל ב-phc_ אינו סוד: הוא נועד להיות בקוד של האתר.
  analytics: {
    posthogKey: 'phc_tsse5UQex6pJhPK4yZkLjXLTXykftLFo8BXibrXa3Bqm',
    host: 'https://eu.i.posthog.com'
  },

  // תזכורת יומית (Web Push). המפתח הציבורי כאן אינו סוד. המפתח הפרטי שלו נמצא רק ב-GitHub (Settings ← Secrets)
  // ומשמש את השליחה היומית: tools/send-reminders.js רץ כל יום ב-GitHub Actions (.github/workflows/reminders.yml).
  // המינויים נשמרים כאירועים ב-PostHog (push_subscribed), ולכן התזכורת עובדת רק למי ששיתוף הנתונים דלוק אצלו.
  reminders: {
    enabled: true,
    hour: 18,  // שעון ישראל. אם משנים, משנים גם את ה-cron בקובץ ה-workflow
    vapidPublicKey: 'BMwrT7BZQpvx3UGBsw5khdO5ZkwERNxRXz1slfXdwAWv0tMwhybKF6r25OJ3Ca_xqDKUoHllMRY82gacM79Nr6g'
  },

  // משוב: כשאין מפתח מדידה, או כשהמשתמש כיבה שיתוף נתונים, המשוב נפתח בוואטסאפ.
  // whatsapp: ספרות בלבד בפורמט בינלאומי, בלי + ובלי אפס מוביל (050-1234567 ← 972501234567). ריק = ההודעה מוצגת להעתקה.
  // contactName: שם פרטי שמופיע בהסבר ("המשוב נשלח בוואטסאפ ליהונתן"). לא חובה.
  feedback: { whatsapp: '', contactName: '' },

  // התקנה בטלפון: כרטיס ההתקנה מופיע אחרי שיעור ראשון (afterLessons). באייפון הוא מופיע גם במסך הסיום של אותו שיעור (showOnDone),
  // כי באייפון האפליקציה המותקנת מתחילה מאפס וההתקדמות עוברת בקוד העברה.
  install: { afterLessons: 1, showOnDone: true },

  // שאלת "רוצים לפתוח תיק מסחר?" בסוף השיעורים האלה (נמדד כאירוע invest_intent)
  investIntentLessons: ['5.2'],

  // שותף: כבוי עד שיש הסכם חתום, אישור בכתב של הנוסח וקישור הפניה אישי
  partner: {
    enabled: false,
    name: '',
    url: '',
    lessons: ['5.1', '5.2'],
    text: 'אפשר לפתוח תיק מסחר עצמאי אצל השותף שלנו. כדאי להשוות עלויות מול גופים נוספים לפני שבוחרים.',
    disclosure: 'גילוי נאות: אם פותחים חשבון דרך הקישור, אנחנו מקבלים תשלום מהשותף. זה לא משפיע על התוכן בשיעורים, וזו לא המלצה אישית.'
  },

  disclaimer: 'מידע כללי לחינוך פיננסי, לא ייעוץ השקעות',
  examplesNote: 'השמות והסכומים בשאלות הם דוגמאות.'
};
