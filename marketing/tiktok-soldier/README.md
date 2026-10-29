# 3 פרסומות טיקטוק עם חייל מונפש (29.10.2026)

- `dribit_tiktok_s1_voice.mp4` "בשמירה" (16 שניות)
- `dribit_tiktok_s2_voice.mp4` "העוקץ" (13 שניות)
- `dribit_tiktok_s3_voice.mp4` "החבר'ה" (13 שניות)

1080x1920, קריינות ElevenLabs (קול Liam, eleven_v3, עברית), מוזיקה מסונתזת (בלי בעיית זכויות), dribit.app בסוף.
הדמויות מצוירות בקוד (SVG), מדים זיתיים בלי סמלי צה"ל.

## למה ככה (MiroFish, 26-29.10)
- הבוטים הגיבו חזק להקשר הצבאי ("בין שמירות") ולחברים: s1 ו-s3.
- הפחד מהבטחות "5% בשבוע" בטלגרם ובטיקטוק תפס: s2.
- החשד "מי עומד מאחורי זה?": שורת אמון בכרטיס הסיום, "נבנה על ידי חייל, בשביל חיילים".

## רינדור מחדש (למשל עם קול עברי אחרי שדרוג ElevenLabs)
1. פונטים Rubik + Assistant ב-~/.fonts (TTF מ-fonts.googleapis.com עם curl רגיל), `fc-cache -f`.
2. תיקיית עבודה W: `scripts/` (כל מה שב-source/scripts), `shots/prof.png`, `vo/`.
3. `MAX_TEMPO=1.04 VOICE_ID=PBHwEnXdzx0yfhIO2UCH python3 vo/build_vo.py W s1 s2 s3` (Dorian, קול עברי מהספרייה, עובד רק בתוכנית בתשלום).
4. הטקסט של הקריינות: `vo/lines.json`. הטקסט על המסך והאנימציה: `scripts/chars.js` (STAGES) ו-`spec_sN.js`.
