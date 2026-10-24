// Sample curriculum for the Quranic Excellence program. Everything here is SAMPLE content: the academy must review it
// (especially every Arabic text) before the program is published. Edit it in the admin panel after the seed is loaded.
// Run:  node tools/gen_seed.js   to rebuild sql/011_seed_quranic_excellence.sql

const NOTE_VERIFY = 'Sample text. Check it against the approved mushaf or the academy\'s own source before using it with students.';
const IKHLAS = ['قُلْ هُوَ ٱللَّهُ أَحَدٌ', 'ٱللَّهُ ٱلصَّمَدُ', 'لَمْ يَلِدْ وَلَمْ يُولَدْ', 'وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ'];

const rich = (text) => ({ type: 'rich_text', data: { text } });
const arabic = (ar, translit, tr) => ({ type: 'arabic_text', data: { arabic: ar, transliteration: translit || '', translation: tr || '' } });
const verse = (ar, ref, tr) => ({ type: 'quran_verse', data: { arabic: ar, reference: ref, translation: tr || '', note: NOTE_VERIFY } });
const vocab = (items) => ({ type: 'vocabulary', data: { items } });
const checklist = (title, items, required) => ({ type: 'exercise', required: !!required, data: { kind: 'checklist', title, instructions: 'Tick each step when you have done it.', items } });
const cards = (title, items, required) => ({ type: 'exercise', required: !!required, data: { kind: 'cards', title, instructions: 'Think of the answer first, then tap the card.', items } });
const tnote = (text) => ({ type: 'teacher_note', data: { text } });

// question helpers: key is stored apart and never sent to students
const single = (prompt, opts, correct, explanation, o) => Object.assign({ type: 'single', prompt, options: opts.map((t, i) => ({ id: 'abcdef'[i], text: t })), key: { correct: 'abcdef'[correct] }, explanation: explanation || '', points: 1 }, o || {});
const multi = (prompt, opts, correct, explanation, o) => Object.assign({ type: 'multiple', prompt, options: opts.map((t, i) => ({ id: 'abcdef'[i], text: t })), key: { correct: correct.map(i => 'abcdef'[i]) }, explanation: explanation || '', points: 2 }, o || {});
const tf = (prompt, value, explanation) => ({ type: 'true_false', prompt, options: [], key: { correct: value }, explanation: explanation || '', points: 1 });
const short = (prompt, accepted, explanation, o) => Object.assign({ type: 'short_answer', prompt, options: [], key: { accepted, case_sensitive: false }, explanation: explanation || '', points: 1 }, o || {});
const match = (prompt, pairs, explanation) => ({ type: 'matching', prompt, options: { left: pairs.map((p, i) => ({ id: 'l' + (i + 1), text: p[0] })), right: pairs.map((p, i) => ({ id: 'r' + (i + 1), text: p[1] })) }, key: { pairs: Object.fromEntries(pairs.map((p, i) => ['l' + (i + 1), 'r' + (i + 1)])) }, explanation: explanation || '', points: 2 });
const order = (prompt, items, explanation) => ({ type: 'ordering', prompt, options: items.map((t, i) => ({ id: 'o' + (i + 1), text: t })), key: { order: items.map((t, i) => 'o' + (i + 1)) }, explanation: explanation || '', points: 2 });
const written = (prompt, o) => Object.assign({ type: 'written', prompt, options: [], key: {}, explanation: '', points: 4 }, o || {});
const audio = (prompt, ar) => ({ type: 'audio', prompt, arabic_text: ar || '', options: [], key: {}, explanation: '', points: 4 });

const L = (title, description, objectives, blocks, o) => Object.assign({ title, description, objectives, blocks, est: 15 }, o || {});
const U = (title, description, objectives, lessons, assess, o) => Object.assign({ title, description, objectives, lessons, assess, est: 45 }, o || {});

