# dribit.app: חיבור הדומיין לדף הנחיתה

הכתובת dribit.app מציגה את דף הנחיתה, שנמצא בתיקייה `landing/`. האפליקציה עצמה נשארת בכתובת https://jonathanriahi.github.io/dribit/, כדי שמי שכבר התקין אותה לא יאבד את ההתקדמות ואת התזכורות, ואפליקציית האנדרואיד תמשיך לעבוד.

החיבור נעשה עם Cloudflare Worker: תוכנה קטנה וחינמית, שמביאה את הדף מ-GitHub ומציגה אותו תחת dribit.app. יש רק עותק אחד של הדף, וכל שינוי שנכנס ל-GitHub מופיע אוטומטית בשתי הכתובות.

## התקנה (כ-5 דקות, עדיף ממחשב)

1. נכנסים ל-dash.cloudflare.com, ובתפריט בצד בוחרים **Compute (Workers) ← Workers & Pages**. בחלק מהחשבונות זה מופיע פשוט כ-**Workers & Pages**.
2. לוחצים **Create**, ואז **Start with Hello World!**. בשם כותבים `dribit-app` ולוחצים **Deploy**.
3. לוחצים **Edit code**, מוחקים את כל מה שכתוב, ומדביקים את כל התוכן של הקובץ `worker.js` מהתיקייה הזו. לוחצים **Deploy** (למעלה מימין).
4. חוזרים ל-Worker ונכנסים ל-**Settings ← Domains & Routes ← Add ← Custom domain**. כותבים `dribit.app` ולוחצים **Add domain**.
5. חוזרים על שלב 4 עם `www.dribit.app`.
6. מחכים כמה דקות, עד ש-Cloudflare מנפיקים את האישור לחיבור המאובטח, ופותחים את https://dribit.app בטלפון.

אם בשלב 4 מופיעה שגיאה שכבר יש רשומה לדומיין: נכנסים ל-**DNS ← Records** של dribit.app, מוחקים את הרשומות מסוג A, AAAA או CNAME של `dribit.app` ושל `www`, ומנסים שוב.

## קישורים לביו

- טיקטוק: `https://dribit.app/?source=tiktok`
- אינסטגרם: `https://dribit.app/?source=instagram`
- `https://dribit.app/app` מעביר ישר לאפליקציה.

## מה לא לעשות

אסור לחבר את dribit.app (או כל דומיין אחר) בהגדרות GitHub Pages של הריפו `dribit`, או של ריפו בשם `jonathanriahi.github.io`. במקרה כזה GitHub מעביר גם את האפליקציה לכתובת החדשה, וכל מי שהתקין אותה מתחיל מאפס.

## מה עולה כסף

- הדומיין: מה ששילמת ב-Cloudflare, ומתחדש כל שנה.
- ה-Worker: בחינם, עד 100,000 כניסות ביום.
