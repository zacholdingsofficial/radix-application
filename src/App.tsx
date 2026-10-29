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

const OTHER_QUESTION: Q = {
  key: 'otherRole',
  type: 'text',
  label: 'Which role would you prefer?',
  short: 'Preferred role',
  hint: 'Tell us what you would like to do with the team.',
  placeholder: 'e.g. Copywriter, Photographer, Data analyst',
  required: true,
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
      className="relative w-full max-w-[320px] bg-[#ffe14a] text-[#0d0f2b] rounded-3xl p-7 hidden lg:block"
    >
      <div className="flex items-baseline justify-between">
        <span className="f-display font-extrabold text-2xl">Radix</span>
        <span className="text-sm font-medium opacity-70">Team call</span>
      </div>

      <div className="relative my-6">
        <div className="border-t-2 border-dashed border-[#0d0f2b]/25" />
        <span className="absolute -left-10 -top-3 w-6 h-6 rounded-full bg-[#f2f2ee]" />
        <span className="absolute -right-10 -top-3 w-6 h-6 rounded-full bg-[#f2f2ee]" />
      </div>

      <p className="text-sm font-medium opacity-60 mb-1">Name</p>
      <p className="f-display font-bold text-2xl leading-tight break-words min-h-[2.5rem]">
        {data.fullName.trim() || blank}
      </p>

      <div className="mt-6 space-y-3 text-sm">
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

      <div className="mt-7 min-h-[2.5rem]">
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
  const spot = useMotionTemplate`radial-gradient(460px circle at ${mx}px ${my}px, rgba(255,255,255,0.16), transparent 70%)`;

  const category = categoryOf(formData.selectedRole);
  const isOther = formData.selectedRole === 'Other';
  const questions = useMemo<Q[]>(
    () => [
      ...BASE_QUESTIONS,
      ...(isOther ? [OTHER_QUESTION] : []),
      ...(category ? ROLE_QUESTIONS[category] : []),
    ],
    [category, isOther]
  );
  const onReview = idx >= questions.length;
  const total = questions.length + (category ? 0 : 4) + 1;
  const progress = Math.min(1, idx / (total - 1));

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
      setFormData({
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
      });
      setNotice('Welcome back. We loaded your earlier answers, so you can edit and send them again.');
    } else {
      setExistingId(null);
      setNotice('');
    }
  };

  /* ---- navigation ---- */

  const go = (to: number, d: number) => {
    setError('');
    setDir(d);
    setIdx(to);
  };

  const advance = async () => {
    if (busy || submitting || onReview) return;
    const q = questions[idx];
    const err = validate(q, formData[q.key]);
    if (err) {
      setError(err);
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
    update(cur.key, (cur.type === 'multi' ? [] : '') as never);
    go(idx + 1, 1);
  };

  const pick = (q: Q, option: string) => {
    if (q.type === 'multi') {
      const list = formData.smPlatforms;
      update('smPlatforms', list.includes(option) ? list.filter((p) => p !== option) : [...list, option]);
      setError('');
      return;
    }
    if (lock.current) return;
    update(q.key, option as never);
    setError('');
    lock.current = true;
    setTimeout(() => {
      setDir(1);
      setIdx((i) => i + 1);
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
      if (n >= 0 && n < q.options.length) pick(q, q.options[n]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* ---- submit ---- */

  const submitForm = async () => {
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
      setView('done');
    } else {
      console.error(res.error);
      setError("We couldn't send your application. Check your email address and try again.");
    }
    setSubmitting(false);
  };

  const restart = () => {
    setFormData(INITIAL);
    setExistingId(null);
    setNotice('');
    setError('');
    setIdx(0);
    setView('landing');
  };

  const displayValue = (q: Q) => {
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
  const startBtn = open ? (
    <button
      onClick={() => {
        setIdx(0);
        setView('flow');
      }}
      className="group flex w-full md:inline-flex md:w-auto items-center justify-between md:justify-start gap-4 bg-[#ffe14a] text-[#0d0f2b] font-bold text-lg rounded-full pl-8 pr-3 py-3 md:hover:gap-6 transition-all"
    >
      Start application
      <span className="ml-auto md:ml-0 w-12 h-12 shrink-0 rounded-full bg-[#0d0f2b] text-[#ffe14a] flex items-center justify-center">
        <ArrowRight className="w-5 h-5 transition-transform group-active:translate-x-1" />
      </span>
    </button>
  ) : (
    <div className="inline-block border-2 border-current rounded-full px-8 py-4 font-semibold opacity-70">
      Applications are paused for now
    </div>
  );

  const q = questions[idx];

  return (
    <div className="f-body">
      <style>{CSS}</style>

      {/* ============================ LANDING ============================ */}
      <section
        className="relative min-h-[100dvh] md:h-[100dvh] md:min-h-[640px] bg-[#2330ff] text-[#f2f2ee] flex flex-col overflow-hidden"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          mx.set(e.clientX - r.left);
          my.set(e.clientY - r.top);
        }}
      >
        <motion.div className="absolute inset-0 pointer-events-none" style={{ background: spot }} />

        <header className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5">
          <span className="f-display font-extrabold text-3xl tracking-tight">Radix</span>
          <div className="flex items-center gap-6">
            <span className="hidden sm:flex items-center gap-2 text-sm font-medium">
              <span className={`w-2.5 h-2.5 rounded-full ${open ? 'bg-[#ffe14a]' : 'bg-[#f2f2ee]/40'}`} />
              {open ? 'Applications open' : 'Applications paused'}
            </span>
            <Link to="/admin" aria-label="Admin" className="p-2 opacity-60 hover:opacity-100 transition-opacity">
              <Lock className="w-5 h-5" strokeWidth={1.75} />
            </Link>
          </div>
        </header>

        <div className="relative z-10 flex-1 min-h-0 flex flex-col justify-center px-6 md:px-12 py-4">
          <div className="select-none" aria-label="Build. Create. Execute.">
            {WORDS.map((w, i) => {
              const active = i === wordIndex;
              return (
                <div
                  key={w}
                  aria-hidden
                  className={`f-display font-extrabold leading-[0.92] tracking-tight text-[clamp(2rem,min(8.5vw,16vh),12rem)] transition-all duration-700 ease-out ${
                    active
                      ? 'text-[#ffe14a] [-webkit-text-stroke:2px_#ffe14a] md:translate-x-8'
                      : 'text-transparent [-webkit-text-stroke:2px_#f2f2ee]'
                  }`}
                >
                  {w}
                </div>
              );
            })}
          </div>

          <div className="mt-8 md:mt-10 flex flex-col md:flex-row md:items-end justify-between gap-6 md:gap-10">
            <p className="max-w-xl text-base md:text-lg leading-relaxed text-[#f2f2ee]/85">
              {siteConfig.landing_text}
            </p>
            <div>{startBtn}</div>
          </div>
        </div>

        {/* Roles band */}
        <div className="relative z-10 bg-[#ffe14a] text-[#0d0f2b] overflow-hidden py-4">
          <div className="marquee-track flex w-max">
            {[...ROLES, ...ROLES].map((r, i) => (
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
          <h2 className="f-display font-extrabold text-[clamp(2.25rem,5vw,4.5rem)] leading-none tracking-tight">
            Ready when you are.
          </h2>
          {startBtn}
        </div>
      </section>

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
                <button onClick={() => setView('landing')} className="f-display font-extrabold text-2xl tracking-tight">
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

              <main className="flex-1 grid lg:grid-cols-[minmax(0,1fr)_320px] gap-16 items-center px-6 md:px-12 pb-12 max-w-7xl w-full mx-auto">
                <div className="min-h-[60vh] flex flex-col justify-center">
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
                            <button
                              type="button"
                              onClick={back}
                              className="flex items-center gap-2 font-semibold opacity-60 hover:opacity-100 transition-opacity"
                            >
                              <ArrowLeft className="w-4 h-4" /> Back
                            </button>

                            {q.type !== 'choice' && q.type !== 'scale' && (
                              <>
                                <button
                                  type="button"
                                  onClick={advance}
                                  disabled={busy}
                                  className="bg-[#0d0f2b] text-[#f2f2ee] rounded-full px-7 py-3 font-bold text-sm hover:bg-[#2330ff] transition-colors disabled:opacity-50"
                                >
                                  Continue
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
                                    onClick={() => go(i, -1)}
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
                              disabled={submitting}
                              className="inline-flex items-center gap-3 bg-[#2330ff] text-[#f2f2ee] rounded-full px-8 py-4 font-bold text-base hover:bg-[#0d0f2b] transition-colors disabled:opacity-50"
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