const program = {
  slug: 'quranic-excellence', title: 'Quranic Excellence', alt_name: "Qur'anic Journey", tagline: 'Little Steps, Build a Lifetime of Iman.',
  short_description: 'A structured path through three levels and five domains of Quranic and Islamic learning.',
  description: 'Quranic Excellence takes a learner step by step through three levels: Foundation, Fluency and Mastery. In every level the same five domains return: Quran Studies, Sunnah and Hadith, Islamic Aqidah, Fiqh and Worship, and Islamic Manners and Character. Each unit has short lessons, practice, and a check before the next one opens.',
  objectives: ['Read the Quran with growing accuracy and confidence', 'Learn daily duas and foundational hadith', 'Understand the basic beliefs of Islam', 'Practise wudu and salah correctly', 'Build good manners and character'],
  student_profile: 'Children and adults who want a clear, steady path in Quran and Islamic basics.',
  curriculum_overview: 'Three levels, five domains, structured units with lessons and assessments. Sample content: the academy reviews and replaces it before publishing.',
  estimated_duration: '', cta_label: 'Book a Free Assessment',
  settings: { gamification: { xp: true, streaks: true, badges: true, certificates: true, xp_lesson: 10, xp_unit: 50, xp_level: 150, xp_assessment: 25, xp_program: 300 },
              progression: { unit_mode: 'sequential', level_mode: 'sequential', lesson_mode: 'free', max_attempts: null, retry_wait_hours: 0 } }
};

const levels = [
  { key: 'L1', n: 1, title: 'Foundation', color: '#2F7D5B', description: 'Build essential knowledge, foundational skills and confidence.',
    objectives: ['Recognise Arabic letters and read short words', 'Learn the first duas, the Kalimah and the pillars of Iman', 'Perform wudu and understand the basics of salah', 'Practise everyday manners'], completion_rule: {} },
  { key: 'L2', n: 2, title: 'Fluency', color: '#B8975A', description: 'Strengthen understanding, improve fluency and encourage practical application.',
    objectives: ['Read short passages smoothly', 'Understand and apply hadith in daily life', 'Learn about the names of Allah', 'Practise prayer and good character in real situations'], completion_rule: {} },
  { key: 'L3', n: 3, title: 'Mastery', color: '#1F5F74', description: 'Develop deeper knowledge, refine skills and show independent application.',
    objectives: ['Recite with confidence and attention to tajweed', 'Study and explain a hadith independently', 'Connect the pillars of Iman and Islam to daily life', 'Lead others with good character'], completion_rule: { teacher_approval: true } }
];

const domains = [
  { key: 'QS', title: 'Quran Studies', icon: 'quran', color: '#2F7D5B', description: 'Reading, pronunciation, recitation and selected surahs.' },
  { key: 'SH', title: 'Sunnah & Hadith', icon: 'hadith', color: '#B8975A', description: 'Daily duas, the example of the Prophet and basic hadith.' },
  { key: 'AQ', title: 'Islamic Aqidah', icon: 'aqidah', color: '#1F5F74', description: 'The core beliefs of Islam.' },
  { key: 'FW', title: 'Fiqh & Worship', icon: 'fiqh', color: '#7A5C99', description: 'Purification, prayer and acts of worship.' },
  { key: 'IM', title: 'Islamic Manners & Character', icon: 'adab', color: '#B5651D', description: 'Adab, habits and character in everyday life.' }
];

