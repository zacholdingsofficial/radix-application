import { useState, useEffect, useMemo, useRef } from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useMotionTemplate,
} from 'framer-motion';
import { ArrowRight, ArrowLeft, Lock, Loader2, Check, CornerDownLeft } from 'lucide-react';
import { supabase } from './supabase';
import { Link } from 'react-router-dom';

/* -------------------------------------------------------------------------- */
/*  Palette (kept as literal Tailwind classes below so JIT can see them)       */
/*  blue   #2330ff   chalk  #f2f2ee   ink  #0d0f2b   yellow #ffe14a            */
/* -------------------------------------------------------------------------- */

const ROLES = [
  'Graphic designers',
  'Videography / Video Editing',
  'UI / UX designers',
  'Web designers',
  'Automation and workflow developers',
  'Social Media Management',
  'Digital Marketing',
  'Technical',
  'Other',
];

// Roles shown in the landing page slideshow ("Other" is intentionally left out)
const MARQUEE_ROLES = ROLES.filter((r) => r !== 'Other');

const WORDS = ['Build.', 'Create.', 'Execute.'];

const PERKS = [
  { title: 'Side income', text: 'Earn while you learn.' },
  { title: 'Start-up incubation', text: 'Nurture ideas until they ship.' },
  { title: 'Placement cell', text: 'Career support when it counts.' },
  { title: 'Alumni connect', text: 'A network that stays with you.' },
];

const INITIAL = {
  email: '',
  fullName: '',
  classYear: '',
  phone: '',
  selectedRole: '',
  otherRole: '',
  crSoftware: '',
  crTeamwork: '',
  crPortfolio: '',
  crRemarks: '',
  smFamiliarity: '',
  smPlatforms: [] as string[],
  smStrategies: '',
  smRemarks: '',
  dmToolsScale: '',
  dmSkills: '',
  dmAnalyticScale: '',
  dmExperience: '',
  dmRemarks: '',
  techSkills: '',
  techTools: '',
  techReference: '',
  techRemarks: '',
};

type FormState = typeof INITIAL;

type QType = 'text' | 'email' | 'tel' | 'url' | 'long' | 'choice' | 'scale' | 'multi';

type Q = {
  key: keyof FormState;
  type: QType;
  label: string;
  short: string;
  hint?: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  scaleLabels?: [string, string];
};

const BASE_QUESTIONS: Q[] = [
  {
    key: 'email',
    type: 'email',
    label: "What's your email?",
    short: 'Email',
    hint: "Applied before? Use the same email and we'll bring your answers back.",
    placeholder: 'you@example.com',
    required: true,
  },
  {
    key: 'fullName',
    type: 'text',
    label: 'What should we call you?',
    short: 'Name',
    hint: 'Your full name.',
    placeholder: 'Full name',
    required: true,
  },
  {
    key: 'classYear',
    type: 'text',
    label: 'Which class are you in?',
    short: 'Class',
    hint: 'For example S1M1.',
    placeholder: 'S1M1',
    required: true,
  },
  {
    key: 'phone',
    type: 'tel',
    label: "What's the best number to reach you on?",
    short: 'Phone',
    placeholder: 'Phone number',
    required: true,
  },
  {
    key: 'selectedRole',
    type: 'choice',
    label: 'What do you want to work on?',
    short: 'Role',
    hint: 'Pick the one that fits you best.',
    options: ROLES,
    required: true,
  },
];

const ROLE_QUESTIONS: Record<string, Q[]> = {
  Creatives: [
    { key: 'crSoftware', type: 'long', label: 'Which software do you work with?', short: 'Software', placeholder: 'Photoshop, Premiere, Figma...', required: true },
    { key: 'crPortfolio', type: 'url', label: 'Show us your best work.', short: 'Portfolio', hint: 'Paste a link to your portfolio.', placeholder: 'https://', required: true },
    { key: 'crTeamwork', type: 'long', label: 'Tell us about a time you worked in a team.', short: 'Teamwork', placeholder: 'What was the project and what was your part?', required: false },
    { key: 'crRemarks', type: 'long', label: 'Anything else you want us to know?', short: 'Remarks', required: false },
  ],
  Marketing: [
    { key: 'smFamiliarity', type: 'choice', label: 'Have you built social media profiles before?', short: 'Built profiles', options: ['Yes', 'No'], required: true },
    { key: 'smPlatforms', type: 'multi', label: 'Which platforms do you know well?', short: 'Platforms', hint: 'Pick as many as you like.', options: ['Instagram', 'LinkedIn', 'Facebook', 'Youtube'], required: true },
    { key: 'smStrategies', type: 'long', label: 'What strategy or analytics work have you done?', short: 'Strategy and analytics', placeholder: 'Campaigns, reports, growth experiments...', required: false },
    { key: 'smRemarks', type: 'long', label: 'Anything else you want us to know?', short: 'Remarks', required: false },
  ],
  'Digital Marketing': [
    { key: 'dmToolsScale', type: 'scale', label: 'How comfortable are you with digital marketing tools?', short: 'Tools comfort', options: ['1', '2', '3', '4', '5'], scaleLabels: ['Just starting', 'Very comfortable'], required: true },
    { key: 'dmSkills', type: 'long', label: 'Which skills and tools do you know?', short: 'Skills and tools', placeholder: 'SEO, Google Ads, Meta Ads, email...', required: true },
    { key: 'dmAnalyticScale', type: 'scale', label: 'How strong are your analytical skills?', short: 'Analytical skills', options: ['1', '2', '3', '4', '5'], scaleLabels: ['Just starting', 'Very strong'], required: false },
    { key: 'dmExperience', type: 'long', label: 'What have you done before?', short: 'Experience', placeholder: 'Internships, freelance work, projects...', required: false },
    { key: 'dmRemarks', type: 'long', label: 'Anything else you want us to know?', short: 'Remarks', required: false },
  ],
  Technical: [
    { key: 'techSkills', type: 'long', label: 'What can you build?', short: 'Technical skills', hint: 'Languages, frameworks, automation, anything relevant.', required: true },
    { key: 'techTools', type: 'long', label: 'Which tools do you use day to day?', short: 'Tools', required: false },
    { key: 'techReference', type: 'url', label: 'Got something we can look at?', short: 'Reference', hint: 'GitHub, a live project or a demo.', placeholder: 'https://', required: false },
    { key: 'techRemarks', type: 'long', label: 'Anything else you want us to know?', short: 'Remarks', required: false },
  ],
};

