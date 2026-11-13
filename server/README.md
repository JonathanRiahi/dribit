# שרת החברים והקבוצות (0.31)

שרת קטן לקבוצות, לטבלת המובילים ול"חבר מביא חבר". רץ על Cloudflare Workers עם מסד נתונים D1, **בתוכנית החינמית** (100,000 פניות ביום, בלי כרטיס אשראי). אם עוברים את המכסה, הפניות נכשלות עד למחרת ולא מגיעה חשבונית. האפליקציה עובדת גם בלי השרת: רק לשונית "חברים" נעלמת.

נשמר: מזהה אקראי, כינוי שנבחר, נקודות (סך הכול והשבוע), רצף, מספר שיעורים, מי הזמין את מי (לפי מזהה) והקבוצות. לא שם, טלפון, מייל או IP.

## הפעלה בפעם הראשונה (פעם אחת, בערך 10 דקות)

1. **חשבון Cloudflare:** נרשמים בחינם ב-https://dash.cloudflare.com/sign-up. בתפריט נכנסים ל-**Workers & Pages**. אם מבקשים לבחור שם לכתובת `workers.dev`, בוחרים (למשל `dribit`).
2. **מזהה החשבון:** בעמוד Workers & Pages, בצד, מופיע **Account ID**. מעתיקים.
3. **מפתח גישה:** לוחצים על סמל המשתמש למעלה > **My Profile** > **API Tokens** > **Create Token** > ליד **Edit Cloudflare Workers** לוחצים **Use template**. מוסיפים שורת הרשאה: **Account** > **D1** > **Edit**. בהמשך **Continue to summary** > **Create Token**, ומעתיקים את המפתח (הוא מוצג פעם אחת).
4. **שני סודות ב-GitHub:** בריפו, **Settings** > **Secrets and variables** > **Actions** > **New repository secret**:
   - `CLOUDFLARE_API_TOKEN` = המפתח משלב 3
   - `CLOUDFLARE_ACCOUNT_ID` = המזהה משלב 2
5. **העלאה:** **Actions** > **Server deploy** > **Run workflow**. בסוף הריצה, בסיכום, מופיעה כתובת השרת, למשל `https://dribit-social.dribit.workers.dev`.
6. את הכתובת שמים ב-`config.js` תחת `social.api` (ומחתימים מחדש את `sw.js`). מאותו רגע לשונית "חברים" מופיעה באפליקציה.

כל שינוי בתיקייה הזו שנכנס ל-main מעלה את השרת מחדש לבד.

## נתונים

- `GET /v1/stats` בכתובת השרת: כמה אנשים, כמה הגיעו מקישור של חבר, כמה חברים נספרו, כמה קבוצות. מכשירי צוות לא נספרים.
- באירועי PostHog: `social_registered`, `friends_viewed`, `group_created`, `group_joined`, `group_viewed`, `group_left`, `friend_reward`, `unlock_all_reached`, `share_clicked` עם `from: 'challenge'` או `'group'`.

## בדיקה מקומית

```
cd server
npx wrangler@4.40.0 d1 execute dribit-social --local --file=schema.sql
npx wrangler@4.40.0 dev --local
node test.mjs
```