// ---------- Level 1: two units in every domain ----------
const units = {};
units['L1.QS'] = [
  U('Reading Foundations', 'Recognise the Arabic letters and short vowels, and join them into words.', ['Name and recognise the Arabic letters', 'Read letters with fatha, kasra and damma', 'Join letters into simple words'], [
    L('Arabic letters and their sounds', 'Meet the letters and say each sound clearly.', ['Recognise the first letters', 'Say each sound'], [
      rich('Arabic is read from right to left. Each letter has a name and a sound. Today we meet the first letters.'),
      arabic('ا  ب  ت  ث', 'alif, ba, ta, tha', ''),
      vocab([{ term: 'Alif', meaning: 'The first letter', arabic: 'ا' }, { term: 'Ba', meaning: 'The second letter', arabic: 'ب' }, { term: 'Ta', meaning: 'The third letter', arabic: 'ت' }]),
      checklist('Practise the letters', ['Say each letter out loud', 'Trace each letter in the air', 'Say the letters with your teacher'], true),
      tnote('Listen to the learner say each letter. Correct the sound gently and repeat.')], { rule: { type: 'blocks' } }),
    L('Short vowels: fatha, kasra, damma', 'Read a letter with each short vowel.', ['Name the three short vowels', 'Read ba with each vowel'], [
      rich('The short vowels are small marks. Fatha is above the letter, kasra is below it, and damma is a small waw-like mark above it.'),
      arabic('بَ  بِ  بُ', 'ba, bi, bu', ''),
      cards('Quick check', [{ q: 'Where is the fatha written?', a: 'Above the letter.' }, { q: 'Where is the kasra written?', a: 'Below the letter.' }])]),
    L('Joining letters into words', 'See how letters join to make a word.', ['Read a simple joined word'], [
      rich('Most Arabic letters join to the next letter. A joined word is read from right to left.'),
      arabic('بَاب', 'baab', 'door'),
      checklist('Practise', ['Read the word slowly', 'Read it three times without stopping'])], { rule: { type: 'manual' } })
  ], { title: 'Reading Foundations check', pass: 70, questions: [
    single('Which letter is this: ب ?', ['Alif', 'Ba', 'Ta'], 1, 'The letter ب is called Ba.'),
    match('Match each letter with its name.', [['ا', 'Alif'], ['ب', 'Ba'], ['ت', 'Ta']]),
    tf('Arabic is read from right to left.', true, 'Yes. Arabic is written and read from right to left.'),
    audio('Record yourself saying the letters: ا ب ت ث', 'ا  ب  ت  ث')] }),
  U('Sukoon, Tashdid & Selected Surahs', 'Learn the signs of sukoon and tashdid and read Surah Al-Ikhlas.', ['Read a letter with sukoon', 'Recognise and read tashdid', 'Read Surah Al-Ikhlas with a teacher'], [
    L('Sukoon: a letter without a vowel', 'Understand and read the sukoon sign.', ['Recognise sukoon', 'Read a letter with sukoon'], [
      rich('A small circle above a letter is called sukoon. It means the letter has no vowel of its own, so we stop on it quickly.'),
      arabic('أَبْ', 'ab', '')]),
    L('Tashdid: doubling a letter', 'Understand and read the tashdid sign.', ['Recognise tashdid', 'Read a doubled letter'], [
      rich('The sign that looks like a small w above a letter is called tashdid (also called shaddah). It means the letter is said twice: once without a vowel and once with it.'),
      arabic('رَبَّ', 'rab-ba', '')]),
    L('Reading Surah Al-Ikhlas', 'Read the four short verses with your teacher.', ['Read the verses slowly', 'Know the surah name and number'], [
      rich('Surah Al-Ikhlas is the 112th surah. It has four short verses. Read it slowly with your teacher.'),
      verse(IKHLAS.join('  ۝  '), 'Surah Al-Ikhlas 112:1-4', ''),
      checklist('Practise', ['Read each verse with your teacher', 'Read the whole surah slowly', 'Read it again without help'], true)], { rule: { type: 'blocks' } })
  ], { title: 'Sukoon, Tashdid and Surah check', pass: 70, questions: [
    short('What is the sign that doubles a letter called?', ['tashdid', 'shaddah', 'shadda', 'shaddah or tashdid'], 'It is called tashdid, also known as shaddah.'),
    tf('A letter with sukoon has no vowel of its own.', true),
    order('Put the verses of Surah Al-Ikhlas in order.', IKHLAS, 'Read the surah again slowly to learn the order.')] })
];
units['L1.SH'] = [
  U('Daily Duas & Basic Hadith', 'Learn simple duas and your first hadith.', ['Say the dua before and after eating', 'Say the dua before sleeping', 'Understand a famous hadith about intention'], [
    L('Dua before and after eating', 'Say the words before and after a meal.', ['Say Bismillah before eating', 'Say the dua after eating'], [
      rich('We begin eating with the name of Allah and thank Him when we finish.'),
      arabic('بِسْمِ ٱللَّهِ', 'Bismillah', 'In the name of Allah'),
      arabic('ٱلْحَمْدُ لِلَّهِ ٱلَّذِي أَطْعَمَنَا وَسَقَانَا وَجَعَلَنَا مُسْلِمِينَ', 'Alhamdu lillahi alladhi at\'amana wa saqana wa ja\'alana muslimin', 'Praise be to Allah who fed us, gave us drink and made us Muslims.'),
      checklist('Practise today', ['Say it before your next meal', 'Say the dua after eating'], true)], { rule: { type: 'blocks' } }),
    L('Dua before sleeping', 'Say a short dua as you go to bed.', ['Say the dua before sleeping'], [
      rich('Before we sleep we remember Allah.'),
      arabic('بِاسْمِكَ ٱللَّهُمَّ أَمُوتُ وَأَحْيَا', 'Bismika Allahumma amutu wa ahya', 'In Your name, O Allah, I die and I live.')]),
    L('Hadith: actions are by intentions', 'Learn a short, famous hadith.', ['Say what the hadith teaches'], [
      rich('The Prophet, peace be upon him, taught that our actions are judged by our intentions. This hadith is reported in Sahih al-Bukhari and Sahih Muslim.'),
      arabic('إِنَّمَا ٱلْأَعْمَالُ بِٱلنِّيَّاتِ', 'Innamal a\'malu bin-niyyat', 'Actions are judged by intentions.'),
      tnote('Sample wording. Please check the full text and your preferred translation before use.')])
  ], { title: 'Daily Duas check', pass: 70, questions: [
    short('What do we say before we start eating?', ['bismillah', 'bismillah.', 'in the name of allah'], 'We say Bismillah.'),
    tf('The dua before sleeping begins with "Bismika Allahumma".', true),
    single('What does the hadith "Actions are judged by intentions" teach?', ['Intention matters', 'Only big actions matter', 'Nothing about intention'], 0, 'It teaches that our intention matters.')] }),
  U('Meanings & Practice', 'Understand what we say and practise it through the day.', ['Know when to say each dua', 'Practise duas through the day'], [
    L('Understanding the duas we say', 'Learn what the words mean.', ['Match each dua with its use'], [
      rich('When we know what a dua means, we say it with more care.'),
      cards('What do we say?', [{ q: 'Before eating', a: 'Bismillah' }, { q: 'Before sleeping', a: 'Bismika Allahumma amutu wa ahya' }])]),
    L('Practising duas through the day', 'Use your duas in real life.', ['Say your duas at the right times for a day'], [
      checklist('My day', ['Morning: say Bismillah before breakfast', 'Evening: say the dua after eating', 'Night: say the dua before sleeping'], true)], { rule: { type: 'blocks' } })
  ], { title: 'Meanings check', pass: 70, questions: [
    match('Match the time with the dua.', [['Before eating', 'Bismillah'], ['Before sleeping', 'Bismika Allahumma amutu wa ahya']])] })
];
units['L1.AQ'] = [
  U('Kalimah & Basic Beliefs', 'The Kalimah and what it means.', ['Say the Kalimah Tayyibah', 'Explain that Allah is One', 'Name the last Messenger'], [
    L('The Kalimah Tayyibah', 'Say and understand the first words of faith.', ['Say the Kalimah', 'Explain its meaning'], [
      arabic('لَا إِلَٰهَ إِلَّا ٱللَّهُ مُحَمَّدٌ رَسُولُ ٱللَّهِ', 'La ilaha illallah Muhammadur rasulullah', 'There is no god but Allah, Muhammad is the Messenger of Allah.'),
      rich('These words are the beginning of Islam. We say that Allah is One and that Muhammad is His Messenger.')]),
    L('Allah is One', 'Learn what it means that Allah is One.', ['Say that Allah is One'], [
      rich('Allah is One. He has no partner. We worship only Him.'),
      cards('Think and answer', [{ q: 'How many gods are there?', a: 'There is only one God: Allah.' }])])
  ], { title: 'Kalimah check', pass: 70, questions: [
    single('Who is the last Messenger of Allah?', ['Muhammad, peace be upon him', 'Musa, peace be upon him', 'Ibrahim, peace be upon him'], 0),
    tf('Allah is One and has no partner.', true)] }),
  U('Pillars of Iman', 'The six pillars of belief.', ['Name the six pillars of Iman'], [
    L('The six pillars of Iman', 'Learn the six things a believer believes in.', ['Name the six pillars'], [
      rich('The pillars of Iman are belief in: Allah, His angels, His books, His messengers, the Last Day, and the divine decree (qadar).'),
      checklist('Learn them', ['Say the six pillars aloud', 'Say them again without looking'], true)], { rule: { type: 'blocks' } }),
    L('Believing and acting', 'Iman in daily life.', ['Give one example of Iman in action'], [
      rich('Iman is in the heart and shows in what we say and do.')])
  ], { title: 'Pillars of Iman check', pass: 70, questions: [
    multi('Which of these are pillars of Iman? Select all that apply.', ['Belief in Allah', 'Belief in the angels', 'Fasting in Ramadan', 'Belief in the Last Day'], [0, 1, 3], 'Fasting is a pillar of Islam, not of Iman.'),
    tf('There are six pillars of Iman.', true)] })
];
units['L1.FW'] = [
  U('Wudu Fundamentals', 'Learn why and how we make wudu.', ['Explain why we make wudu', 'Perform the steps in order', 'Know what breaks wudu'], [
    L('Why we make wudu', 'Wudu prepares us for prayer.', ['Say why wudu matters'], [
      rich('Wudu is washing certain parts of the body with clean water before prayer. It is a way to prepare ourselves to stand before Allah.')]),
    L('The steps of wudu', 'Learn the steps in order.', ['Say the steps in order'], [
      rich('Begin with the intention and Bismillah. Then: wash the hands, rinse the mouth and nose, wash the face, wash the arms to the elbows, wipe the head, wash the feet to the ankles.'),
      checklist('Practise with your teacher', ['Say the steps in order', 'Do each step slowly with water', 'Do wudu again without help'], true)], { rule: { type: 'blocks' } }),
    L('Things that break wudu', 'Know when wudu needs to be made again.', ['Name common things that break wudu'], [
      rich('Common things that break wudu include using the toilet, passing wind, deep sleep and fainting.'),
      tnote('Details differ slightly between schools of thought. Teach according to the academy\'s approved reference.')])
  ], { title: 'Wudu check', pass: 70, questions: [
    order('Put the steps of wudu in order.', ['Wash the hands', 'Rinse the mouth and nose', 'Wash the face', 'Wash the arms to the elbows', 'Wipe the head', 'Wash the feet to the ankles']),
    tf('Wudu is made before prayer.', true)] }),
  U('Salah Basics', 'Know the five daily prayers and how to prepare.', ['Name the five prayers', 'Know the number of rak\'ahs', 'Know the parts of a rak\'ah'], [
    L('The five daily prayers', 'Learn their names and times of day.', ['Name the five prayers in order'], [
      rich('The five daily prayers are Fajr, Dhuhr, Asr, Maghrib and Isha.'),
      vocab([{ term: 'Fajr', meaning: 'Before sunrise', arabic: 'ٱلْفَجْر' }, { term: 'Dhuhr', meaning: 'After midday', arabic: 'ٱلظُّهْر' }, { term: 'Asr', meaning: 'Afternoon', arabic: 'ٱلْعَصْر' }, { term: 'Maghrib', meaning: 'After sunset', arabic: 'ٱلْمَغْرِب' }, { term: 'Isha', meaning: 'Night', arabic: 'ٱلْعِشَاء' }])]),
    L('Preparing for prayer', 'Clean body, clean place, facing the qiblah.', ['Name what we prepare before prayer'], [
      rich('Before prayer we make wudu, wear clean clothes, choose a clean place and face the qiblah, the direction of the Kaaba in Makkah.')]),
    L('The parts of a rak\'ah', 'Standing, bowing, prostration and sitting.', ['Name the parts of a rak\'ah'], [
      rich('A rak\'ah has standing, bowing (ruku), prostration (sujood) and sitting. Your teacher will show you each position.'),
      checklist('Practise with your teacher', ['Stand, bow, prostrate and sit slowly', 'Say the positions in order'])])
  ], { title: 'Salah check', pass: 70, questions: [
    match('Match the prayer with its number of fard rak\'ahs.', [['Fajr', '2'], ['Dhuhr', '4'], ['Maghrib', '3']]),
    single('Which direction do we face in prayer?', ['The qiblah', 'The sun', 'Any direction'], 0)] })
];
units['L1.IM'] = [
  U('Everyday Adab', 'Manners for daily life.', ['Greet with salam', 'Respect parents and teachers', 'Eat with good manners'], [
    L('Saying salam', 'Greet people with peace.', ['Say salam when meeting someone'], [
      arabic('ٱلسَّلَامُ عَلَيْكُمْ', 'Assalamu alaikum', 'Peace be upon you'), rich('We greet people with salam. The reply is "Wa alaikumus salam".')]),
    L('Respecting parents and teachers', 'Kind words and listening.', ['Give two ways to respect parents'], [
      rich('We speak kindly, listen carefully and help at home.'), checklist('This week', ['Help someone at home', 'Thank a teacher'], true)], { rule: { type: 'blocks' } }),
    L('Eating with good manners', 'Small habits at the table.', ['Name two good table manners'], [
      rich('We wash our hands, say Bismillah, eat with the right hand, take small bites and thank Allah.')])
  ], { title: 'Adab check', pass: 70, questions: [
    single('What do we say when we meet someone?', ['Assalamu alaikum', 'Nothing', 'Goodbye'], 0),
    tf('We should speak kindly to our parents.', true)] }),
  U('Good Habits & Character', 'Honesty, kindness and good habits.', ['Practise honesty', 'Share and be kind', 'Keep clean and be on time'], [
    L('Honesty', 'Speak the truth.', ['Explain why honesty matters'], [rich('A believer tells the truth, even when it is hard.')]),
    L('Kindness and sharing', 'Care for others.', ['Give an example of kindness'], [rich('We share what we have and help those who need help.')]),
    L('Cleanliness and punctuality', 'Small habits that help us.', ['Name one habit to improve'], [rich('Being clean and on time shows respect for others.')])
  ], { title: 'Character reflection', pass: 50, questions: [
    single('Which is an example of honesty?', ['Telling the truth', 'Hiding a mistake', 'Blaming someone else'], 0),
    written('Write two sentences: what is one good habit you want to build, and why?')] })
];