const categoryOf = (role: string): string | null => {
  if (!role) return null;
  if (['Graphic designers', 'Videography / Video Editing', 'UI / UX designers', 'Web designers'].includes(role)) return 'Creatives';
  if (role === 'Social Media Management') return 'Marketing';
  if (role === 'Digital Marketing') return 'Digital Marketing';
  return 'Technical';
};

const validate = (q: Q, v: unknown): string => {
  if (q.type === 'multi') {
    return q.required && (v as string[]).length === 0 ? 'Pick at least one.' : '';
  }
  const s = String(v ?? '').trim();
  if (!s) {
    if (!q.required) return '';
    return q.type === 'choice' || q.type === 'scale' ? 'Choose one to continue.' : 'This one is required.';
  }
  if (q.type === 'email' && !/^\S+@\S+\.\S+$/.test(s)) return "That email doesn't look right.";
  if (q.type === 'tel' && s.replace(/\D/g, '').length < 7) return 'Enter a valid phone number.';
  if (q.type === 'url') {
    try {
      new URL(s);
    } catch {
      return 'Enter a full link starting with https://';
    }
  }
  return '';
};

/* -------------------------------------------------------------------------- */
/*  Sound: tiny synthesized UI sounds, no audio files. Quiet and low on purpose */
/* -------------------------------------------------------------------------- */

let audioCtx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;
const soundEnabled = true;

