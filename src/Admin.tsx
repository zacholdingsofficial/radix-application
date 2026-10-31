import { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './supabase';
import { Download, FileSpreadsheet, Lock, ArrowLeft, Trash2, Search, Loader2, RefreshCcw } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Link } from 'react-router-dom';

/* Palette: blue #2330ff, chalk #f2f2ee, ink #0d0f2b, yellow #ffe14a */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@500;700;800&family=Hanken+Grotesk:wght@400;500;600&display=swap');
.f-display { font-family: 'Syne', system-ui, sans-serif; }
.f-body, .f-body * { font-family: 'Hanken Grotesk', system-ui, sans-serif; }
.f-body .f-display { font-family: 'Syne', system-ui, sans-serif; }
.f-body button:focus-visible, .f-body a:focus-visible, .f-body input:focus-visible, .f-body textarea:focus-visible { outline: 3px solid currentColor; outline-offset: 3px; }
.f-body ::selection { background: #ffe14a; color: #0d0f2b; }
`;

type Row = [string, string];

const roleLabel = (a: any): string =>
  a.selected_role === 'Other' && a.custom_role ? `Other: ${a.custom_role}` : a.selected_role || '';

const baseRole = (a: any): string => {
  const r: string = a.selected_role || '';
  return r.startsWith('Other') ? 'Other' : r;
};

// Role specific answers, shared by the profile screen and the PDF export
const answerRows = (s: any): Row[] => {
  const rows: Row[] = [];
  const add = (label: string, value: unknown) => {
    if (value === null || value === undefined) return;
    const text = String(value).trim();
    if (text) rows.push([label, text]);
  };

  add('Portfolio / Work', s.portfolio_url || s.cr_portfolio);
  add('GitHub', s.github_url || s.tech_reference);

  add('Software', s.cr_software);
  add('Teamwork', s.cr_teamwork);
  add('Remarks (Creatives)', s.cr_remarks);

  add('Built social profiles', s.sm_familiarity);
  add('Platforms', Array.isArray(s.sm_platforms) ? s.sm_platforms.join(', ') : s.sm_platforms);
  add('Strategy and analytics', s.sm_strategies);
  add('Remarks (Social)', s.sm_remarks);

  add('Marketing tools', s.dm_tools_scale ? `${s.dm_tools_scale} / 5` : '');
  add('Skills and tools', s.dm_skills);
  add('Analytical skills', s.dm_analytic_scale ? `${s.dm_analytic_scale} / 5` : '');
  add('Experience', s.dm_experience);
  add('Remarks (Digital Mktg)', s.dm_remarks);

  add('Technical skills', s.tech_skills);
  add('Tools', s.tech_tools);
  add('Remarks (Tech)', s.tech_remarks);
  
  return rows;
};

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState<'roster' | 'settings'>('roster');

  const [applications, setApplications] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [siteSettings, setSiteSettings] = useState({ is_active: true, landing_text: '' });
  const [savedSettings, setSavedSettings] = useState({ is_active: true, landing_text: '' });
  const [savingSettings, setSavingSettings] = useState(false);
  const settingsChanged =
    siteSettings.is_active !== savedSettings.is_active || siteSettings.landing_text !== savedSettings.landing_text;

  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = (text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  };

  /* ---- data ---- */

  const fetchData = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setLoading(true);

    const { data: apps } = await supabase.from('applications').select('*').order('created_at', { ascending: false });
    if (apps) setApplications(apps);

    const { data: settings } = await supabase.from('site_content').select('*').eq('id', 1).single();
    if (settings) {
      const s = { is_active: settings.is_active, landing_text: settings.landing_text };
      setSiteSettings(s);
      setSavedSettings(s);
    }
    
    if (isManualRefresh) {
      setIsRefreshing(false);
      notify('Applications updated');
    } else {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin@zacholdings.com') {
      setLoginError('');
      setIsAuthenticated(true);
      fetchData();
    } else {
      setLoginError("That passkey isn't correct.");
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    const { error } = await supabase.from('site_content').update(siteSettings).eq('id', 1);
    if (!error) setSavedSettings(siteSettings);
    notify(error ? "Couldn't save your changes. Try again." : 'Saved. Your changes are live.');
    setSavingSettings(false);
  };

  const deleteApplication = async (id: string) => {
    const { error } = await supabase.from('applications').delete().eq('id', id);
    if (!error) {
      notify('Application deleted.');
      setSelectedStudent(null);
      setConfirmDelete(false);
      fetchData();
    } else {
      notify("Couldn't delete that application.");
    }
  };

  /* ---- exports ---- */

  const exportExcel = () => {
    const flat = applications.map((a) => ({
      ...a,
      sm_platforms: Array.isArray(a.sm_platforms) ? a.sm_platforms.join(', ') : a.sm_platforms,
    }));
    const ws = XLSX.utils.json_to_sheet(flat);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Applications');
    XLSX.writeFile(wb, 'Radix_Applications.xlsx');
  };

  const exportBulkPDF = () => {
    const doc = new jsPDF();
    autoTable(doc, {
      head: [['Name', 'Role', 'Class', 'Phone', 'Email', 'Portfolio', 'GitHub']],
      body: applications.map((a) => [
        a.full_name, 
        roleLabel(a), 
        a.class_year, 
        a.phone, 
        a.email,
        a.portfolio_url || a.cr_portfolio || '',
        a.github_url || a.tech_reference || ''
      ]),
      theme: 'grid',
      styles: { fontSize: 7 }, 
    });
    doc.save('Radix_Applications_Bulk.pdf');
  };

  const exportIndividualPDF = (student: any) => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text(`Radix profile: ${student.full_name}`, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
    doc.text(`Application ID: ${student.id}`, 14, 34);

    const body: string[][] = [
      ['Email', student.email || ''],
      ['Phone', student.phone || ''],
      ['Class / Year', student.class_year || ''],
      ['Role', roleLabel(student)],
      ['Submitted on', new Date(student.created_at).toLocaleString()],
      ...answerRows(student),
    ];

    autoTable(doc, {
      startY: 45,
      head: [['Question', 'Answer']],
      body,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
    });
    doc.save(`Radix_Profile_${String(student.full_name || 'applicant').replace(/\s+/g, '_')}.pdf`);
  };

  /* ---- derived ---- */

  const roleChips = useMemo(() => {
    const counts: Record<string, number> = {};
    applications.forEach((a) => {
      const r = baseRole(a);
      if (r) counts[r] = (counts[r] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [applications]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return applications.filter((a) => {
      if (roleFilter !== 'All' && baseRole(a) !== roleFilter) return false;
      if (!q) return true;
      return [a.full_name, a.email, a.phone, a.class_year, roleLabel(a)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [applications, query, roleFilter]);

  const lastWeek = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return applications.filter((a) => new Date(a.created_at).getTime() >= cutoff).length;
  }, [applications]);

  /* ======================================================================= */
  /*  LOGIN                                                                  */
  /* ======================================================================= */

  if (!isAuthenticated) {
    return (
      <div className="f-body min-h-[100dvh] bg-[#2330ff] text-[#f2f2ee] flex items-center justify-center p-6 relative">
        <style>{CSS}</style>
        <Link
          to="/"
          className="absolute top-6 left-6 md:left-12 flex items-center gap-2 text-sm font-semibold opacity-80 hover:opacity-100 transition-opacity"
        >
          <ArrowLeft className="w-4 h-4" /> Back to site
        </Link>

        <motion.form
          onSubmit={handleLogin}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="bg-[#f2f2ee] text-[#0d0f2b] rounded-3xl p-8 w-full max-w-sm"
        >
          <div className="w-12 h-12 rounded-full bg-[#ffe14a] flex items-center justify-center">
            <Lock className="w-5 h-5" strokeWidth={2} />
          </div>
          <h1 className="f-display font-extrabold text-3xl tracking-tight mt-6">Radix admin</h1>
          <p className="text-sm opacity-60 mt-1">Enter your passkey to see applications.</p>

          <input
            autoFocus
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setLoginError('');
            }}
            placeholder="Passkey"
            className="mt-6 w-full bg-transparent border-0 border-b-2 border-[#0d0f2b]/20 focus:border-[#2330ff] outline-none py-3 text-lg transition-colors placeholder:text-[#0d0f2b]/30"
          />
          {loginError && <p className="mt-3 text-sm font-semibold text-[#2330ff]">{loginError}</p>}

          <button
            type="submit"
            className="mt-8 w-full bg-[#0d0f2b] text-[#f2f2ee] font-bold text-sm rounded-full py-4 hover:bg-[#2330ff] transition-colors"
          >
            Sign in
          </button>
        </motion.form>
      </div>
    );
  }

  /* ======================================================================= */
  /*  CONSOLE                                                                */
  /* ======================================================================= */

  const tabBtn = (id: 'roster' | 'settings', label: string) => (
    <button
      onClick={() => {
        setActiveTab(id);
        setSelectedStudent(null);
        setConfirmDelete(false);
      }}
      className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
        activeTab === id ? 'bg-[#0d0f2b] text-[#f2f2ee]' : 'hover:bg-[#0d0f2b]/10'
      }`}
    >
      {label}
    </button>
  );

  const isLink = (v: string) => /^https?:\/\//i.test(v);

  return (
    <div className="f-body min-h-[100dvh] bg-[#f2f2ee] text-[#0d0f2b]">
      <style>{CSS}</style>

      <header className="bg-[#2330ff] text-[#f2f2ee]">
        <div className="max-w-6xl mx-auto px-6 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 f-display font-extrabold text-xl leading-none tracking-tight">
              <img src="/logo1.png" alt="" className="h-6 w-auto object-contain translate-y-[1px]" />
              Radix
            </span>
            <span className="text-xs font-medium opacity-70 border-l border-[#f2f2ee]/30 pl-3">Admin</span>
          </div>
          <Link to="/" className="flex items-center gap-1 text-xs sm:text-sm font-semibold opacity-80 hover:opacity-100 transition-opacity">
            <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" /> Public site
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 md:px-8 py-8 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2">
            {tabBtn('roster', 'Applications')}
            {tabBtn('settings', 'Site settings')}
          </div>

          {activeTab === 'roster' && !selectedStudent && (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => fetchData(true)}
                disabled={isRefreshing}
                className="flex items-center gap-2 border-2 border-[#0d0f2b] rounded-full px-4 py-2 text-sm font-semibold hover:bg-[#0d0f2b] hover:text-[#f2f2ee] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Refresh applications"
              >
                <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                onClick={exportBulkPDF}
                className="flex items-center gap-2 border-2 border-[#0d0f2b] rounded-full px-4 py-2 text-sm font-semibold hover:bg-[#0d0f2b] hover:text-[#f2f2ee] transition-colors"
              >
                <Download className="w-4 h-4" /> PDF
              </button>
              <button
                onClick={exportExcel}
                className="flex items-center gap-2 border-2 border-[#0d0f2b] rounded-full px-4 py-2 text-sm font-semibold hover:bg-[#0d0f2b] hover:text-[#f2f2ee] transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </button>
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {/* ---------------------------- SETTINGS ---------------------------- */}
          {activeTab === 'settings' && (
            <motion.section
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="w-full space-y-10"
            >
              <h1 className="f-display font-extrabold text-3xl tracking-tight">Site settings</h1>

              <div className="flex items-center justify-between gap-6 border-t-2 border-b-2 border-[#0d0f2b] py-6">
                <div>
                  <h2 className="f-display font-bold text-lg">Accepting applications</h2>
                  <p className="text-sm opacity-60 mt-1 max-w-2xl">
                    When this is off, the Start application button is replaced with a paused message.
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={siteSettings.is_active}
                  onClick={() => setSiteSettings((p) => ({ ...p, is_active: !p.is_active }))}
                  className={`relative shrink-0 w-24 h-11 rounded-full transition-colors duration-300 ${
                    siteSettings.is_active ? 'bg-[#2330ff]' : 'bg-[#0d0f2b]/25'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-9 h-9 rounded-full bg-[#ffe14a] transition-all duration-300 ${
                      siteSettings.is_active ? 'left-[3.25rem]' : 'left-1'
                    }`}
                  />
                  <span
                    className={`absolute top-1/2 -translate-y-1/2 text-xs font-bold text-[#f2f2ee] ${
                      siteSettings.is_active ? 'left-3' : 'hidden'
                    }`}
                  >
                    Open
                  </span>
                  <span
                    className={`absolute top-1/2 -translate-y-1/2 text-xs font-bold text-[#0d0f2b] ${
                      siteSettings.is_active ? 'hidden' : 'right-3'
                    }`}
                  >
                    Paused
                  </span>
                </button>
              </div>

              <div>
                <label htmlFor="intro" className="f-display font-bold text-lg">
                  Landing page introduction
                </label>
                <p className="text-sm opacity-60 mt-1">This text appears under the headline on the first screen.</p>
                <textarea
                  id="intro"
                  value={siteSettings.landing_text}
                  onChange={(e) => setSiteSettings((p) => ({ ...p, landing_text: e.target.value }))}
                  rows={8}
                  className="mt-4 w-full bg-white/60 border-2 border-[#0d0f2b]/15 focus:border-[#2330ff] rounded-2xl p-4 text-base leading-relaxed outline-none resize-none transition-colors"
                />
              </div>

              <button
                onClick={saveSettings}
                disabled={savingSettings || !settingsChanged}
                className="inline-flex items-center gap-3 bg-[#2330ff] text-[#f2f2ee] font-bold text-sm rounded-full px-8 py-4 hover:bg-[#0d0f2b] transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#2330ff]"
              >
                {savingSettings ? 'Saving...' : 'Save and publish'}
                {savingSettings && <Loader2 className="w-4 h-4 animate-spin" />}
              </button>
            </motion.section>
          )}

          {/* ------------------------------ ROSTER ---------------------------- */}
          {activeTab === 'roster' && loading && (
            <motion.p key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3 opacity-60">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading applications...
            </motion.p>
          )}

          {activeTab === 'roster' && !loading && !selectedStudent && (
            <motion.section
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {/* At a glance */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-[#ffe14a] rounded-3xl p-6">
                  <p className="text-sm font-medium opacity-70">Applications</p>
                  <p className="f-display font-extrabold text-5xl mt-2">{applications.length}</p>
                </div>
                <div className="bg-[#0d0f2b] text-[#f2f2ee] rounded-3xl p-6">
                  <p className="text-sm font-medium opacity-70">Last 7 days</p>
                  <p className="f-display font-extrabold text-5xl mt-2">{lastWeek}</p>
                </div>
                <div className="col-span-2 md:col-span-1 bg-[#2330ff] text-[#f2f2ee] rounded-3xl p-6">
                  <p className="text-sm font-medium opacity-70">Status</p>
                  <p className="f-display font-extrabold text-3xl mt-3">
                    {siteSettings.is_active ? 'Open' : 'Paused'}
                  </p>
                </div>
              </div>

              {/* Search and filters */}
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name, email, phone or class"
                    className="w-full bg-transparent border-0 border-b-2 border-[#0d0f2b]/20 focus:border-[#2330ff] outline-none pl-8 py-3 text-lg transition-colors placeholder:text-[#0d0f2b]/30"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {[['All', applications.length] as [string, number], ...roleChips].map(([name, count]) => (
                    <button
                      key={name}
                      onClick={() => setRoleFilter(name)}
                      className={`rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition-colors ${
                        roleFilter === name
                          ? 'bg-[#2330ff] border-[#2330ff] text-[#f2f2ee]'
                          : 'border-[#0d0f2b]/20 hover:border-[#0d0f2b]'
                      }`}
                    >
                      {name} <span className="opacity-60">{count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* List */}
              <div>
                <div className="hidden md:grid grid-cols-[2fr_1.6fr_0.8fr_0.8fr] gap-4 px-4 pb-3 text-sm font-medium opacity-50">
                  <span>Candidate</span>
                  <span>Role</span>
                  <span>Class</span>
                  <span>Submitted</span>
                </div>
                <ul className="border-t-2 border-[#0d0f2b]">
                  {filtered.length === 0 ? (
                    <li className="py-12 text-center opacity-50">
                      {applications.length === 0 ? 'No applications yet.' : 'Nothing matches that search.'}
                    </li>
                  ) : (
                    filtered.map((app) => (
                      <li key={app.id} className="border-b border-[#0d0f2b]/15">
                        <button
                          onClick={() => {
                            setSelectedStudent(app);
                            setConfirmDelete(false);
                          }}
                          className="w-full text-left grid md:grid-cols-[2fr_1.6fr_0.8fr_0.8fr] gap-1 md:gap-4 items-center px-4 py-4 hover:bg-[#2330ff] hover:text-[#f2f2ee] transition-colors duration-200"
                        >
                          <span className="min-w-0">
                            <span className="f-display font-bold text-lg block truncate">{app.full_name}</span>
                            <span className="text-sm opacity-60 block truncate">{app.email}</span>
                          </span>
                          <span className="text-sm font-semibold truncate">{roleLabel(app)}</span>
                          <span className="text-sm opacity-70">{app.class_year}</span>
                          <span className="text-sm opacity-60">{new Date(app.created_at).toLocaleDateString()}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </motion.section>
          )}

          {/* ------------------------------ PROFILE --------------------------- */}
          {activeTab === 'roster' && !loading && selectedStudent && (
            <motion.section
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="space-y-10"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <button
                  onClick={() => {
                    setSelectedStudent(null);
                    setConfirmDelete(false);
                  }}
                  className="flex items-center gap-2 text-sm font-semibold opacity-70 hover:opacity-100 transition-opacity"
                >
                  <ArrowLeft className="w-4 h-4" /> All applications
                </button>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => exportIndividualPDF(selectedStudent)}
                    className="flex items-center gap-2 border-2 border-[#0d0f2b] rounded-full px-4 py-2 text-sm font-semibold hover:bg-[#0d0f2b] hover:text-[#f2f2ee] transition-colors"
                  >
                    <Download className="w-4 h-4" /> Export PDF
                  </button>

                  {!confirmDelete ? (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="flex items-center gap-2 border-2 border-[#0d0f2b]/25 rounded-full px-4 py-2 text-sm font-semibold hover:border-[#0d0f2b] transition-colors"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  ) : (
                    <span className="flex items-center gap-3 bg-[#0d0f2b] text-[#f2f2ee] rounded-full pl-5 pr-2 py-1.5 text-sm">
                      Delete for good?
                      <button
                        onClick={() => deleteApplication(selectedStudent.id)}
                        className="bg-[#ffe14a] text-[#0d0f2b] font-bold rounded-full px-4 py-1.5"
                      >
                        Yes, delete
                      </button>
                      <button onClick={() => setConfirmDelete(false)} className="font-semibold px-2 opacity-80 hover:opacity-100">
                        Cancel
                      </button>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-end justify-between gap-6">
                <div className="min-w-0">
                  <h1 className="f-display font-extrabold text-[clamp(2rem,5vw,3.5rem)] leading-none tracking-tight break-words">
                    {selectedStudent.full_name}
                  </h1>
                  <p className="mt-3 text-base opacity-70 break-all">
                    {selectedStudent.email}
                    {selectedStudent.phone ? `, ${selectedStudent.phone}` : ''}
                  </p>
                </div>
                <span className="bg-[#2330ff] text-[#f2f2ee] font-semibold rounded-full px-5 py-2 text-sm">
                  {roleLabel(selectedStudent)}
                </span>
              </div>

              <div className="grid lg:grid-cols-[320px_1fr] gap-10">
                {/* Basics */}
                <div className="bg-[#ffe14a] rounded-3xl p-7 self-start space-y-5">
                  <h2 className="f-display font-bold text-lg">Basics</h2>
                  {(
                    [
                      ['Class', selectedStudent.class_year],
                      ['Applied on', new Date(selectedStudent.created_at).toLocaleString()],
                      ['Application ID', selectedStudent.id],
                    ] as Row[]
                  ).map(([label, value]) => (
                    <div key={label}>
                      <p className="text-sm opacity-60">{label}</p>
                      <p className="font-semibold break-all">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Answers */}
                <div>
                  <h2 className="f-display font-bold text-lg mb-4">Answers</h2>
                  {answerRows(selectedStudent).length === 0 ? (
                    <p className="opacity-50 border-t-2 border-[#0d0f2b] pt-6">No role answers were provided.</p>
                  ) : (
                    <dl className="border-t-2 border-[#0d0f2b]">
                      {answerRows(selectedStudent).map(([label, value], i) => (
                        <div
                          key={`${label}-${i}`}
                          className="grid sm:grid-cols-[200px_1fr] gap-1 sm:gap-6 py-4 border-b border-[#0d0f2b]/15"
                        >
                          <dt className="text-sm font-medium opacity-60 pt-0.5">{label}</dt>
                          <dd className="text-base break-words whitespace-pre-wrap">
                            {isLink(value) ? (
                              <a href={value} target="_blank" rel="noreferrer" className="font-semibold text-[#2330ff] underline underline-offset-4">
                                {value}
                              </a>
                            ) : (
                              value
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0d0f2b] text-[#f2f2ee] rounded-full px-6 py-3 text-sm font-semibold shadow-lg"
            role="status"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}