// ---------- Levels 2 and 3: one representative unit per domain ----------
const rep = (title, desc, obj, l1, l2, assess) => [U(title, desc, obj, [l1, l2], assess)];
units['L2.QS'] = rep('Fluent Reading', 'Read short words and verses smoothly.', ['Read short words without stopping', 'Read short verses accurately'],
  L('Reading short words smoothly', 'Build speed with accuracy.', ['Read a line of words smoothly'], [rich('Fluency comes from slow, correct reading repeated many times.'), checklist('Practise', ['Read a line slowly', 'Read it again a little faster', 'Read it with no mistakes'], true)], { rule: { type: 'blocks' } }),
  L('Reading short verses with accuracy', 'Apply what you know to a surah.', ['Read Surah Al-Ikhlas fluently'], [verse(IKHLAS.join('  ۝  '), 'Surah Al-Ikhlas 112:1-4', '')]),
  { title: 'Fluent reading recitation', pass: 60, questions: [audio('Record yourself reading Surah Al-Ikhlas.', IKHLAS.join('  ۝  '))] });
units['L2.SH'] = rep('Hadith for Daily Life', 'Learn hadith about kindness and apply them.', ['Know a hadith about loving for others', 'Apply it in daily life'],
  L('Loving for your brother what you love for yourself', 'A hadith about caring for others.', ['Say what the hadith teaches'], [rich('The Prophet, peace be upon him, taught that true belief includes wanting for others what we want for ourselves. It is reported in Sahih al-Bukhari and Sahih Muslim.'), arabic('لَا يُؤْمِنُ أَحَدُكُمْ حَتَّىٰ يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ', '', 'None of you truly believes until he loves for his brother what he loves for himself.'), tnote('Sample wording. Please check the full text and your preferred translation before use.')]),
  L('Practising the hadith', 'Bring the hadith into your week.', ['Do one kind action this week'], [checklist('This week', ['Share something with a friend', 'Say a kind word to someone'], true)], { rule: { type: 'blocks' } }), null);
