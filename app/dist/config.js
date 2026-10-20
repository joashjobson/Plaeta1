/* =====================================================================
   PLAETA WEBSITE SETTINGS
   This is the only file you need to edit to change prices, plan limits,
   the app link or your contact details. Change the text between the
   quote marks, keep the commas, then upload the site again.
   ===================================================================== */
window.PLAETA = {
  // Where the "Open Plaeta" buttons go (the app lives at /app on this same site)
  appUrl: '/app/',

  // Your details (shown in the footer and the legal pages)
  businessName: 'Plaeta',
  contactEmail: 'hello@example.com',

  // How long uploaded past papers are kept before they are deleted
  paperDays: 60,

  // Price plans. Monthly only. "papers" is the number of past papers a
  // student can upload each month. Set "recommended: true" on one plan
  // to highlight it.
  currency: 'A$',
  plans: [
    { id: 'basic',    name: 'Basic',    price: 12, papers: 10, blurb: 'For one or two subjects you want to lift.' },
    { id: 'standard', name: 'Standard', price: 22, papers: 20, blurb: 'Steady practice across your whole course.', recommended: true },
    { id: 'full',     name: 'Full',     price: 33, papers: 30, blurb: 'For trial exams and the final stretch.' }
  ],

  // What every plan includes (shown under each price)
  included: [
    'Every question can be AI-marked',
    'All your subjects, each with its own planet',
    'Syllabus upload and topic tick-off',
    'Notes, flashcards, tutor and focus sessions',
    'Cancel any time in one step'
  ]
};
