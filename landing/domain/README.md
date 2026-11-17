# dribit.app: חיבור הדומיין לדף הנחיתה ולאפליקציה

הכתובת dribit.app מציגה את דף הנחיתה (התיקייה `landing/`), ומאז 0.32 (17.11) גם את האפליקציה עצמה, בכתובת dribit.app/app/. כך מי שנכנס דרך dribit.app רואה dribit.app בשורת הכתובת, ולא jonathanriahi.github.io.

הכתובת הישנה https://jonathanriahi.github.io/dribit/ ממשיכה לעבוד כמו קודם. מי שהתקין משם את האפליקציה למסך הבית, אפליקציית האנדרואיד ואפליקציית האייפון נשארים עליה, כי ההתקדמות שלהם שמורה בכתובת הזו.

טלפון שומר התקדמות בנפרד לכל כתובת. לכן בפעם הראשונה שדפדפן פותח את dribit.app/app/, הוא קופץ לשנייה ל-github.io (הדף `landing/move.html`), לוקח משם את ההתקדמות של הטלפון, וחוזר. זה קורה פעם אחת בכל טלפון. מאותו רגע, לשונית דפדפן שנפתחת בכתובת הישנה (קישור ישן, לחיצה על תזכורת) עוברת לבד ל-dribit.app, כדי שההתקדמות לא תתפצל לשניים. מי שעבר נספר באירוע `progress_moved`.

החיבור נעשה עם Cloudflare Worker: תוכנה קטנה וחינמית, שמביאה את הדפים מ-GitHub ומציגה אותם תחת dribit.app. יש רק עותק אחד, וכל שינוי שנכנס ל-GitHub מופיע אוטומטית בשתי הכתובות.

## עדכון ה-Worker

הפעולה "Domain deploy" ב-GitHub (Actions) מעדכנת את ה-Worker לבד בכל שינוי בתיקייה הזו, עם אותם שני סודות של שרת החברים (CLOUDFLARE_API_TOKEN ו-CLOUDFLARE_ACCOUNT_ID). היא בודקת קודם לאיזה Worker מחובר dribit.app, ומעדכנת רק אותו.

לביטול: dash.cloudflare.com ← Workers & Pages ← ה-Worker של dribit.app ← Deployments ← הגרסה הקודמת ← Rollback.

## התקנה ראשונה (נעשתה כבר, כ-5 דקות, עדיף ממחשב)

1. נכנסים ל-dash.cloudflare.com, ובתפריט בצד בוחרים **Compute (Workers) ← Workers & Pages**. בחלק מהחשבונות זה מופיע פשוט כ-**Workers & Pages**.
2. לוחצים **Create**, ואז **Start with Hello World!**. בשם כותבים `dribit-app` ולוחצים **Deploy**.
3. לוחצים **Edit code**, מוחקים את כל מה שכתוב, ומדביקים את כל התוכן של הקובץ `worker.js` מהתיקייה הזו. לוחצים **Deploy** (למעלה מימין). (מאז 0.32 הפעולה Domain deploy עושה את השלב הזה לבד.)
4. חוזרים ל-Worker ונכנסים ל-**Settings ← Domains & Routes ← Add ← Custom domain**. כותבים `dribit.app` ולוחצים **Add domain**.
5. חוזרים על שלב 4 עם `www.dribit.app`.
6. מחכים כמה דקות, עד ש-Cloudflare מנפיקים את האישור לחיבור המאובטח, ופותחים את https://dribit.app בטלפון.

אם בשלב 4 מופיעה שגיאה שכבר יש רשומה לדומיין: נכנסים ל-**DNS ← Records** של dribit.app, מוחקים את הרשומות מסוג A, AAAA או CNAME של `dribit.app` ושל `www`, ומנסים שוב.

## קישורים לביו

- טיקטוק: `https://dribit.app/?source=tiktok`
- אינסטגרם: `https://dribit.app/?source=instagram`
- `https://dribit.app/app/` היא האפליקציה עצמה, בלי דף הנחיתה.

## מה לא לעשות

אסור לחבר את dribit.app (או כל דומיין אחר) בהגדרות GitHub Pages של הריפו `dribit`, או של ריפו בשם `jonathanriahi.github.io`. במקרה כזה GitHub מעביר גם את האפליקציה לכתובת החדשה, וכל מי שהתקין אותה מתחיל מאפס.

## מה עולה כסף

- הדומיין: מה ששילמת ב-Cloudflare, ומתחדש כל שנה.
- ה-Worker: בחינם, עד 100,000 כניסות ביום.