units['L2.AQ'] = rep('Names of Allah', 'Learn two names of Allah and their meanings.', ['Know Ar-Rahman and Ar-Raheem', 'Know Al-Khaliq'],
  L('Ar-Rahman and Ar-Raheem', 'Allah is Most Merciful.', ['Say the two names and their meaning'], [arabic('ٱلرَّحْمَٰنُ ٱلرَّحِيمُ', 'Ar-Rahman Ar-Raheem', 'The Most Merciful, the Especially Merciful')]),
  L('Al-Khaliq', 'Allah is the Creator.', ['Say what Al-Khaliq means'], [arabic('ٱلْخَالِقُ', 'Al-Khaliq', 'The Creator')]),
  { title: 'Names of Allah check', pass: 70, questions: [match('Match the name with its meaning.', [['Ar-Rahman', 'The Most Merciful'], ['Al-Khaliq', 'The Creator']])] });
units['L2.FW'] = rep('Prayer in Practice', 'Plan and practise your prayers.', ['Plan the five prayers in a day', 'Practise the full prayer'],
  L('Planning the five prayers', 'Fit prayer into your day.', ['Make a simple prayer plan'], [rich('Look at the prayer times for your city and plan your day around them.'), checklist('My plan', ['Find today\'s prayer times', 'Write them where you can see them'], true)], { rule: { type: 'blocks' } }),
  L('Practising the prayer with your teacher', 'Pray under guidance.', ['Complete one prayer with your teacher'], [rich('Your teacher will watch and guide you. This lesson is completed in class.'), tnote('Sample placeholder. Add the approved recitations for the academy.')]), null);
