import type { LessonPackage, ModuleSpec } from '../../engine/types'
import CandleChartScene from '../../engine/scenes/CandleChartScene'
import TitleScene from '../../engine/scenes/TitleScene'

/**
 * LESSON 1 — Reading the Charts (reference implementation).
 *
 * This file is the WORKED EXAMPLE for the candle-driven lessons. Pair 1 (modules 1-2)
 * is fully built from planning/LESSON_PLAN1.md §6; the remaining 11 pairs (modules
 * 3-24) follow the exact same shape — each TEACH points `candlesKey` at the bundled
 * series and lists hlines/zones/markers; each QUIZ adds mode:'quiz' + splitDate +
 * outcome + a QuizSpec. All levels/dates come straight from the plan.
 */
const modules: ModuleSpec[] = [
  {
    id: 1,
    type: 'teach',
    kicker: 'Learn · NVDA · Bull Flag',
    title: 'Bull Flag',
    intro:
      'A sharp rally (the flagpole), a tight pullback (the flag), then a breakout that resumes the trend. Watch where to buy, target, and stop.',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'nvda_2023',
        mode: 'teach',
        hlines: [
          { price: 40.5, col: 'blue', label: 'Flag resistance ~40.5', dashed: true },
          { price: 37.0, col: 'red', label: 'Stop 37.00', dashed: true },
        ],
        zones: [{ fromDate: '2023-06-01', toDate: '2023-06-12', col: 'blue', label: 'Flag' }],
        markers: [
          { date: '2023-05-24', price: 30.54, kind: 'dot', label: 'Flagpole base' },
          { date: '2023-05-30', price: 41.94, kind: 'dot', label: 'Flagpole top' },
          { date: '2023-06-13', price: 40.5, kind: 'buy', label: 'BUY 40.5' },
          { date: '2023-07-14', price: 48.09, kind: 'target', label: 'Target 48.09' },
        ],
      },
    },
    caption:
      'BUY the June 13 breakout above the ~$40.5 flag top. Flagpole height ≈ $11.4 projects a target near $52; price ran to $48.09. STOP just below the $37.36 flag low.',
  },
  {
    id: 2,
    type: 'quiz',
    kicker: 'Quiz · PLTR · Bull Flag',
    title: 'Does this Bull Flag complete?',
    intro:
      'PLTR rocketed on a Feb earnings gap, then coiled in a tight flag under ~$25.5. The right half is hidden — you decide.',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'pltr_2024',
        mode: 'quiz',
        splitDate: '2024-03-05',
        hlines: [{ price: 25.5, col: 'blue', label: 'Flag resistance ~25.5', dashed: true }],
        markers: [
          { date: '2024-02-21', price: 22.29, kind: 'dot', label: 'Flag low 22.29' },
          { date: '2024-03-06', price: 26.16, kind: 'buy', label: 'Breakout 26.16' },
        ],
        outcome: { text: 'Breakout confirmed — the flag completed', good: true },
      },
    },
    quiz: {
      prompt: 'Does price break ABOVE the flag and resume the uptrend?',
      options: [
        { id: 'yes', label: 'Yes — it breaks out' },
        { id: 'no', label: 'No — it fails' },
      ],
      correctId: 'yes',
      explainRight:
        'Correct. On March 6 PLTR pushed decisively above the ~$25.5 flag resistance (close $26.16) and followed through to $27.50 — a textbook bullish continuation.',
      explainWrong:
        'It actually completed. March 6 broke above the ~$25.5 flag resistance (close $26.16) with follow-through to $27.50 — price broke UP out of the flag, not down through the $22.29 low, so the pattern confirmed.',
    },
  },

  // --- Pair 2 — Cup with Handle (quiz = fakeout → NO) -----------------------
  {
    id: 3,
    type: 'teach',
    kicker: 'Learn · AMD · Cup with Handle',
    title: 'Cup with Handle',
    intro:
      'A rounded U-shaped cup, then a small shallow handle near the rim, then a breakout above resistance that resumes the uptrend.',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'cupHandle_teach_AMD2020',
        mode: 'teach',
        hlines: [
          { price: 59.0, col: 'blue', label: 'Cup rim ~59', dashed: true },
          { price: 52.0, col: 'red', label: 'Stop 52.00', dashed: true },
        ],
        zones: [{ fromDate: '2020-07-13', toDate: '2020-07-17', col: 'blue', label: 'Handle' }],
        markers: [
          { date: '2020-06-10', price: 59.0, kind: 'dot', label: 'Left rim 59.00' },
          { date: '2020-06-29', price: 48.42, kind: 'dot', label: 'Cup bottom 48.42' },
          { date: '2020-07-10', price: 58.15, kind: 'dot', label: 'Right rim 58.15' },
          { date: '2020-07-14', price: 52.26, kind: 'dot', label: 'Handle low 52.26' },
          { date: '2020-07-22', price: 61.79, kind: 'buy', label: 'BUY 61.79' },
          { date: '2020-07-24', price: 69.6, kind: 'target', label: 'Target 69.60' },
        ],
      },
    },
    caption:
      'BUY the July 22 breakout above the ~$59 rim (close $61.79). TARGET = rim + cup depth (59.00 − 48.42 ≈ 10.58) ≈ $69.6, reached the next session. STOP just below the $52.26 handle low, around $52.',
  },
  {
    id: 4,
    type: 'quiz',
    kicker: 'Quiz · DIS · Cup with Handle',
    title: 'Does this Cup with Handle complete?',
    intro:
      'Disney carved a rounded cup (rim ~187, bottom ~171) and recovered to the rim with a tight handle. The resolution is hidden — does it break out?',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'cupHandle_quiz_DIS',
        mode: 'quiz',
        splitDate: '2021-09-17',
        hlines: [{ price: 187.0, col: 'blue', label: 'Cup rim ~187', dashed: true }],
        markers: [
          { date: '2021-09-09', price: 187.58, kind: 'dot', label: 'Right rim 187.58' },
          { date: '2021-09-21', price: 171.17, kind: 'sell', label: 'Breakdown 171.17' },
        ],
        outcome: { text: 'Rejected at the rim — the cup failed', good: false },
      },
    },
    quiz: {
      prompt: 'Will price break out above the ~$187 rim and complete the bullish pattern?',
      options: [
        { id: 'yes', label: 'Yes — it completes' },
        { id: 'no', label: 'No — it fails' },
      ],
      correctId: 'no',
      explainRight:
        'Correct. A valid cup-with-handle completes only on a confirmed breakout ABOVE the rim (~$187.58). At the split (close $183.47) price was still under the trigger, then reversed: Sept 21 collapsed to a $169.03 low, breaking handle support and rolling over to $142 by December. The rim breakout, not the pretty shape, is what must confirm.',
      explainWrong:
        'It actually failed. The breakout never came — instead of clearing the ~$187 rim, DIS gapped down Sept 21 to a $169.03 low and slid to $142 by December, a ~24% drop. A disciplined trader was never triggered long because confirmation above the rim never occurred.',
    },
  },

  // --- Pair 3 — Ascending Triangle (quiz completes → YES) -------------------
  {
    id: 5,
    type: 'teach',
    kicker: 'Learn · MSFT · Ascending Triangle',
    title: 'Ascending Triangle',
    intro:
      'A flat horizontal ceiling tested by equal highs while pullback lows keep climbing — price coils, then breaks UP through resistance.',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'asctri_teach_MSFT',
        mode: 'teach',
        hlines: [
          { price: 263.0, col: 'blue', label: 'Flat resistance ~263', dashed: true },
          { price: 253.0, col: 'red', label: 'Stop 253.00', dashed: true },
        ],
        markers: [
          { date: '2021-04-16', price: 261.0, kind: 'dot', label: 'Resistance 261.0' },
          { date: '2021-04-27', price: 263.19, kind: 'dot', label: 'Resistance 263.19' },
          { date: '2021-05-12', price: 238.07, kind: 'dot', label: 'Higher low 238.07' },
          { date: '2021-05-24', price: 247.51, kind: 'dot', label: 'Higher low 247.51' },
          { date: '2021-06-16', price: 254.42, kind: 'dot', label: 'Higher low 254.42' },
          { date: '2021-06-22', price: 265.51, kind: 'buy', label: 'BUY 265.51' },
          { date: '2021-07-23', price: 288.0, kind: 'target', label: 'Target 288.00' },
        ],
      },
    },
    caption:
      'BUY the June 22 close (265.51), the first decisive close above the flat ~$263 ceiling. TARGET = breakout + triangle height (~263 − 238 = 25) ≈ $288, reached by July 23. STOP just below the last higher low at 254.42, around $253.',
  },
  {
    id: 6,
    type: 'quiz',
    kicker: 'Quiz · AMD · Ascending Triangle',
    title: 'Does this Ascending Triangle complete?',
    intro:
      'AMD has stalled at a flat ~122-125 ceiling while its pullback lows keep climbing, coiling into the apex. The right half is hidden.',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'asctri_quiz_AMD',
        mode: 'quiz',
        splitDate: '2023-12-06',
        hlines: [{ price: 125.0, col: 'blue', label: 'Flat resistance ~125', dashed: true }],
        markers: [
          { date: '2023-11-29', price: 125.73, kind: 'dot', label: 'Resistance 125.73' },
          { date: '2023-11-30', price: 119.65, kind: 'dot', label: 'Higher low 119.65' },
          { date: '2023-12-07', price: 128.37, kind: 'buy', label: 'Breakout 128.37' },
        ],
        outcome: { text: 'Broke out above resistance — it completed', good: true },
      },
    },
    quiz: {
      prompt: 'Does price break UP through the flat resistance and follow through to the upside?',
      options: [
        { id: 'yes', label: 'Yes — it completes' },
        { id: 'no', label: 'No — it fails' },
      ],
      correctId: 'yes',
      explainRight:
        'Correct. An ascending triangle is a bullish continuation, and AMD confirmed it: equal highs (~122-126) over a rising support line, then a Dec 7 gap-and-go close of 128.37 above resistance, with follow-through to a 150.41 high — a genuine break, not a fakeout.',
      explainWrong:
        'It actually completed. The Dec 7 candle gapped above the ~$125 ceiling (close 128.37) and ran almost straight up to 150.41 — roughly a 20% advance. The breakout in the expected bullish direction validated the triangle.',
    },
  },

  // --- Pair 4 — Bear Flag (quiz = fakeout → NO) -----------------------------
  {
    id: 7,
    type: 'teach',
    kicker: 'Learn · NFLX · Bear Flag',
    title: 'Bear Flag',
    intro:
      'A sharp drop (the down flagpole), a brief upward-drifting consolidation (the flag), then a breakdown BELOW the flag that resumes the downtrend.',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'bearflag_teach_NFLX',
        mode: 'teach',
        hlines: [
          { price: 19.25, col: 'blue', label: 'Flag support ~19.25', dashed: true },
          { price: 21.0, col: 'red', label: 'Stop 21.00', dashed: true },
        ],
        zones: [{ fromDate: '2022-05-13', toDate: '2022-06-09', col: 'blue', label: 'Flag' }],
        markers: [
          { date: '2022-05-04', price: 20.44, kind: 'dot', label: 'Flagpole top 20.44' },
          { date: '2022-05-12', price: 16.27, kind: 'dot', label: 'Flagpole low 16.27' },
          { date: '2022-06-08', price: 20.74, kind: 'dot', label: 'Flag high 20.74' },
          { date: '2022-06-10', price: 18.29, kind: 'sell', label: 'SHORT 18.29' },
          { date: '2022-06-14', price: 15.08, kind: 'target', label: 'Target 15.08' },
        ],
      },
    },
    caption:
      'SHORT/SELL the June 10 breakdown close (18.29) below the ~$19.25 flag support. TARGET = breakdown − flagpole height (20.44 − 16.27 = 4.17) ≈ $15.08; price hit a 16.43 low. STOP just above the $20.74 flag high, around $21.',
  },
  {
    id: 8,
    type: 'quiz',
    kicker: 'Quiz · TSLA · Bear Flag',
    title: 'Does this Bear Flag complete?',
    intro:
      'Tesla dropped sharply (flagpole), then consolidated sideways. On March 14 it closed at 255.46, breaking below the flag near ~265. Does it continue lower?',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'bearflag_quiz_TSLA',
        mode: 'quiz',
        splitDate: '2022-03-14',
        hlines: [{ price: 265.0, col: 'blue', label: 'Flag support ~265', dashed: true }],
        markers: [
          { date: '2022-02-24', price: 233.33, kind: 'dot', label: 'Flagpole low 233.33' },
          { date: '2022-03-14', price: 255.46, kind: 'sell', label: 'Breakdown 255.46' },
          { date: '2022-03-15', price: 267.3, kind: 'buy', label: 'Snap-back 267.30' },
        ],
        outcome: { text: 'Snapped back up — the bear flag faked out', good: false },
      },
    },
    quiz: {
      prompt: 'Does this bear flag CONTINUE downward as expected?',
      options: [
        { id: 'yes', label: 'Yes — it completes' },
        { id: 'no', label: 'No — it fails' },
      ],
      correctId: 'no',
      explainRight:
        'Correct. The breakdown was a bear trap. The March 14 pierce of the ~$265 boundary failed to follow through; March 15 snapped back to a 267.30 close (triggering the stop), and TSLA rallied ~50% to a 381.82 close by April 4 — the opposite of the bearish target.',
      explainWrong:
        'It actually failed. The March 14 close (255.46) looked like a valid short trigger, but there was no sustained close lower — the very next session reclaimed the boundary (267.30) and a powerful multi-week rally followed. The bear flag faked out.',
    },
  },

  // --- Pair 5 — Inverted Cup with Handle (quiz completes → YES) -------------
  {
    id: 9,
    type: 'teach',
    kicker: 'Learn · ROKU · Inverted Cup with Handle',
    title: 'Inverted Cup with Handle',
    intro:
      'A rounded n-shaped top, then a small upward retrace (the inverted handle near the rim), then a breakDOWN below the neckline.',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'invcuphandle_teach_ROKU',
        mode: 'teach',
        hlines: [
          { price: 302.0, col: 'blue', label: 'Neckline ~302', dashed: true },
          { price: 352.0, col: 'red', label: 'Stop 352.00', dashed: true },
        ],
        markers: [
          { date: '2021-06-21', price: 363.1, kind: 'dot', label: 'Left rim 363.10' },
          { date: '2021-07-26', price: 486.32, kind: 'dot', label: 'Cup peak 486.32' },
          { date: '2021-10-04', price: 293.9, kind: 'dot', label: 'Neckline 293.90' },
          { date: '2021-10-19', price: 350.6, kind: 'dot', label: 'Handle high 350.60' },
          { date: '2021-11-04', price: 289.39, kind: 'sell', label: 'SHORT 289.39' },
          { date: '2021-12-06', price: 196.94, kind: 'target', label: 'Target 196.94' },
        ],
      },
    },
    caption:
      'SHORT/SELL the Nov 4 breakdown close (289.39) below the ~$294-302 rim support, confirming the inverted cup. STOP just above the $350.60 handle high, around $352. Cup height ≈ 486 − 302 ≈ 184 projects to ~118; price followed through to a $196.94 low (a ~32% decline).',
  },
  {
    id: 10,
    type: 'quiz',
    kicker: 'Quiz · PYPL · Inverted Cup with Handle',
    title: 'Does this Inverted Cup with Handle complete?',
    intro:
      'PayPal formed a rounded n-shaped top (peak ~310) and a small handle retrace to 273.27, sitting on the ~253 neckline. The resolution is hidden.',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'invcuphandle_quiz_PYPL',
        mode: 'quiz',
        splitDate: '2021-10-19',
        hlines: [{ price: 253.0, col: 'blue', label: 'Neckline ~253', dashed: true }],
        markers: [
          { date: '2021-07-26', price: 310.0, kind: 'dot', label: 'Cup peak ~310' },
          { date: '2021-10-19', price: 273.27, kind: 'dot', label: 'Handle high 273.27' },
          { date: '2021-10-21', price: 243.21, kind: 'sell', label: 'Breakdown 243.21' },
        ],
        outcome: { text: 'Broke below neckline — it completed', good: true },
      },
    },
    quiz: {
      prompt: 'Will price break DOWN below the neckline and complete the bearish pattern?',
      options: [
        { id: 'yes', label: 'Yes — it completes' },
        { id: 'no', label: 'No — it fails' },
      ],
      correctId: 'yes',
      explainRight:
        'Correct. Right after the Oct 19 handle high (273.27), PYPL gapped down — Oct 20 closed 258.36, Oct 21 closed 243.21 — slicing through the ~253 neckline, then accelerated to a 179.15 low (a ~30% drop). The decisive close below support with a follow-through breakaway gap confirmed it.',
      explainWrong:
        'It actually completed. Cup height ≈ 310 − 253 ≈ 57 projects a target near 196, and price blew through it to 179.15. The decisive close below the ~$253 neckline on Oct 20-21 with expanding range confirmed the bearish breakdown — the 273.27 handle high was never threatened.',
    },
  },

  // --- Pair 6 — Descending Triangle (quiz = fakeout → NO) -------------------
  {
    id: 11,
    type: 'teach',
    kicker: 'Learn · TSLA · Descending Triangle',
    title: 'Descending Triangle',
    intro:
      'A flat horizontal support tested by equal lows while highs step lower — price coils, then breaks DOWN through the flat support.',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'desctri_teach_TSLA',
        mode: 'teach',
        hlines: [
          { price: 17.24, col: 'blue', label: 'Flat support ~17.2', dashed: true },
          { price: 18.4, col: 'red', label: 'Stop 18.40', dashed: true },
        ],
        markers: [
          { date: '2019-04-03', price: 19.74, kind: 'dot', label: 'Lower high 19.74' },
          { date: '2019-04-10', price: 18.56, kind: 'dot', label: 'Lower high 18.56' },
          { date: '2019-04-18', price: 18.32, kind: 'dot', label: 'Lower high 18.32' },
          { date: '2019-03-25', price: 16.96, kind: 'dot', label: 'Support 16.96' },
          { date: '2019-04-22', price: 17.5, kind: 'dot', label: 'Support 17.50' },
          { date: '2019-04-25', price: 17.2, kind: 'sell', label: 'SHORT 17.20' },
          { date: '2019-05-13', price: 14.7, kind: 'target', label: 'Target 14.70' },
        ],
      },
    },
    caption:
      'SHORT/SELL the April 24-25 breakdown near 17.20 as price closes below the flat ~$17.2-17.5 support. TARGET = breakdown − triangle height (19.74 − 17.24 ≈ 2.5) ≈ $14.70, reached by mid-May. STOP just above the last lower high at 18.32, around $18.40. Price cascaded to an $11.80 low.',
  },
  {
    id: 12,
    type: 'quiz',
    kicker: 'Quiz · GE · Descending Triangle',
    title: 'Does this Descending Triangle complete?',
    intro:
      'GE has coiled into a descending triangle: lower highs pressing on a flat ~$83 support, with price sitting on the floor. Does it break DOWN as expected?',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'desctri_quiz_GE',
        mode: 'quiz',
        splitDate: '2017-12-29',
        hlines: [{ price: 83.0, col: 'blue', label: 'Flat support ~83', dashed: true }],
        markers: [
          { date: '2017-12-18', price: 86.5, kind: 'dot', label: 'Lower high 86.50' },
          { date: '2017-12-28', price: 82.67, kind: 'dot', label: 'Support 82.67' },
          { date: '2018-01-11', price: 91.15, kind: 'buy', label: 'Broke UP 91.15' },
        ],
        outcome: { text: 'Bounced and broke UP — the triangle faked out', good: false },
      },
    },
    quiz: {
      prompt: 'Does the pattern complete and break DOWN as expected?',
      options: [
        { id: 'yes', label: 'Yes — it completes' },
        { id: 'no', label: 'No — it fails' },
      ],
      correctId: 'no',
      explainRight:
        'Correct. Instead of slicing through the flat ~$83 support, GE bounced hard: Jan 2 closed 86.17, and by Jan 11 it broke UP through the descending resistance to a 92.93 high — a bullish fakeout of the bearish setup. Support held and the pattern failed.',
      explainWrong:
        'It actually failed. The chart looked like a bearish descending triangle ready to break, but support at ~$83 held and price reversed UP, closing 86.17 on Jan 2 and pushing to 92.93 by Jan 11 — decisively breaking the falling resistance line. The bearish pattern faked out.',
    },
  },

  // --- Pair 7 — Double Top (quiz completes → YES) --------------------------
  {
    id: 13,
    type: 'teach',
    kicker: 'Learn · TSLA · Double Top',
    title: 'Double Top',
    intro:
      'Two peaks at roughly the same price separated by a trough (the neckline). The reversal confirms on a close BELOW the neckline after the second peak.',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'dt_teach_TSLA',
        mode: 'teach',
        hlines: [
          { price: 326.2, col: 'blue', label: 'Neckline ~326', dashed: true },
          { price: 402.67, col: 'red', label: 'Stop 402.67', dashed: true },
        ],
        markers: [
          { date: '2021-11-04', price: 414.5, kind: 'dot', label: 'Peak 1 414.50' },
          { date: '2021-11-15', price: 326.2, kind: 'dot', label: 'Trough 326.20' },
          { date: '2022-01-03', price: 400.36, kind: 'dot', label: 'Peak 2 400.36' },
          { date: '2022-01-21', price: 314.63, kind: 'sell', label: 'SHORT 314.63' },
          { date: '2022-02-24', price: 237.9, kind: 'target', label: 'Target 237.90' },
        ],
      },
    },
    caption:
      'This is a bearish reversal, so SHORT/SELL on the decisive close below the ~$326 neckline (Jan 21 close 314.63). STOP just above the second peak at ~$402.67. TARGET = neckline − height (414.50 − 326.20 = 88.30) = $237.90; price reached a 233.33 low by Feb 24, exceeding the target.',
  },
  {
    id: 14,
    type: 'quiz',
    kicker: 'Quiz · NFLX · Double Top',
    title: 'Does this Double Top complete?',
    intro:
      'Netflix printed two peaks (~69 and ~70) separated by a ~64.5 trough, and is rolling over off the second peak. Does it confirm below the neckline?',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'dt_quiz_NFLX',
        mode: 'quiz',
        splitDate: '2021-11-19',
        hlines: [{ price: 64.5, col: 'blue', label: 'Neckline ~64.5', dashed: true }],
        markers: [
          { date: '2021-10-29', price: 69.1, kind: 'dot', label: 'Peak 1 69.10' },
          { date: '2021-11-17', price: 70.1, kind: 'dot', label: 'Peak 2 70.10' },
          { date: '2021-12-01', price: 61.78, kind: 'sell', label: 'Breakdown 61.78' },
        ],
        outcome: { text: 'Broke below neckline — it completed', good: true },
      },
    },
    quiz: {
      prompt: 'Will this double top CONFIRM by closing below the ~$64.5 neckline and following through?',
      options: [
        { id: 'yes', label: 'Yes — it completes' },
        { id: 'no', label: 'No — it fails' },
      ],
      correctId: 'yes',
      explainRight:
        'Correct. The two near-equal peaks (~69.10 and ~70.10) sat over a ~64.50 trough. The reversal confirmed when NFLX closed 64.19 on Nov 30 and gapped to 61.78 on Dec 1, breaking the neckline with follow-through to a 59.40 low — right at the measured-move target (64.5 − 4.6 = 59.9).',
      explainWrong:
        'It actually completed. After the second peak (high 70.10), NFLX rolled over and closed below the ~$64.5 neckline (64.19 on Nov 30, then 61.78 on Dec 1) with continuation to 59.40. The pattern would have been invalidated only if price had reclaimed the ~70 peaks; it did not.',
    },
  },

  // --- Pair 8 — Head and Shoulders (quiz = fakeout → NO) --------------------
  {
    id: 15,
    type: 'teach',
    kicker: 'Learn · DIS · Head and Shoulders',
    title: 'Head and Shoulders',
    intro:
      'A left shoulder, a higher head, then a lower right shoulder, with a neckline through the two troughs. Confirms on a close BELOW the neckline.',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'hs_teach_DIS',
        mode: 'teach',
        hlines: [
          { price: 182.0, col: 'blue', label: 'Neckline ~182', dashed: true },
          { price: 192.5, col: 'red', label: 'Stop 192.50', dashed: true },
        ],
        markers: [
          { date: '2021-02-24', price: 200.6, kind: 'dot', label: 'Left shoulder 200.60' },
          { date: '2021-03-08', price: 203.02, kind: 'dot', label: 'Head 203.02' },
          { date: '2021-04-05', price: 191.67, kind: 'dot', label: 'Right shoulder 191.67' },
          { date: '2021-05-14', price: 173.7, kind: 'sell', label: 'SHORT 173.70' },
          { date: '2021-05-19', price: 161.0, kind: 'target', label: 'Target 161.00' },
        ],
      },
    },
    caption:
      'SHORT/SELL on the decisive close below the ~$182 neckline (May 14 close 173.70). TARGET = neckline − head height (203.02 − 182 = 21.02) ≈ $161. STOP just above the right shoulder at ~$192.50. Price slid to a 167.10 low by May 19, confirming the bearish resolution.',
  },
  {
    id: 16,
    type: 'quiz',
    kicker: 'Quiz · META · Head and Shoulders',
    title: 'Does this Head and Shoulders complete?',
    intro:
      'Meta carved an H&S top: left shoulder ~319, a higher head ~326, a lower right shoulder ~313, with a neckline near $290. Does it break below?',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'hs_quiz_META',
        mode: 'quiz',
        splitDate: '2023-09-15',
        hlines: [{ price: 290.0, col: 'blue', label: 'Neckline ~290', dashed: true }],
        markers: [
          { date: '2023-07-28', price: 326.2, kind: 'dot', label: 'Head 326.20' },
          { date: '2023-09-14', price: 312.87, kind: 'dot', label: 'Right shoulder 312.87' },
          { date: '2023-11-22', price: 342.92, kind: 'buy', label: 'Broke UP 342.92' },
        ],
        outcome: { text: 'Neckline held, broke UP — H&S faked out', good: false },
      },
    },
    quiz: {
      prompt: 'Will it close BELOW the neckline and complete the bearish breakdown?',
      options: [
        { id: 'yes', label: 'Yes — it completes' },
        { id: 'no', label: 'No — it fails' },
      ],
      correctId: 'no',
      explainRight:
        'Correct. A valid H&S needs a decisive CLOSE below the neckline. META only briefly poked to a 279.40 intraday low (Oct 26 close 288.35) before snapping back above ~$290, then broke out ABOVE the head to 342.92 by Nov 22. No sustained breakdown — the pattern faked out.',
      explainWrong:
        'It actually failed. Recognizing the setup was correct, but the neckline (~$290) held — only a brief intraday poke to 279.40, no sustained close-based breakdown. Price reversed to 342.92 (above the head) by Nov 22, so the bearish target of ~254 was never approached. Truth beats the textbook.',
    },
  },

  // --- Pair 9 — Triple Top (quiz completes → YES) --------------------------
  {
    id: 17,
    type: 'teach',
    kicker: 'Learn · NFLX · Triple Top',
    title: 'Triple Top',
    intro:
      'Three peaks at roughly the same level over a shared support shelf. The reversal confirms on a close BELOW that support.',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'triple_teach_NFLX',
        mode: 'teach',
        hlines: [
          { price: 64.5, col: 'blue', label: 'Support ~64.5', dashed: true },
          { price: 70.5, col: 'red', label: 'Stop 70.50', dashed: true },
        ],
        markers: [
          { date: '2021-10-29', price: 69.1, kind: 'dot', label: 'Top 1 69.10' },
          { date: '2021-11-12', price: 68.33, kind: 'dot', label: 'Top 2 68.33' },
          { date: '2021-11-17', price: 70.1, kind: 'dot', label: 'Top 3 70.10' },
          { date: '2021-11-10', price: 64.21, kind: 'dot', label: 'Support 64.21' },
          { date: '2021-12-01', price: 61.78, kind: 'sell', label: 'SHORT 61.78' },
          { date: '2021-12-03', price: 59.0, kind: 'target', label: 'Target 59.00' },
        ],
      },
    },
    caption:
      'SHORT/SELL on the confirmed close below the ~$64.50 support (Dec 1 close 61.78). TARGET = support − pattern height (~70 peaks are ~5.5 above support) = ~$59, reached two sessions later (Dec 3 low 59.40). STOP just above the highest peak at ~$70.50.',
  },
  {
    id: 18,
    type: 'quiz',
    kicker: 'Quiz · BABA · Triple Top',
    title: 'Does this Triple Top complete?',
    intro:
      'Alibaba printed three tops near 310-319 and is now sitting on the ~$300 support shelf after the third peak failed. Does it confirm below support?',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'triple_quiz_BABA',
        mode: 'quiz',
        splitDate: '2020-11-06',
        hlines: [{ price: 300.0, col: 'blue', label: 'Support ~300', dashed: true }],
        markers: [
          { date: '2020-10-21', price: 314.0, kind: 'dot', label: 'Top 2 314.00' },
          { date: '2020-10-27', price: 319.32, kind: 'dot', label: 'Top 3 319.32' },
          { date: '2020-11-10', price: 266.54, kind: 'sell', label: 'Breakdown 266.54' },
        ],
        outcome: { text: 'Broke below support — it completed', good: true },
      },
    },
    quiz: {
      prompt: 'Will it confirm the triple top by closing BELOW support and following through?',
      options: [
        { id: 'yes', label: 'Yes — it completes' },
        { id: 'no', label: 'No — it fails' },
      ],
      correctId: 'yes',
      explainRight:
        'Correct. Three tops (310.01, 314.00, 319.32) sat on ~$300 support. Price closed below it on Nov 9 (290.53) and confirmed with the Nov 10 breakdown (close 266.54), then fell to a 252.55 low — blowing through the measured-move target of ~281.',
      explainWrong:
        'It actually completed. After the third peak failed, BABA gapped and broke down: Nov 9 closed 290.53 (below the ~$300 support) and Nov 10 plunged to a 266.54 close with follow-through to 252.55. The pattern would have failed only if price had reclaimed the ~319 peaks; it did not.',
    },
  },

  // --- Pair 10 — Double Bottom (quiz = fakeout → NO) ------------------------
  {
    id: 19,
    type: 'teach',
    kicker: 'Learn · NFLX · Double Bottom',
    title: 'Double Bottom',
    intro:
      'Two troughs at roughly the same price separated by a peak (the neckline), forming a W. Confirms when price closes ABOVE the neckline.',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'db_teach_NFLX',
        mode: 'teach',
        hlines: [
          { price: 20.5, col: 'blue', label: 'Neckline ~20.5', dashed: true },
          { price: 16.0, col: 'red', label: 'Stop 16.00', dashed: true },
        ],
        markers: [
          { date: '2022-05-12', price: 16.27, kind: 'dot', label: 'Trough 1 16.27' },
          { date: '2022-06-02', price: 20.55, kind: 'dot', label: 'Neckline peak 20.55' },
          { date: '2022-06-14', price: 16.43, kind: 'dot', label: 'Trough 2 16.43' },
          { date: '2022-07-20', price: 21.64, kind: 'buy', label: 'BUY 21.64' },
          { date: '2022-08-15', price: 24.6, kind: 'target', label: 'Target 24.60' },
        ],
      },
    },
    caption:
      'BUY on the confirmation close above the neckline (July 20 close 21.64), clearing the ~$20.5 peak between the two troughs. TARGET = neckline + (neckline − trough) = 20.5 + (20.5 − 16.4) ≈ $24.6, hit Aug 15 (high 25.20). STOP just below the second trough at ~$16.',
  },
  {
    id: 20,
    type: 'quiz',
    kicker: 'Quiz · SNAP · Double Bottom',
    title: 'Does this Double Bottom complete?',
    intro:
      'SNAP printed two bottoms near 27 with a neckline peak around 39.5, and is lifting off the second trough. Does it confirm above the neckline?',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'db_quiz_SNAP',
        mode: 'quiz',
        splitDate: '2022-05-04',
        hlines: [{ price: 39.5, col: 'blue', label: 'Neckline ~39.5', dashed: true }],
        markers: [
          { date: '2022-03-14', price: 27.67, kind: 'dot', label: 'Trough 1 27.67' },
          { date: '2022-04-27', price: 26.56, kind: 'dot', label: 'Trough 2 26.56' },
          { date: '2022-05-06', price: 24.92, kind: 'sell', label: 'Broke down 24.92' },
        ],
        outcome: { text: 'Broke below the right foot — the W failed', good: false },
      },
    },
    quiz: {
      prompt: 'Will this Double Bottom confirm by closing above the ~$39.5 neckline?',
      options: [
        { id: 'yes', label: 'Yes — it completes' },
        { id: 'no', label: 'No — it fails' },
      ],
      correctId: 'no',
      explainRight:
        'Correct. A double bottom is valid only once price CLOSES above the neckline (~39.5), and confirmation never came. Two sessions after the split the right foot gave way: May 6 closed 24.92 (below the 26.56 trough, the stop level), sliding to a 21.70 low and then a 12.79 close on a May 24 profit warning — a ~58% collapse.',
      explainWrong:
        'It actually failed. The W looked plausible, but price never approached the ~$39.5 neckline. Instead the right foot broke: May 6 closed 24.92 below the second-trough low (26.56), a hard invalidation, then collapsed into the May 24 guidance-warning gap to 12.79. The setup faked out.',
    },
  },

  // --- Pair 11 — Inverted Head and Shoulders (quiz completes → YES) ---------
  {
    id: 21,
    type: 'teach',
    kicker: 'Learn · META · Inverted Head and Shoulders',
    title: 'Inverted Head and Shoulders',
    intro:
      'A left shoulder, a lower head, then a higher right shoulder, with a neckline through the two intervening peaks. Confirms on a close ABOVE the neckline.',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'ihs_teach_META',
        mode: 'teach',
        hlines: [
          { price: 124.0, col: 'blue', label: 'Neckline ~124', dashed: true },
          { price: 112.0, col: 'red', label: 'Stop 112.00', dashed: true },
        ],
        markers: [
          { date: '2022-10-13', price: 122.53, kind: 'dot', label: 'Left shoulder 122.53' },
          { date: '2022-11-04', price: 88.09, kind: 'dot', label: 'Head 88.09' },
          { date: '2022-12-07', price: 112.88, kind: 'dot', label: 'Right shoulder 112.88' },
          { date: '2023-01-03', price: 124.74, kind: 'buy', label: 'BUY 124.74' },
          { date: '2023-02-02', price: 160.0, kind: 'target', label: 'Target 160.00' },
        ],
      },
    },
    caption:
      'BUY on the confirming close above the neckline (Jan 3 close 124.74), clearing the Dec 2 right-peak high of 124.04. TARGET = neckline + (neckline − head) = 124 + (124 − 88) ≈ $160, exceeded as price ran to a 197.16 high by Feb 2. STOP just below the right shoulder near $112.',
  },
  {
    id: 22,
    type: 'quiz',
    kicker: 'Quiz · NVDA · Inverted Head and Shoulders',
    title: 'Does this Inverted Head and Shoulders complete?',
    intro:
      'NVDA formed an inverted H&S: left shoulder ~14.9, a lower head ~13.9, a right shoulder ~14.0, with a neckline near $15. Price sits just under it at 14.86.',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'ihs_quiz_NVDA',
        mode: 'quiz',
        splitDate: '2023-01-06',
        hlines: [{ price: 15.0, col: 'blue', label: 'Neckline ~15.0', dashed: true }],
        markers: [
          { date: '2022-12-22', price: 14.88, kind: 'dot', label: 'Left shoulder 14.88' },
          { date: '2022-12-28', price: 13.88, kind: 'dot', label: 'Head 13.88' },
          { date: '2023-01-05', price: 14.03, kind: 'dot', label: 'Right shoulder 14.03' },
          { date: '2023-01-09', price: 15.63, kind: 'buy', label: 'Breakout 15.63' },
        ],
        outcome: { text: 'Closed above neckline — it completed', good: true },
      },
    },
    quiz: {
      prompt: 'Will it close above the neckline and complete the bullish reversal?',
      options: [
        { id: 'yes', label: 'Yes — it completes' },
        { id: 'no', label: 'No — it fails' },
      ],
      correctId: 'yes',
      explainRight:
        'Correct. The structure was a textbook inverted H&S (left shoulder ~14.88, lower head 13.88, right shoulder ~14.03). The confirming signal arrived Jan 9 with a 15.63 close above the ~$15 neckline, then ran to 17.70, 20.36 and 22.34 — far surpassing the ~16.1 measured target.',
      explainWrong:
        'It actually completed. Three sessions after the split, NVDA closed 15.63 on Jan 9 (high 16.06), decisively clearing the ~$15 neckline, and never looked back — 22.34 by Feb 9. Measured target = 15.0 + (15.0 − 13.88) ≈ 16.1, hit within days and then vastly exceeded.',
    },
  },

  // --- Pair 12 — Triple Bottom (quiz completes → YES) ----------------------
  {
    id: 23,
    type: 'teach',
    kicker: 'Learn · BAC · Triple Bottom',
    title: 'Triple Bottom',
    intro:
      'Three troughs at roughly the same level under a shared resistance ceiling. Confirms on a close ABOVE that resistance.',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'triple_bottom_teach_BAC',
        mode: 'teach',
        hlines: [
          { price: 28.0, col: 'blue', label: 'Resistance ~28', dashed: true },
          { price: 24.7, col: 'red', label: 'Stop 24.70', dashed: true },
        ],
        markers: [
          { date: '2023-10-04', price: 25.58, kind: 'dot', label: 'Trough 1 25.58' },
          { date: '2023-10-18', price: 28.04, kind: 'dot', label: 'Resistance 28.04' },
          { date: '2023-10-25', price: 25.18, kind: 'dot', label: 'Trough 2 25.18' },
          { date: '2023-10-27', price: 24.96, kind: 'dot', label: 'Trough 3 24.96' },
          { date: '2023-11-14', price: 29.22, kind: 'buy', label: 'BUY 29.22' },
          { date: '2023-12-14', price: 31.0, kind: 'target', label: 'Target 31.00' },
        ],
      },
    },
    caption:
      'BUY on the confirming close above the ~$28 resistance (Nov 14 close 29.22). Pattern depth = resistance (28) − trough zone (~25) = 3, so TARGET = 28 + 3 ≈ $31, reached by early December (Dec 14 high 33.94). STOP just below the triple-bottom lows at ~$24.70.',
  },
  {
    id: 24,
    type: 'quiz',
    kicker: 'Quiz · DIS · Triple Bottom',
    title: 'Does this Triple Bottom complete?',
    intro:
      'Disney printed three troughs near $79-82 under a ~$86 resistance ceiling. Does price close ABOVE the resistance and break out higher?',
    scene: {
      kind: 'candle',
      params: {
        candlesKey: 'triple_bottom_quiz_DIS',
        mode: 'quiz',
        splitDate: '2023-11-01',
        hlines: [{ price: 86.0, col: 'blue', label: 'Resistance ~86', dashed: true }],
        markers: [
          { date: '2023-10-04', price: 79.0, kind: 'dot', label: 'Trough ~79' },
          { date: '2023-10-26', price: 80.0, kind: 'dot', label: 'Trough ~80' },
          { date: '2023-11-09', price: 90.34, kind: 'buy', label: 'Breakout 90.34' },
        ],
        outcome: { text: 'Closed above resistance — it completed', good: true },
      },
    },
    quiz: {
      prompt: 'Will price close ABOVE the ~$86 resistance to confirm the triple bottom?',
      options: [
        { id: 'yes', label: 'Yes — it completes' },
        { id: 'no', label: 'No — it fails' },
      ],
      correctId: 'yes',
      explainRight:
        'Correct. The triple bottom confirms on a close above the ~$86 resistance set by the two interior peaks. DIS delivered exactly that on Nov 9 with a breakaway gap closing at 90.34, then followed through to ~96.5 — a breakout in the expected bullish direction.',
      explainWrong:
        'It actually completed. After the split (Nov 1 close 81.07), DIS gapped sharply higher on Nov 9 to close 90.34, decisively breaking the ~$86 resistance, and continued to a 96.51 high by Nov 24. The breakout with follow-through confirmed the triple bottom.',
    },
  },
]

const pkg: LessonPackage = {
  lesson: {
    id: 'reading-charts',
    index: 1,
    title: 'Reading the Charts',
    subtitle: '12 Technical-Analysis Patterns',
    level: 1,
    blurb:
      'Learn to spot 12 classic chart patterns on real stock data — then prove it: half the chart is hidden and you call the breakout.',
    modules,
  },
  scenes: {
    candle: CandleChartScene,
    title: TitleScene,
  },
}

export default pkg