const ac = (): AudioContext | null => {
  if (!soundEnabled || typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
};

const env = (g: GainNode, t: number, peak: number, dur: number, attack = 0.006) => {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
};

const blip = (
  c: AudioContext,
  o: { freq: number; to?: number; dur: number; peak: number; type?: OscillatorType; delay?: number }
) => {
  const t = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  env(g, t, o.peak, o.dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t);
  osc.stop(t + o.dur + 0.05);
};

const swish = (
  c: AudioContext,
  o: { from: number; to: number; dur: number; peak: number; q?: number; delay?: number }
) => {
  if (!noiseBuf || noiseBuf.sampleRate !== c.sampleRate) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = c.currentTime + (o.delay ?? 0);
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = o.q ?? 1;
  f.frequency.setValueAtTime(o.from, t);
  f.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  const g = c.createGain();
  env(g, t, o.peak, o.dur, o.dur * 0.35);
  src.connect(f);
  f.connect(g);
  g.connect(c.destination);
  src.start(t);
  src.stop(t + o.dur + 0.05);
};

const sfx = {
  // a soft low tick for every character typed
  key: () => {
    const c = ac();
    if (!c) return;
    blip(c, { freq: 150 + Math.random() * 30, to: 90, dur: 0.05, peak: 0.035, type: 'triangle' });
    swish(c, { from: 1400, to: 900, dur: 0.02, peak: 0.02, q: 0.8 });
  },
  // choosing an option
  select: () => {
    const c = ac();
    if (!c) return;
    blip(c, { freq: 200, to: 300, dur: 0.09, peak: 0.04 });
  },
  // moving to the next step: a low mechanical slide
  slide: () => {
    const c = ac();
    if (!c) return;
    swish(c, { from: 280, to: 800, dur: 0.28, peak: 0.05, q: 1.4 });
    blip(c, { freq: 110, to: 70, dur: 0.22, peak: 0.05, type: 'triangle' });
  },
  // moving back: the same slide in reverse
  back: () => {
    const c = ac();
    if (!c) return;
    swish(c, { from: 800, to: 280, dur: 0.24, peak: 0.045, q: 1.4 });
    blip(c, { freq: 70, to: 105, dur: 0.2, peak: 0.045, type: 'triangle' });
  },
  // opening the application
  open: () => {
    const c = ac();
    if (!c) return;
    swish(c, { from: 150, to: 1200, dur: 0.6, peak: 0.06, q: 1.1 });
    blip(c, { freq: 70, to: 45, dur: 0.5, peak: 0.07, type: 'triangle' });
  },
  // something needs attention
  error: () => {
    const c = ac();
    if (!c) return;
    blip(c, { freq: 95, to: 70, dur: 0.16, peak: 0.06, type: 'triangle' });
    blip(c, { freq: 95, to: 70, dur: 0.16, peak: 0.05, type: 'triangle', delay: 0.1 });
  },
  // application sent
  success: () => {
    const c = ac();
    if (!c) return;
    [196, 247, 294].forEach((f, i) => blip(c, { freq: f, dur: 0.7, peak: 0.035, delay: i * 0.09 }));
    blip(c, { freq: 98, dur: 0.9, peak: 0.05 });
  },
};

const questionsFor = (f: FormState): Q[] => {
  const c = categoryOf(f.selectedRole);
  return [...BASE_QUESTIONS, ...(c ? ROLE_QUESTIONS[c] : [])];
};

// Index of the first question that still needs an answer, or -1 when all is complete
const firstIncomplete = (f: FormState): number => {
  const list = questionsFor(f);
  for (let i = 0; i < list.length; i++) {
    const q = list[i];
    if (validate(q, f[q.key])) return i;
    if (q.key === 'selectedRole' && f.selectedRole === 'Other' && !f.otherRole.trim()) return i;
  }
  return -1;
};

// A comparable fingerprint of the answers, used to tell whether anything changed
const snapshot = (f: FormState): string => {
  const out: Record<string, unknown> = {};
  (Object.keys(f) as (keyof FormState)[]).sort().forEach((k) => {
    const v = f[k];
    out[k] = Array.isArray(v) ? [...v].sort() : String(v).trim();
  });
  if (f.selectedRole !== 'Other') out.otherRole = '';
  return JSON.stringify(out);
};

const slide = {
  initial: (d: number) => ({ opacity: 0, y: d * 50 }),
  animate: { opacity: 1, y: 0 },
  exit: (d: number) => ({ opacity: 0, y: d * -50 }),
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@500;700;800&family=Hanken+Grotesk:wght@400;500;600&display=swap');
.f-display { font-family: 'Syne', system-ui, sans-serif; }
.f-body, .f-body * { font-family: 'Hanken Grotesk', system-ui, sans-serif; }
.f-body .f-display { font-family: 'Syne', system-ui, sans-serif; }
@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.marquee-track { animation: marquee 40s linear infinite; }
.f-body button:focus-visible, .f-body a:focus-visible { outline: 3px solid currentColor; outline-offset: 3px; }
.f-body ::selection { background: #ffe14a; color: #0d0f2b; }
@media (prefers-reduced-motion: reduce) { .marquee-track { animation: none; } }
`;

/* -------------------------------------------------------------------------- */
/*  Small building blocks                                                      */
/* -------------------------------------------------------------------------- */

function Overlay({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <motion.div
      className={`fixed inset-0 z-50 overflow-y-auto ${className}`}
      initial={{ clipPath: 'circle(0% at 50% 88%)' }}
      animate={{ clipPath: 'circle(150% at 50% 88%)' }}
      exit={{ clipPath: 'circle(0% at 50% 88%)' }}
      transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Ticket({ data }: { data: FormState }) {
  const blank = <span className="inline-block w-28 border-b-2 border-dashed border-[#0d0f2b]/25 align-middle" />;
  return (
    <motion.div
      initial={{ rotate: -2, y: 30, opacity: 0 }}
      animate={{ rotate: -2, y: 0, opacity: 1 }}
      whileHover={{ rotate: 0 }}
      transition={{ type: 'spring', stiffness: 160, damping: 16 }}
      className="relative w-full max-w-sm lg:max-w-[320px] bg-[#ffe14a] text-[#0d0f2b] rounded-3xl p-5 lg:p-7"
    >
      <div className="flex items-baseline justify-between">
        <span className="flex items-center gap-0 f-display font-extrabold text-2xl leading-none">
          <img src="/logo.png" alt="" className="h-8 w-auto object-contain translate-y-[1px]" />
          Radix
        </span>
        <span className="text-sm font-medium opacity-70">Team call</span>
      </div>

      <div className="relative my-4 lg:my-6">
        <div className="border-t-2 border-dashed border-[#0d0f2b]/25" />
        <span className="absolute -left-8 lg:-left-10 -top-3 w-6 h-6 rounded-full bg-[#f2f2ee]" />
        <span className="absolute -right-8 lg:-right-10 -top-3 w-6 h-6 rounded-full bg-[#f2f2ee]" />
      </div>

      <p className="text-sm font-medium opacity-60 mb-1">Name</p>
      <p className="f-display font-bold text-xl lg:text-2xl leading-tight break-words min-h-[2rem] lg:min-h-[2.5rem]">
        {data.fullName.trim() || blank}
      </p>

      <div className="mt-4 lg:mt-6 space-y-2 lg:space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <span className="opacity-60">Class</span>
          <span className="font-semibold text-right">{data.classYear.trim() || blank}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="opacity-60">Email</span>
          <span className="font-semibold text-right break-all">{data.email.trim() || blank}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="opacity-60">Phone</span>
          <span className="font-semibold text-right">{data.phone.trim() || blank}</span>
        </div>
      </div>

      <div className="mt-5 lg:mt-7 min-h-[2.5rem]">
        <AnimatePresence mode="wait">
          {data.selectedRole ? (
            <motion.span
              key={data.selectedRole}
              initial={{ scale: 1.6, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: -3 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              className="inline-block bg-[#2330ff] text-[#f2f2ee] font-semibold px-4 py-2 rounded-full text-sm"
            >
              {data.selectedRole === 'Other' && data.otherRole.trim()
                ? `Other: ${data.otherRole.trim()}`
                : data.selectedRole}
            </motion.span>
          ) : (
            <motion.span key="none" className="text-sm opacity-50">
              Role not chosen yet
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/*  App                                                                        */
/* -------------------------------------------------------------------------- */

export default function App() {
  const [view, setView] = useState<'landing' | 'flow' | 'done'>('landing');
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const [formData, setFormData] = useState<FormState>(INITIAL);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [original, setOriginal] = useState<string | null>(null);
  const [returnToReview, setReturnToReview] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);
  const [siteConfig, setSiteConfig] = useState<{ is_active: boolean; landing_text: string } | null>(null);

  const lock = useRef(false);


  // Cursor light on the landing hero
  const mx = useMotionValue(-600);
  const my = useMotionValue(-600);
  const spot = useMotionTemplate`radial-gradient(460px circle at ${mx}px ${my}px, rgba(35,48,255,0.09), transparent 70%)`;

  const category = categoryOf(formData.selectedRole);
  const isOther = formData.selectedRole === 'Other';
  const questions = useMemo<Q[]>(
    () => [...BASE_QUESTIONS, ...(category ? ROLE_QUESTIONS[category] : [])],
    [category]
  );
  const onReview = idx >= questions.length;
  const total = questions.length + (category ? 0 : 4) + 1;
  const progress = Math.min(1, idx / (total - 1));
  const hasChanges = !existingId || original === null || snapshot(formData) !== original;

  /* ---- data ---- */

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase.from('site_content').select('*').eq('id', 1).single();
      if (data) setSiteConfig(data);
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    if (view !== 'landing') return;
    const t = setInterval(() => setWordIndex((p) => (p + 1) % WORDS.length), 1800);
    return () => clearInterval(t);
  }, [view]);

  useEffect(() => {
    document.body.style.overflow = view === 'landing' ? '' : 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [view]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const checkExistingEmail = async () => {
    const email = formData.email.trim();
    if (!email.includes('@')) return;
    const { data } = await supabase.from('applications').select('*').eq('email', email).maybeSingle();
    if (data) {
      setExistingId(data.id);
      const rawRole: string = data.selected_role || '';
      const savedOther = rawRole.startsWith('Other: ');
      const loaded: FormState = {
        email: data.email || '',
        fullName: data.full_name || '',
        classYear: data.class_year || '',
        phone: data.phone || '',
        selectedRole: savedOther ? 'Other' : rawRole,
        otherRole: savedOther ? rawRole.slice(7) : '',
        crSoftware: data.cr_software || '',
        crTeamwork: data.cr_teamwork || '',
        crPortfolio: data.cr_portfolio || '',
        crRemarks: data.cr_remarks || '',
        smFamiliarity: data.sm_familiarity || '',
        smPlatforms: data.sm_platforms || [],
        smStrategies: data.sm_strategies || '',
        smRemarks: data.sm_remarks || '',
        dmToolsScale: data.dm_tools_scale ? String(data.dm_tools_scale) : '',
        dmSkills: data.dm_skills || '',
        dmAnalyticScale: data.dm_analytic_scale ? String(data.dm_analytic_scale) : '',
        dmExperience: data.dm_experience || '',
        dmRemarks: data.dm_remarks || '',
        techSkills: data.tech_skills || '',
        techTools: data.tech_tools || '',
        techReference: data.tech_reference || '',
        techRemarks: data.tech_remarks || '',
      };
      setFormData(loaded);
      setOriginal(snapshot(loaded));
      setNotice('Welcome back. We loaded your earlier answers, so you can edit and send them again.');
    } else {
      setExistingId(null);
      setOriginal(null);
      setNotice('');
    }
  };

  /* ---- navigation ---- */

  const go = (to: number, d: number) => {
    if (d > 0) sfx.slide();
    else sfx.back();
    setError('');
    setDir(d);
    setIdx(to);
  };

  // After editing one answer from the review screen: go straight back to review,
  // unless the edit opened questions that still need answers (a changed role).
  const afterEdit = (f: FormState) => {
    const t = firstIncomplete(f);
    if (t === -1) {
      setReturnToReview(false);
      go(questionsFor(f).length, 1);
    } else {
      go(t, 1);
    }
  };

  const advance = async () => {
    if (busy || submitting || onReview) return;
    const q = questions[idx];
    let err = validate(q, formData[q.key]);
    if (!err && q.key === 'selectedRole' && isOther && !formData.otherRole.trim()) {
      err = 'Tell us which role you would prefer.';
    }
    if (err) {
      sfx.error();
      setError(err);
      return;
    }
    if (returnToReview) {
      afterEdit(formData);
      return;
    }
    if (q.key === 'email') {
      setBusy(true);
      await checkExistingEmail();
      setBusy(false);
    }
    go(idx + 1, 1);
  };

  const back = () => {
    if (idx === 0) {
      setView('landing');
      return;
    }
    go(idx - 1, -1);
  };

  const skip = () => {
    const cur = questions[idx];
    const emptied = { ...formData, [cur.key]: cur.type === 'multi' ? [] : '' } as FormState;
    setFormData(emptied);
    if (returnToReview) {
      afterEdit(emptied);
      return;
    }
    go(idx + 1, 1);
  };

  const pick = (q: Q, option: string) => {
    sfx.select();
    if (q.type === 'multi') {
      const list = formData.smPlatforms;
      update('smPlatforms', list.includes(option) ? list.filter((p) => p !== option) : [...list, option]);
      setError('');
      return;
    }
    if (lock.current) return;
    update(q.key, option as never);
    setError('');
    // "Other" opens its own input right here instead of moving on
    if (q.key === 'selectedRole' && option === 'Other') return;
    const next = { ...formData, [q.key]: option } as FormState;
    lock.current = true;
    setTimeout(() => {
      if (returnToReview) {
        afterEdit(next);
      } else {
        sfx.slide();
        setDir(1);
        setIdx((i) => i + 1);
      }
      lock.current = false;
    }, 320);
  };

  // Keyboard: Enter moves on, letters and numbers pick options
  useEffect(() => {
    if (view !== 'flow') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA';
      if (e.key === 'Enter') {
        if (e.shiftKey && t.tagName === 'TEXTAREA') return;
        if (onReview || t.tagName === 'BUTTON') return;
        e.preventDefault();
        advance();
        return;
      }
      const q = questions[idx];
      if (typing || !q || !q.options) return;
      const k = e.key.toLowerCase();
      const n = q.type === 'scale' ? parseInt(k, 10) - 1 : k.length === 1 ? k.charCodeAt(0) - 97 : -1;
      if (n >= 0 && n < q.options.length) {
        e.preventDefault();
        pick(q, q.options[n]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* ---- submit ---- */

  const submitForm = async () => {
    if (!hasChanges) return;
    setSubmitting(true);
    const payload = {
      email: formData.email,
      full_name: formData.fullName,
      class_year: formData.classYear,
      phone: formData.phone,
      selected_role:
        formData.selectedRole === 'Other' && formData.otherRole.trim()
          ? `Other: ${formData.otherRole.trim()}`
          : formData.selectedRole,
      cr_software: formData.crSoftware,
      cr_teamwork: formData.crTeamwork,
      cr_portfolio: formData.crPortfolio,
      cr_remarks: formData.crRemarks,
      sm_familiarity: formData.smFamiliarity,
      sm_platforms: formData.smPlatforms,
      sm_strategies: formData.smStrategies,
      sm_remarks: formData.smRemarks,
      dm_tools_scale: formData.dmToolsScale ? parseInt(formData.dmToolsScale) : null,
      dm_skills: formData.dmSkills,
      dm_analytic_scale: formData.dmAnalyticScale ? parseInt(formData.dmAnalyticScale) : null,
      dm_experience: formData.dmExperience,
      dm_remarks: formData.dmRemarks,
      tech_skills: formData.techSkills,
      tech_tools: formData.techTools,
      tech_reference: formData.techReference,
      tech_remarks: formData.techRemarks,
    };

    const res = existingId
      ? await supabase.from('applications').update(payload).eq('id', existingId)
      : await supabase.from('applications').insert([payload]);

    if (!res.error) {
      setUpdated(!!existingId);
      sfx.success();
      setView('done');
    } else {
      console.error(res.error);
      sfx.error();
      setError("We couldn't send your application. Check your email address and try again.");
    }
    setSubmitting(false);
  };

  const restart = () => {
    setFormData(INITIAL);
    setExistingId(null);
    setOriginal(null);
    setReturnToReview(false);
    setNotice('');
    setError('');
    setIdx(0);
    setView('landing');
  };

  const displayValue = (q: Q) => {
    if (q.key === 'selectedRole' && formData.selectedRole === 'Other' && formData.otherRole.trim()) {
      return `Other: ${formData.otherRole.trim()}`;
    }
    const v = formData[q.key];
    if (Array.isArray(v)) return v.join(', ');
    return String(v ?? '').trim();
  };

  /* ---- loading ---- */

  if (!siteConfig) {
    return (
      <div className="min-h-screen bg-[#2330ff] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#f2f2ee]" />
      </div>
    );
  }

  const open = siteConfig.is_active;

  const renderStart = (onLight: boolean) =>
    open ? (
    <button
      onClick={() => {
        sfx.open();
        setReturnToReview(false);
        setIdx(0);
        setView('flow');
      }}
      className={`group flex w-full md:inline-flex whitespace-nowrap shrink-0 md:w-auto items-center justify-between md:justify-start gap-4 ${onLight ? 'bg-[#0d0f2b] text-[#f2f2ee]' : 'bg-[#ffe14a] text-[#0d0f2b]'} font-bold text-lg rounded-full pl-8 pr-3 py-3 md:hover:gap-6 transition-all`}
    >
      Start application
      <span
        className={`ml-auto md:ml-0 w-12 h-12 shrink-0 rounded-full flex items-center justify-center ${
          onLight ? 'bg-[#ffe14a] text-[#0d0f2b]' : 'bg-[#0d0f2b] text-[#ffe14a]'
        }`}
      >
        <ArrowRight className="w-5 h-5 transition-transform group-active:translate-x-1" />
      </span>
    </button>
  ) : (
    <div className="inline-block border-2 border-current rounded-full px-8 py-4 font-semibold opacity-70">
      Applications are paused for now
    </div>
  );

  const startBtn = renderStart(false);
  const startBtnLight = renderStart(true);

  const q = questions[idx];

  return (
    <div className="f-body">
      <style>{CSS}</style>

      {/* ============================ LANDING ============================ */}
      <section
        className="relative min-h-[100dvh] md:h-[100dvh] md:min-h-[640px] bg-white text-[#0d0f2b] flex flex-col overflow-hidden"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          mx.set(e.clientX - r.left);
          my.set(e.clientY - r.top);
        }}
      >
        <motion.div className="absolute inset-0 pointer-events-none" style={{ background: spot }} />

        <header className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5">
          <span className="flex items-center gap-0 f-display font-extrabold text-3xl leading-none tracking-tight">
            <img src="/logo.png" alt="" className="h-9 w-auto object-contain translate-y-[2px]" />
            Radix
          </span>
          <div className="flex items-center gap-6">
            <span className="hidden sm:flex items-center gap-2 text-sm font-medium">
              <span className={`w-2.5 h-2.5 rounded-full ${open ? 'bg-[#2330ff]' : 'bg-[#0d0f2b]/30'}`} />
              {open ? 'Applications open' : 'Applications paused'}
            </span>
            <Link to="/admin" aria-label="Admin" className="p-2 opacity-60 hover:opacity-100 transition-opacity">
              <Lock className="w-5 h-5" strokeWidth={1.75} />
            </Link>
          </div>
        </header>

        <div className="relative z-10 flex-1 min-h-0 flex flex-col justify-center px-6 md:px-12 py-8 md:py-4">
          <div className="select-none" aria-label="Build. Create. Execute.">
            {WORDS.map((w, i) => {
              const active = i === wordIndex;
              return (
                <div
                  key={w}
                  aria-hidden
                  className={`f-display font-extrabold leading-[1.08] md:leading-[0.92] tracking-tight text-[clamp(2.5rem,12.5vw,6rem)] md:text-[clamp(2rem,min(8.5vw,16vh),12rem)] transition-all duration-700 ease-out ${
                    active
                      ? 'text-[#ffe14a] [-webkit-text-stroke:2px_#0d0f2b] md:translate-x-8'
                      : 'text-transparent [-webkit-text-stroke:2px_#0d0f2b]'
                  }`}
                >
                  {w}
                </div>
              );
            })}
          </div>

          <div className="mt-12 md:mt-10 flex flex-col md:flex-row md:items-end justify-between gap-8 md:gap-10">
            <p className="max-w-xl text-base md:text-lg leading-relaxed text-[#0d0f2b]/75">
              {siteConfig.landing_text}
            </p>
            <div>{startBtnLight}</div>
          </div>
        </div>

        {/* Roles band */}
        <div className="relative z-10 bg-[#ffe14a] text-[#0d0f2b] overflow-hidden py-4">
          <div className="marquee-track flex w-max">
            {[...MARQUEE_ROLES, ...MARQUEE_ROLES].map((r, i) => (
              <span key={i} className="f-display font-bold text-lg flex items-center whitespace-nowrap">
                <span className="px-8">{r}</span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#0d0f2b]" />
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f2f2ee] text-[#0d0f2b] px-6 md:px-12 py-24">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-[1fr_1.4fr] gap-16">
          <div className="lg:sticky lg:top-24 self-start">
            <h2 className="f-display font-extrabold text-[clamp(2.5rem,6vw,5rem)] leading-[0.95] tracking-tight">
              We need builders, creators and operators.
            </h2>
            <p className="mt-8 text-lg max-w-md leading-relaxed text-[#0d0f2b]/70">
              We're recruiting for our next phase. If you care about precision and getting things done, there is a
              place for you here.
            </p>
          </div>

          <ul>
            {PERKS.map((p, i) => (
              <li
                key={p.title}
                className={`group border-t-2 border-[#0d0f2b] py-9 px-4 -mx-4 flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 hover:bg-[#2330ff] hover:text-[#f2f2ee] transition-colors duration-300 ${
                  i === PERKS.length - 1 ? 'border-b-2' : ''
                }`}
              >
                <span className="f-display font-bold text-3xl md:text-5xl tracking-tight">{p.title}</span>
                <span className="text-base md:text-lg opacity-70 sm:text-right sm:max-w-[15rem]">{p.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-[#0d0f2b] text-[#f2f2ee] px-6 md:px-12 py-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-10">
          <h2 className="f-display font-extrabold text-[clamp(2rem,4vw,3.5rem)] leading-none tracking-tight">
            Ready when you are.
          </h2>
          {startBtn}
        </div>
      </section>

      <footer className="bg-[#0d0f2b] text-[#f2f2ee] border-t border-[#f2f2ee]/15 px-6 md:px-12 py-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-2 text-sm">
          <span className="opacity-70">&copy; 2026 Radix. All rights reserved.</span>
          <span className="opacity-30" aria-hidden>|</span>
          <a
            href="https://wa.me/917558957246"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Message us on WhatsApp"
            title="Message us on WhatsApp"
            className="f-display font-extrabold text-lg leading-none text-[#ffe14a] hover:underline underline-offset-4 transition-all"
          >
            R.
          </a>
        </div>
      </footer>

      {/* =============================== FLOW ============================== */}
      <AnimatePresence>
        {view === 'flow' && (
          <Overlay key="flow" className="bg-[#f2f2ee] text-[#0d0f2b]">
            <div className="min-h-[100dvh] flex flex-col">
              <div className="h-1.5 bg-[#0d0f2b]/10">
                <motion.div
                  className="h-full bg-[#2330ff]"
                  animate={{ width: `${Math.max(progress, 0.02) * 100}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>

              <header className="flex items-center justify-between px-6 md:px-12 py-5">
                <button
                  onClick={() => setView('landing')}
                  className="flex items-center gap-0 f-display font-extrabold text-2xl leading-none tracking-tight"
                >
                  <img src="/logo.png" alt="" className="h-8 w-auto object-contain translate-y-[1px]" />
                  Radix
                </button>
                <div className="flex items-center gap-5">
                  <span className="text-sm font-medium opacity-60">
                    {onReview ? 'Last look' : `${idx + 1} of ${total}`}
                  </span>
                        <Link to="/admin" aria-label="Admin" className="p-2 opacity-40 hover:opacity-100 transition-opacity">
                    <Lock className="w-5 h-5" strokeWidth={1.75} />
                  </Link>
                </div>
              </header>

              <main className="flex-1 grid lg:grid-cols-[minmax(0,1fr)_320px] gap-8 lg:gap-16 items-center px-6 md:px-12 pb-12 max-w-7xl w-full mx-auto">
                <div className="min-h-[46vh] lg:min-h-[60vh] flex flex-col justify-center">
                  <AnimatePresence mode="wait" custom={dir}>
                    <motion.div
                      key={idx}
                      custom={dir}
                      variants={slide}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                    >
                      {!onReview && q && (
                        <div>
                          {notice && idx <= 1 && (
                            <div className="mb-8 bg-[#2330ff] text-[#f2f2ee] rounded-2xl px-4 py-3 text-sm font-medium max-w-xl">
                              {notice}
                            </div>
                          )}

                          {!q.required && (
                            <span className="inline-block mb-3 rounded-full bg-[#0d0f2b]/10 px-3 py-1 text-xs font-semibold">
                              Optional
                            </span>
                          )}
                          <h2 className="f-display font-bold text-[clamp(1.25rem,2.4vw,1.875rem)] leading-snug tracking-tight max-w-2xl">
                            {q.label}
                          </h2>
                          {q.hint && <p className="mt-2 text-sm opacity-60 max-w-xl">{q.hint}</p>}

                          <div className="mt-8">
                            {(q.type === 'text' || q.type === 'email' || q.type === 'tel' || q.type === 'url') && (
                              <div className="relative">
                                <input
                                  autoFocus
                                  type={q.type}
                                  value={String(formData[q.key])}
                                  onChange={(e) => {
                                    update(q.key, e.target.value as never);
                                    sfx.key();
                                    setError('');
                                  }}
                                  placeholder={q.placeholder}
                                  autoComplete="off"
                                  className="f-display w-full bg-transparent border-0 border-b-2 border-[#0d0f2b]/15 focus:border-[#2330ff] outline-none py-3 font-bold text-[clamp(1.25rem,2.8vw,2rem)] tracking-tight placeholder:text-[#0d0f2b]/20 transition-colors"
                                />
                                {busy && <Loader2 className="absolute right-0 bottom-5 w-6 h-6 animate-spin opacity-50" />}
                              </div>
                            )}

                            {q.type === 'long' && (
                              <textarea
                                autoFocus
                                rows={3}
                                value={String(formData[q.key])}
                                onChange={(e) => {
                                  update(q.key, e.target.value as never);
                                  sfx.key();
                                  setError('');
                                }}
                                placeholder={q.placeholder}
                                className="f-display w-full bg-transparent border-0 border-b-2 border-[#0d0f2b]/15 focus:border-[#2330ff] outline-none py-3 font-bold text-[clamp(1.1rem,2vw,1.5rem)] leading-snug tracking-tight placeholder:text-[#0d0f2b]/20 resize-none transition-colors"
                              />
                            )}

                            {(q.type === 'choice' || q.type === 'multi') && q.options && (
                              <div
                                className={`grid gap-3 ${
                                  q.options.length > 4 ? 'md:grid-cols-2' : 'sm:grid-cols-2 max-w-2xl'
                                }`}
                              >
                                {q.options.map((o, i) => {
                                  const selected =
                                    q.type === 'multi' ? formData.smPlatforms.includes(o) : formData[q.key] === o;
                                  return (
                                    <button
                                      key={o}
                                      type="button"
                                      onClick={() => pick(q, o)}
                                      className={`flex items-center gap-4 text-left border-2 rounded-2xl px-3.5 py-3 transition-all duration-200 ${
                                        selected
                                          ? 'bg-[#2330ff] border-[#2330ff] text-[#f2f2ee] scale-[1.02]'
                                          : 'border-[#0d0f2b]/20 hover:border-[#0d0f2b] hover:-translate-y-0.5'
                                      }`}
                                    >
                                      <span
                                        className={`w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center text-xs font-semibold ${
                                          selected ? 'border-[#f2f2ee]/60' : 'border-[#0d0f2b]/25'
                                        }`}
                                      >
                                        {selected ? <Check className="w-4 h-4" strokeWidth={3} /> : String.fromCharCode(65 + i)}
                                      </span>
                                      <span className="f-display font-bold text-sm md:text-base leading-tight">{o}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {q.key === 'selectedRole' && (
                              <AnimatePresence initial={false}>
                                {isOther && (
                                  <motion.div
                                    key="other-role"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                                    className="overflow-hidden"
                                  >
                                    <div className="pt-6 max-w-xl">
                                      <label htmlFor="other-role" className="text-sm font-medium opacity-70">
                                        Which role would you prefer?
                                      </label>
                                      <input
                                        id="other-role"
                                        autoFocus
                                        type="text"
                                        value={formData.otherRole}
                                        onChange={(e) => {
                                          update('otherRole', e.target.value);
                                          sfx.key();
                                          setError('');
                                        }}
                                        placeholder="e.g. Copywriter, Photographer, Data analyst"
                                        autoComplete="off"
                                        className="f-display w-full bg-transparent border-0 border-b-2 border-[#0d0f2b]/15 focus:border-[#2330ff] outline-none py-2 font-bold text-[clamp(1.1rem,2.2vw,1.5rem)] tracking-tight placeholder:text-[#0d0f2b]/20 transition-colors"
                                      />
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            )}

                            {q.type === 'scale' && q.options && (
                              <div>
                                <div className="flex gap-3 flex-wrap">
                                  {q.options.map((o) => {
                                    const selected = formData[q.key] === o;
                                    return (
                                      <button
                                        key={o}
                                        type="button"
                                        onClick={() => pick(q, o)}
                                        className={`f-display w-12 h-12 md:w-14 md:h-14 rounded-xl border-2 font-extrabold text-lg transition-all duration-200 ${
                                          selected
                                            ? 'bg-[#2330ff] border-[#2330ff] text-[#f2f2ee] scale-110'
                                            : 'border-[#0d0f2b]/20 hover:border-[#0d0f2b] hover:-translate-y-1'
                                        }`}
                                      >
                                        {o}
                                      </button>
                                    );
                                  })}
                                </div>
                                {q.scaleLabels && (
                                  <div className="mt-4 flex justify-between max-w-md text-sm font-medium opacity-60">
                                    <span>{q.scaleLabels[0]}</span>
                                    <span>{q.scaleLabels[1]}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {error && <p className="mt-5 font-semibold text-[#2330ff]">{error}</p>}

                          <div className="mt-12 flex items-center gap-6">
                            {returnToReview ? (
                              <button
                                type="button"
                                onClick={advance}
                                className="flex items-center gap-2 font-semibold underline underline-offset-4 opacity-80 hover:opacity-100 transition-opacity"
                              >
                                <ArrowLeft className="w-4 h-4" /> Back to review
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={back}
                                className="flex items-center gap-2 font-semibold opacity-60 hover:opacity-100 transition-opacity"
                              >
                                <ArrowLeft className="w-4 h-4" /> Back
                              </button>
                            )}

                            {((q.type !== 'choice' && q.type !== 'scale') || (q.key === 'selectedRole' && isOther)) && (
                              <>
                                <button
                                  type="button"
                                  onClick={advance}
                                  disabled={busy}
                                  className="bg-[#0d0f2b] text-[#f2f2ee] rounded-full px-7 py-3 font-bold text-sm hover:bg-[#2330ff] transition-colors disabled:opacity-50"
                                >
                                  {returnToReview && firstIncomplete(formData) === -1 ? 'Save change' : 'Continue'}
                                </button>
                                <span className="hidden md:flex items-center gap-2 text-sm opacity-50">
                                  or press Enter <CornerDownLeft className="w-4 h-4" />
                                </span>
                              </>
                            )}

                            {!q.required && (
                              <button
                                type="button"
                                onClick={skip}
                                className="text-sm font-semibold underline underline-offset-4 opacity-70 hover:opacity-100 transition-opacity"
                              >
                                Skip this one
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {onReview && (
                        <div>
                          <h2 className="f-display font-extrabold text-[clamp(1.75rem,3.4vw,2.5rem)] leading-none tracking-tight">
                            Check it over.
                          </h2>
                          <p className="mt-4 text-base opacity-60">
                            Tap any answer to change it. Nothing is sent until you confirm.
                          </p>

                          <ul className="mt-10 border-t-2 border-[#0d0f2b]">
                            {questions.map((item, i) => {
                              const v = displayValue(item);
                              return (
                                <li key={item.key}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReturnToReview(true);
                                      go(i, -1);
                                    }}
                                    className="w-full text-left grid sm:grid-cols-[180px_1fr] gap-1 sm:gap-6 py-4 border-b border-[#0d0f2b]/15 hover:bg-[#2330ff]/5 transition-colors px-2 -mx-2"
                                  >
                                    <span className="text-sm font-medium opacity-60 pt-1">{item.short}</span>
                                    <span className={`f-display font-bold text-base md:text-lg break-words ${v ? '' : 'opacity-30'}`}>
                                      {v || 'Skipped'}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>

                          {error && <p className="mt-6 font-semibold text-[#2330ff]">{error}</p>}

                          <div className="mt-10 flex flex-wrap items-center gap-6">
                            <button
                              type="button"
                              onClick={back}
                              className="flex items-center gap-2 font-semibold opacity-60 hover:opacity-100 transition-opacity"
                            >
                              <ArrowLeft className="w-4 h-4" /> Back
                            </button>
                            <button
                              type="button"
                              onClick={submitForm}
                              disabled={submitting || !hasChanges}
                              className="inline-flex items-center gap-3 bg-[#2330ff] text-[#f2f2ee] rounded-full px-8 py-4 font-bold text-base hover:bg-[#0d0f2b] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#2330ff]"
                            >
                              {submitting ? 'Sending...' : existingId ? 'Update my application' : 'Send my application'}
                              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="flex justify-center lg:justify-end">
                  <Ticket data={formData} />
                </div>
              </main>
            </div>
          </Overlay>
        )}

        {/* ============================== DONE ============================== */}
        {view === 'done' && (
          <Overlay key="done" className="bg-[#2330ff] text-[#f2f2ee]">
            <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center">
              <motion.svg
                width="140"
                height="140"
                viewBox="0 0 140 140"
                fill="none"
                initial="hidden"
                animate="visible"
              >
                <motion.circle
                  cx="70"
                  cy="70"
                  r="64"
                  fill="#ffe14a"
                  variants={{ hidden: { scale: 0 }, visible: { scale: 1 } }}
                  transition={{ delay: 0.5, type: 'spring', stiffness: 200, damping: 14 }}
                  style={{ transformOrigin: '70px 70px' }}
                />
                <motion.path
                  d="M42 72 L62 92 L100 50"
                  stroke="#0d0f2b"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  variants={{ hidden: { pathLength: 0 }, visible: { pathLength: 1 } }}
                  transition={{ delay: 0.9, duration: 0.5 }}
                />
              </motion.svg>

              <motion.h2
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1, duration: 0.6 }}
                className="f-display font-extrabold text-[clamp(2rem,5.5vw,4rem)] leading-[0.95] tracking-tight mt-10"
              >
                {updated ? 'Application updated.' : 'Application received.'}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.4 }}
                className="mt-6 max-w-md text-lg text-[#f2f2ee]/85 leading-relaxed"
              >
                We'll review your profile and get in touch if it fits our next phase.
              </motion.p>
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.7 }}
                onClick={restart}
                className="mt-12 border-2 border-[#f2f2ee] rounded-full px-8 py-4 font-bold hover:bg-[#f2f2ee] hover:text-[#2330ff] transition-colors"
              >
                Back to start
              </motion.button>
            </div>
          </Overlay>
        )}
      </AnimatePresence>
    </div>
  );
}