units['L2.IM'] = rep('Character in Action', 'Kindness and honesty in real situations.', ['Be kind at home', 'Be honest with friends'],
  L('Kindness at home', 'Small acts at home.', ['Do three kind acts'], [checklist('Kindness this week', ['Help with a chore', 'Say thank you', 'Share your time'], true)], { rule: { type: 'blocks' } }),
  L('Honesty with friends', 'Telling the truth kindly.', ['Explain how to be honest and kind'], [rich('Being honest does not mean being harsh. We can tell the truth gently.')]), null);

units['L3.QS'] = rep('Reciting with Confidence', 'Recite with attention to tajweed.', ['Recite a surah with confidence', 'Apply the tajweed you have learned'],
  L('Reviewing letter sounds', 'A careful review of pronunciation.', ['Pronounce the letters accurately'], [rich('Sample placeholder: the academy adds its own review of the letter sounds here.')]),
  L('Reciting independently', 'Recite without help.', ['Recite a short surah independently'], [verse(IKHLAS.join('  ۝  '), 'Surah Al-Ikhlas 112:1-4', '')]),
  { title: 'Independent recitation', pass: 70, questions: [audio('Record yourself reciting Surah Al-Ikhlas from memory.', ''), written('In your own words, name one tajweed rule you used and where.')] });
