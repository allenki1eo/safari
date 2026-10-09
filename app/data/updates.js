/**
 * What's new, newest first. The title screen shows the newest entry once to everyone who played
 * before it landed (app/ui/updates.js). Add an entry with each release players should hear about;
 * the id must be new each time. Kiswahili for each line lives in app/i18n.js.
 */
export const UPDATES = [
  {
    id: '2026-10-09-inbox',
    emoji: '📬',
    title: 'Your inbox is here',
    items: [
      'Tap 📬 on the home screen to see your prizes, bet results and news.',
      'Announcements from the game show up there too — even without notifications.',
    ],
  },
  {
    id: '2026-10-09-derby',
    emoji: '⚽',
    title: 'The Kariakoo Derby Special is here!',
    items: [
      'Pick Green & Gold or Red & White and get a limited football kit to keep.',
      'Every run pulls the rope for your side — the bigger total on Sunday night wins.',
      'Your side shows on the home screen, with a live score and countdown.',
    ],
  },
  {
    id: '2026-10-08-notify',
    emoji: '🔔',
    title: 'Prizes and notifications',
    items: [
      'The top 10 each day, week and month win seeds.',
      'Turn on notifications to hear when you win or a friend takes your bet.',
      'Settings and every pop-up now scroll properly on phones.',
    ],
  },
];