units['L3.SH'] = rep('Studying a Hadith', 'Explain a hadith in your own words.', ['Explain a hadith independently'],
  L('Choosing and understanding a hadith', 'Work through a hadith step by step.', ['Say what the hadith means'], [rich('Sample placeholder: the academy chooses a hadith and adds the text and approved explanation.')]),
  L('Explaining it to others', 'Share what you learned.', ['Explain the hadith to a classmate'], [checklist('Share it', ['Explain the hadith in your own words', 'Give one example from daily life'], true)], { rule: { type: 'blocks' } }), null);
units['L3.AQ'] = rep('Living the Pillars', 'Connect the pillars of Iman and Islam to life.', ['Name the five pillars of Islam', 'Connect belief to action'],
  L('The five pillars of Islam', 'The acts that support our faith.', ['Name the five pillars'], [rich('The five pillars of Islam are: the declaration of faith (shahadah), prayer (salah), charity (zakah), fasting in Ramadan (sawm) and pilgrimage to Makkah (hajj) for those who are able.')]),
  L('Belief and action together', 'How Iman shows in life.', ['Give an example for each pillar of Iman'], [rich('Each pillar of belief should show in how we live.')]),
  { title: 'Pillars of Islam check', pass: 70, questions: [multi('Which are pillars of Islam? Select all that apply.', ['Prayer (salah)', 'Charity (zakah)', 'Belief in the angels', 'Fasting in Ramadan'], [0, 1, 3], 'Belief in the angels is a pillar of Iman.')] });
units['L3.FW'] = rep('Worship with Understanding', 'Understand the meaning of what we do in worship.', ['Explain why we pray, give and fast'],
  L('Why we worship', 'The purpose of worship.', ['Explain the purpose of prayer'], [rich('Worship is how we remember Allah, thank Him and become better people.')]),
  L('Fasting and charity basics', 'A first look at sawm and zakah.', ['Name the month of fasting', 'Say what zakah is'], [rich('Muslims fast in the month of Ramadan. Zakah is a yearly charity given to those who are entitled to it.')]), null);
units['L3.IM'] = rep('Leading with Character', 'Be a good example for others.', ['Act as a role model'],
  L('Being a good example', 'Lead by doing.', ['Name three habits of a good example'], [rich('People learn most from what they see us do.')]),
  L('Helping others improve', 'Encourage kindly.', ['Encourage a classmate kindly'], [checklist('Try it', ['Encourage someone this week', 'Write what happened'], true)], { rule: { type: 'blocks' } }),
  { title: 'Character in action reflection', pass: 50, questions: [written('Describe a time you acted as a good example. What did you do?')] });

// A level assessment for Foundation shows level-wide checks
const levelAssess = { L1: { title: 'Foundation review', pass: 70, instructions: 'A short review of the whole Foundation level.', questions: [
  single('How many pillars of Iman are there?', ['Five', 'Six', 'Seven'], 1),
  tf('We say Bismillah before eating.', true),
  single('Which prayer has two fard rak\'ahs?', ['Fajr', 'Dhuhr', 'Maghrib'], 0)] } };

const achievements = [
  { code: 'first-lesson', title: 'First Step', description: 'Complete your first lesson.', icon: 'star', rule: { type: 'lessons_completed', n: 1 }, xp: 5 },
  { code: 'ten-lessons', title: 'Steady Learner', description: 'Complete ten lessons.', icon: 'book', rule: { type: 'lessons_completed', n: 10 }, xp: 25 },
  { code: 'first-unit', title: 'Unit Complete', description: 'Finish your first unit.', icon: 'flag', rule: { type: 'units_completed', n: 1 }, xp: 20 },
  { code: 'foundation', title: 'Foundation Complete', description: 'Finish the whole Foundation level.', icon: 'medal', rule: { type: 'levels_completed', n: 1 }, xp: 50 },
  { code: 'perfect', title: 'Perfect Score', description: 'Score 100 percent on an assessment.', icon: 'target', rule: { type: 'perfect_score' }, xp: 15 },
  { code: 'streak-3', title: 'Three Days in a Row', description: 'Learn on three days in a row.', icon: 'flame', rule: { type: 'streak_days', n: 3 }, xp: 15 },
  { code: 'journey', title: 'Journey Complete', description: 'Complete every level of the program.', icon: 'crown', rule: { type: 'program_completed' }, xp: 100 }
];

module.exports = { program, levels, domains, units, levelAssess, achievements, IKHLAS };
