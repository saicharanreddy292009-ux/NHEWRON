import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowDownToLine, ArrowUpRight, BookMarked, BookOpen, BrainCircuit,
  Check, ChevronRight, CircleHelp, Clock3, ExternalLink, FileText, Focus,
  LayoutDashboard, LoaderCircle, Menu, MessageCircle, NotebookPen, Pause, Play,
  Plus, RotateCcw, Send, Settings, Sparkles, Target, Trash2, X
} from "lucide-react";
import logo from "../nhewron-mark.png";
import "./styles.css";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
const LOCAL_KEY = "nhewron.studyPacks.react.v1";
const GREETING = "Hey, I’m Ron — your learning companion. Ask me to explain a concept, work through a question, or make a revision plan. If you’re studying a lecture, paste its transcript in Study Studio so I can use it as context.";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "studio", label: "Study Studio", icon: BookOpen, tag: "CORE" },
  { id: "ai", label: "Ron AI", icon: BrainCircuit },
  { id: "notes", label: "Notes & Roadmaps", icon: NotebookPen },
  { id: "focus", label: "Focus Mode", icon: Focus },
  { id: "settings", label: "Settings", icon: Settings },
];

function readLocalPacks() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

async function apiJson(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!response.ok) {
    let detail = "Request failed (" + response.status + ")";
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch { /* non-JSON response */ }
    throw new Error(detail);
  }
  if (response.status === 204) return null;
  return response.json();
}

function youtubeId(input) {
  try {
    const url = new URL(input.trim());
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    let id = "";
    if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] || "";
    else if (["youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com"].includes(host)) {
      if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
      else id = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?]+)/)?.[1] || "";
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function transcriptPack(raw) {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return null;
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const notes = [];
  for (let i = 0; i < sentences.length; i += 3) {
    notes.push((notes.length + 1) + ". " + sentences.slice(i, i + 3).join(" "));
  }
  const stopWords = new Set(["which", "there", "their", "about", "these", "those", "because", "would", "could", "should", "where", "while", "being", "using", "between", "through", "lecture", "concept", "example"]);
  const terms = [...new Set((text.match(/\b[A-Za-z][A-Za-z-]{4,}\b/g) || [])
    .filter((word) => !stopWords.has(word.toLowerCase())))].slice(0, 8);
  return {
    notes: "LECTURE NOTES — draft organised from your transcript\n\n" + notes.join("\n\n"),
    roadmap: "1. Re-read the main points.\n2. Write down definitions and formulas.\n3. Explain each concept without looking.\n4. Solve practice questions and review mistakes.",
    questions: "Practice prompts — draft, not verified exam questions\n" + (terms.length ? terms.map((term, index) => (index + 1) + ". Explain “" + term + "” in the context of this lecture.").join("\n") : "1. What is the central idea?\n2. Which principle or formula is most important?"),
  };
}

function packText(pack) {
  return pack.title + "\n" + (pack.source_url || "") + "\n" + "=".repeat(Math.min(60, pack.title.length)) + "\n\nTRANSCRIPT\n" + (pack.transcript || "(No transcript)") + "\n\nNOTES\n" + (pack.notes || "(No notes)") + "\n\nROADMAP / NEXT STEPS\n" + (pack.roadmap || "(No roadmap)") + "\n\nIMPORTANT PROBLEMS\n" + (pack.questions || "(No questions added)") + "\n\nCreated with NHEWRON\n";
}

function downloadText(pack) {
  const url = URL.createObjectURL(new Blob([packText(pack)], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = (pack.title || "nhewron-study-pack").replace(/[^a-z0-9-_]+/gi, "-") + ".txt";
  anchor.click();
  URL.revokeObjectURL(url);
}

function IconButton({ icon: Icon, label, onClick, className = "icon-button" }) {
  return <button type="button" className={className} aria-label={label} title={label} onClick={onClick}><Icon size={16} /></button>;
}

function App() {
  const [page, setPage] = useState("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [apiStatus, setApiStatus] = useState("checking");
  const [toast, setToast] = useState("");
  const [seconds, setSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [problems, setProblems] = useState(0);
  const [xp, setXp] = useState(0);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoId, setVideoId] = useState("");
  const [transcript, setTranscript] = useState("");
  const [notes, setNotes] = useState("");
  const [roadmap, setRoadmap] = useState("");
  const [questions, setQuestions] = useState("");
  const [packs, setPacks] = useState(() => readLocalPacks());
  const [activePackId, setActivePackId] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [studioInput, setStudioInput] = useState("");
  const [messages, setMessages] = useState([{ role: "assistant", content: GREETING }]);
  const [studioMessages, setStudioMessages] = useState([{ role: "assistant", content: "Load your lecture and paste a transcript if you have one. Ask me a doubt, and I’ll use the transcript you provide as extra context." }]);
  const [sending, setSending] = useState(false);
  const [studioSending, setStudioSending] = useState(false);
  const [intention, setIntention] = useState("");
  const [focusActive, setFocusActive] = useState(false);
  const chatEndRef = useRef(null);
  const studioEndRef = useRef(null);
  const currentLabel = navItems.find((item) => item.id === page)?.label || "Dashboard";
  const dateLabel = useMemo(() => new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }).toUpperCase(), []);

  function flash(message) {
    setToast(message);
    window.clearTimeout(flash.timeout);
    flash.timeout = window.setTimeout(() => setToast(""), 2800);
  }

  useEffect(() => {
    apiJson("/api/health").then(() => setApiStatus("online")).catch(() => setApiStatus("offline"));
    let alive = true;
    apiJson("/api/study-packs")
      .then((data) => { if (alive && Array.isArray(data.items)) { setPacks(data.items); localStorage.setItem(LOCAL_KEY, JSON.stringify(data.items)); } })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!timerRunning) return undefined;
    const timer = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          setTimerRunning(false);
          flash("Focus block complete. Take a short reset.");
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timerRunning]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, sending]);
  useEffect(() => { studioEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [studioMessages, studioSending]);
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape" && focusActive) leaveFocus(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [focusActive]);

  function navigate(next) {
    setPage(next);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startTimer() {
    if (seconds <= 0) setSeconds(25 * 60);
    setTimerRunning((running) => !running);
  }

  function resetTimer() {
    setTimerRunning(false);
    setSeconds(25 * 60);
  }

  function loadVideo() {
    const parsed = youtubeId(videoUrl);
    if (!parsed) {
      setVideoId("");
      flash("That YouTube link doesn’t look valid. Paste a full video URL.");
      return;
    }
    setVideoId(parsed);
    flash("Lecture loaded. If embedding is disabled, open it directly on YouTube.");
  }

  async function sendChat(event, target = "main") {
    event.preventDefault();
    const value = (target === "main" ? chatInput : studioInput).trim();
    if (!value || (target === "main" ? sending : studioSending)) return;

    const currentMessages = target === "main" ? messages : studioMessages;
    const setter = target === "main" ? setMessages : setStudioMessages;
    const setInput = target === "main" ? setChatInput : setStudioInput;
    const setBusy = target === "main" ? setSending : setStudioSending;
    const newMessages = [...currentMessages, { role: "user", content: value }];
    setter(newMessages);
    setInput("");
    setBusy(true);

    let streamStarted = false;
    try {
      const context = target === "studio" ? transcript.trim() : "";
      const response = await fetch(API_BASE + "/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
        body: JSON.stringify({
          messages: newMessages.slice(-18).map((message) => ({ role: message.role, content: message.content })),
          context: context || null,
        }),
      });

      if (!response.ok) {
        let detail = "Request failed (" + response.status + ")";
        try {
          const body = await response.json();
          detail = body.detail || detail;
        } catch { /* non-JSON error */ }
        throw new Error(detail);
      }
      if (!response.body) throw new Error("Streaming is not available in this browser.");

      setter((current) => [...current, { role: "assistant", content: "", streaming: true }]);
      streamStarted = true;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;

      while (!finished) {
        const result = await reader.read();
        buffer += decoder.decode(result.value || new Uint8Array(), { stream: !result.done });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const rawEvent of events) {
          const dataLine = rawEvent.split("\n").find((line) => line.startsWith("data:"));
          if (!dataLine) continue;
          const data = dataLine.slice(5).trim();
          if (data === "[DONE]") {
            finished = true;
            break;
          }
          let payload;
          try { payload = JSON.parse(data); } catch { continue; }
          if (payload.error) throw new Error(payload.error);
          if (payload.delta) {
            setter((current) => {
              const updated = [...current];
              const last = updated[updated.length - 1];
              if (last?.streaming) updated[updated.length - 1] = { ...last, content: last.content + payload.delta };
              return updated;
            });
          }
        }
        if (result.done) finished = true;
      }

      setter((current) => {
        const updated = [...current];
        const last = updated[updated.length - 1];
        if (last?.streaming) updated[updated.length - 1] = { ...last, streaming: false };
        return updated;
      });
    } catch (error) {
      setter((current) => {
        const updated = [...current];
        const last = updated[updated.length - 1];
        const detail = "Connection issue: " + error.message;
        if (streamStarted && last?.streaming) {
          updated[updated.length - 1] = {
            ...last,
            content: last.content ? last.content + "\n\n" + detail : detail,
            streaming: false,
            isError: true,
          };
        } else {
          updated.push({ role: "assistant", content: detail + ". Check that FastAPI is running and backend/.env has a valid GROQ_API_KEY and model name.", isError: true });
        }
        return updated;
      });
    } finally {
      setBusy(false);
    }
  }
  function organiseTranscript() {
    const result = transcriptPack(transcript);
    if (!result) { flash("Paste a lecture transcript first."); return; }
    setNotes(result.notes);
    setRoadmap(result.roadmap);
    setQuestions(result.questions);
    flash("Created a structured draft from your transcript. Review it for accuracy.");
  }

  function currentPack() {
    return {
      title: videoId ? "YouTube lecture · " + videoId : "NHEWRON study session",
      source_url: videoUrl.trim() || null,
      transcript: transcript.trim(),
      notes: notes.trim(),
      roadmap: roadmap.trim(),
      questions: questions.trim(),
    };
  }

  async function savePack() {
    const payload = currentPack();
    if (!payload.notes && !payload.roadmap && !payload.questions && !payload.transcript) {
      flash("Add a transcript, notes, roadmap or questions before saving.");
      return;
    }
    try {
      const saved = activePackId && !String(activePackId).startsWith("local-")
        ? await apiJson("/api/study-packs/" + encodeURIComponent(activePackId), { method: "PUT", body: JSON.stringify(payload) })
        : await apiJson("/api/study-packs", { method: "POST", body: JSON.stringify(payload) });
      setPacks((current) => {
        const updated = [saved, ...current.filter((pack) => pack.id !== saved.id)];
        localStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
        return updated;
      });
      setActivePackId(saved.id);
      flash("Study pack saved to the backend.");
    } catch {
      const localPack = { ...payload, id: activePackId || "local-" + Date.now(), created_at: new Date().toISOString(), local_only: true };
      const updated = [localPack, ...packs.filter((pack) => pack.id !== localPack.id)];
      setPacks(updated);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
      setActivePackId(localPack.id);
      flash("API unavailable — study pack saved in this browser.");
    }
  }

  function openPack(pack) {
    setActivePackId(pack.id);
    setVideoUrl(pack.source_url || "");
    setVideoId(youtubeId(pack.source_url || "") || "");
    setTranscript(pack.transcript || "");
    setNotes(pack.notes || "");
    setRoadmap(pack.roadmap || "");
    setQuestions(pack.questions || "");
    navigate("studio");
  }

  async function deletePack(pack) {
    try {
      if (!String(pack.id).startsWith("local-")) await apiJson("/api/study-packs/" + encodeURIComponent(pack.id), { method: "DELETE" });
    } catch { /* local cache can still be cleared */ }
    const updated = packs.filter((item) => item.id !== pack.id);
    setPacks(updated);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
    if (activePackId === pack.id) setActivePackId(null);
    flash("Study pack deleted.");
  }

  function leaveFocus() {
    setFocusActive(false);
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }

  async function enterFocus() {
    setFocusActive(true);
    setTimerRunning(true);
    if (document.documentElement.requestFullscreen) {
      try { await document.documentElement.requestFullscreen(); } catch { /* browser may deny fullscreen */ }
    }
  }

  const timerLabel = String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");

  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobileNav ? "sidebar-open" : "")}>
        <a className="brand" href="#dashboard" onClick={(event) => { event.preventDefault(); navigate("dashboard"); }}>
          <img src={logo} alt="NHEWRON logo" />
          <span><b>NHEW<span>RON</span><sup>®</sup></b><small>AI / LEARNING / COMPANION</small></span>
        </a>
        <p className="nav-label">WORKSPACE</p>
        <nav className="nav-list">
          {navItems.map(({ id, label, icon: Icon, tag }) => (
            <button key={id} className={"nav-item " + (page === id ? "active" : "")} onClick={() => navigate(id)}>
              <Icon size={17} strokeWidth={1.8} /><span>{label}</span>{tag && <i>{tag}</i>}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="status-row"><span className={"status-dot " + (apiStatus === "online" ? "dot-on" : "")} /><span><b>{apiStatus === "online" ? "API connected" : apiStatus === "checking" ? "Checking API…" : "Local workspace"}</b><small>{apiStatus === "online" ? "FastAPI service reachable" : "Check Settings to connect"}</small></span></div>
          <div className="side-caption">FOCUS DEEPER. LEARN BETTER.</div>
        </div>
      </aside>

      {mobileNav && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <main className="main">
        <header className="topbar">
          <div className="crumb-group"><IconButton icon={mobileNav ? X : Menu} label={mobileNav ? "Close navigation" : "Open navigation"} className="mobile-menu" onClick={() => setMobileNav((value) => !value)} /><span>Workspace</span><ChevronRight size={13} /><b>{currentLabel}</b></div>
          <div className="top-right"><span className={"api-badge " + (apiStatus === "online" ? "connected" : "")}><i />{apiStatus === "online" ? "API ONLINE" : apiStatus === "checking" ? "CONNECTING" : "OFFLINE MODE"}</span><div className="avatar">N</div></div>
        </header>

        {page === "dashboard" && (
          <section className="page">
            <div className="welcome-row"><div><p className="eyebrow">— YOUR LEARNING OS</p><h1>Make time <em>actually count.</em></h1><p className="sub">One workspace for lectures, useful notes, practice, and focused learning.</p></div><span className="date-chip">{dateLabel}</span></div>
            <div className="hero-grid">
              <article className="panel timer-panel">
                <div className="panel-top"><span className="label">FOCUS SESSION</span><small>READY WHEN YOU ARE</small></div>
                <div className="timer-ring"><div><strong>{timerLabel}</strong><small>MINUTES TO DEEP WORK</small></div></div>
                <div className="center-actions"><button className="primary" onClick={startTimer}>{timerRunning ? <Pause size={15} /> : <Play size={15} />}{timerRunning ? "Pause focus" : seconds === 0 ? "Start again" : "Start focus"}</button><IconButton icon={RotateCcw} label="Reset timer" onClick={resetTimer} className="square-button" /></div>
                <div className="panel-foot"><span><b>{Math.floor((25 * 60 - seconds) / 60)}</b> focused minutes this block</span><span className="lime">Small steps. Real learning.</span></div>
              </article>
              <article className="panel goal-panel">
                <div className="panel-top"><span className="label">TODAY’S TARGET</span><span className="lime">DAILY PROGRESS</span></div>
                <div className="goal-num"><strong>{problems}</strong><span>/ 30 problems</span></div><div className="progress-bar"><i style={{ width: (problems / 30) * 100 + "%" }} /></div>
                <div className="goal-actions"><button className="secondary" onClick={() => { setProblems((value) => Math.min(30, value + 1)); setXp((value) => value + 50); flash("Problem logged. Keep going!"); }}><Plus size={14} /> Log a problem</button><small>Every solved problem counts.</small></div>
                <hr /><div className="stats"><div><small>STUDY PACKS</small><b>{packs.length}</b></div><div><small>SESSION XP</small><b>+{xp} <small>XP</small></b></div></div>
              </article>
            </div>
            <div className="section-heading"><div><p className="eyebrow">YOUR NEXT MOVE</p><h2>Study with fewer switches.</h2></div><button className="text-link" onClick={() => navigate("studio")}>Open Study Studio <ArrowUpRight size={14} /></button></div>
            <div className="feature-grid">
              <button className="feature-card" onClick={() => navigate("studio")}><span className="feature-icon"><BookOpen size={22} /></span><b>Study Studio</b><p>YouTube lecture, Ron, notes, and important problems in one workspace.</p><small>OPEN STUDIO ↗</small></button>
              <button className="feature-card" onClick={() => navigate("ai")}><span className="feature-icon"><Sparkles size={22} /></span><b>Talk to Ron</b><p>Get live Groq-powered study explanations once your API key is configured.</p><small>CHAT WITH RON ↗</small></button>
              <button className="feature-card" onClick={() => navigate("focus")}><span className="feature-icon"><Target size={22} /></span><b>Focus Mode</b><p>Set an intention, run a timer, and enter distraction-reduced fullscreen.</p><small>START FOCUS ↗</small></button>
            </div>
            <div className="notice"><CircleHelp size={18} /><div><b>Know what is connected</b><p>Ron uses your FastAPI backend. Study packs can sync to the API database; a browser-only fallback is used when the API is unavailable.</p></div></div>
          </section>
        )}

        {page === "studio" && (
          <section className="page">
            <div className="page-heading"><p className="eyebrow">— STUDY STUDIO</p><h1>Watch. Understand. <em>Practice.</em></h1><p className="sub">Keep your lecture, AI companion, and study notes in one workspace.</p></div>
            <article className="panel source-panel"><div className="panel-top"><div><span className="label">LECTURE SOURCE</span><h3>Bring your YouTube lecture</h3></div><span className="small-pill"><Play size={13} /> PRIVACY-ENHANCED PLAYER</span></div>
              <form className="youtube-form" onSubmit={(event) => { event.preventDefault(); loadVideo(); }}><input className="input" value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="Paste a YouTube video URL…" aria-label="YouTube video URL" /><button className="primary"><Play size={14} /> Load lecture</button></form>
              <p className="hint">Videos that disallow embeds or are age-restricted may only play on YouTube. Use the direct link if the player shows an error.</p>
            </article>
            <div className="studio-grid">
              <div className="studio-main">
                <article className="panel video-panel"><div className="panel-top"><div><span className="label">NOW STUDYING</span><h3>{videoId ? "Lecture · " + videoId : "Your lecture"}</h3></div><span className="small-pill"><i className="status-dot" /> PLAYER</span></div>
                  <div className="video-frame">
                    {videoId ? <iframe key={videoId} title="YouTube study lecture" src={"https://www.youtube-nocookie.com/embed/" + videoId + "?rel=0&playsinline=1"} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /> : <div className="video-placeholder"><span><Play size={26} fill="currentColor" /></span><b>Your lecture appears here</b><small>Paste a link above to begin.</small></div>}
                  </div>
                  {videoId && <div className="video-fallback"><p className="hint">If playback is blocked, the owner may have disabled embedding or the video may have age restrictions.</p><a className="secondary" href={"https://www.youtube.com/watch?v=" + videoId} target="_blank" rel="noopener noreferrer">Open on YouTube <ExternalLink size={13} /></a></div>}
                  <div className="transcript-section"><label className="field-label" htmlFor="transcript">LECTURE TRANSCRIPT (OPTIONAL)</label><textarea id="transcript" className="input area" rows={5} value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="Paste captions or a transcript here. Ron can use this text as context." /><div className="inline-actions"><button className="secondary" onClick={organiseTranscript}><Sparkles size={14} /> Organise transcript</button><button className="quiet" onClick={() => setTranscript("")}>Clear</button></div><p className="hint">Transcript organisation is a local draft. NHEWRON does not automatically listen to or transcribe video audio.</p></div>
                </article>
                <div className="section-heading study-pack-heading"><div><p className="eyebrow">BUILT FROM THE LECTURE</p><h2>Your study pack</h2></div><div className="inline-actions"><button className="secondary" onClick={savePack}><BookMarked size={14} /> Save pack</button><button className="secondary" onClick={() => window.print()}><FileText size={14} /> Export PDF</button><button className="quiet" onClick={() => downloadText(currentPack())}><ArrowDownToLine size={14} /> TXT</button></div></div>
                <div className="output-grid">
                  <article className="panel output-panel"><div className="panel-top"><h3>Quick notes</h3><span className="output-tag">NOTES</span></div><textarea className="input area output-area" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Generated or personal notes…" rows={8} /></article>
                  <article className="panel output-panel"><div className="panel-top"><h3>Concept roadmap</h3><span className="output-tag">NEXT STEPS</span></div><textarea className="input area output-area" value={roadmap} onChange={(event) => setRoadmap(event.target.value)} placeholder={"1. Understand the core concept\n2. Review formulas\n3. Solve practice questions"} rows={8} /></article>
                  <article className="panel output-panel"><div className="panel-top"><h3>Important problems</h3><span className="output-tag">PRACTICE</span></div><textarea className="input area output-area" value={questions} onChange={(event) => setQuestions(event.target.value)} placeholder="Questions and practice prompts…" rows={8} /></article>
                </div>
              </div>
              <aside className="panel ron-panel"><div className="ron-header"><div className="ron-avatar"><Sparkles size={18} /></div><div><h3>Ron <span>AI companion</span></h3><small><i className={"status-dot " + (apiStatus === "online" ? "dot-on" : "")} /> {apiStatus === "online" ? "API REACHABLE" : "CHECK API CONNECTION"}</small></div></div>
                <ChatLog messages={studioMessages} busy={studioSending} endRef={studioEndRef} />
                <form className="chat-form" onSubmit={(event) => sendChat(event, "studio")}><input className="input" value={studioInput} onChange={(event) => setStudioInput(event.target.value)} placeholder="Ask about this lecture…" aria-label="Ask Ron about this lecture" /><button className="primary send-button" aria-label="Send message" disabled={studioSending || !studioInput.trim()}><Send size={15} /></button></form>
                <p className="hint">When you ask about this lecture, the pasted transcript is included in the API request as context.</p>
              </aside>
            </div>
          </section>
        )}

        {page === "ai" && (
          <section className="page"><div className="page-heading"><p className="eyebrow">— YOUR AI COMPANION</p><h1>Meet <em>Ron.</em></h1><p className="sub">Ask doubts, revise concepts, and make the next step clear.</p></div>
            <div className="ai-layout"><article className="panel ai-chat-panel"><div className="ron-header"><div className="ron-avatar large"><Sparkles size={20} /></div><div><h3>Ron <span>Learning companion</span></h3><small><i className={"status-dot " + (apiStatus === "online" ? "dot-on" : "")} /> {apiStatus === "online" ? "FASTAPI CONNECTED" : "API OFFLINE / NOT CONFIGURED"}</small></div></div><ChatLog messages={messages} busy={sending} endRef={chatEndRef} /><form className="chat-form main-chat-form" onSubmit={(event) => sendChat(event, "main")}><input id="ron-main-input" className="input" value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Message Ron…" aria-label="Message Ron" /><button className="primary send-button" disabled={sending || !chatInput.trim()} aria-label="Send message">{sending ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}</button></form></article>
              <aside className="panel prompt-panel"><span className="label">TRY ASKING RON</span><h3>Start with a prompt</h3><div className="prompt-list">{[
                ["Explain a concept from basics", "Explain electric field from first principles, step by step."],
                ["Build a short study plan", "Make me a 45-minute JEE study plan for one chapter."],
                ["Analyse mistakes", "Give me a method to analyse my mistakes after solving a question."],
                ["Revise a lecture", "Help me revise a lecture using notes, formulas, and practice questions."],
              ].map(([title, prompt]) => <button key={title} className="prompt-button" onClick={() => { setChatInput(prompt); navigate("ai"); window.setTimeout(() => document.getElementById("ron-main-input")?.focus(), 50); }}><span>{title}</span><ArrowUpRight size={14} /></button>)}</div><div className="boundary"><Sparkles size={18} /><div><b>What’s connected?</b><p>The FastAPI server sends requests to Groq. Keep the Groq key only on the server in <code>backend/.env</code>.</p></div></div></aside>
            </div>
          </section>
        )}

        {page === "notes" && (
          <section className="page"><div className="page-heading"><p className="eyebrow">— YOUR KNOWLEDGE BASE</p><h1>Notes that lead to <em>action.</em></h1><p className="sub">Your saved study packs, synced through the backend when available.</p><button className="primary heading-action" onClick={() => { setActivePackId(null); setVideoUrl(""); setVideoId(""); setTranscript(""); setNotes(""); setRoadmap(""); setQuestions(""); navigate("studio"); }}><Plus size={15} /> New study pack</button></div>
            <div className="saved-packs">{packs.length ? packs.map((pack) => <article className="pack-card" key={pack.id}><span className="pack-date">{new Date(pack.created_at || pack.date || Date.now()).toLocaleDateString()}</span><h3>{pack.title}</h3><p>{pack.notes || pack.transcript || "No notes added yet."}</p><div className="pack-actions"><button className="secondary" onClick={() => openPack(pack)}>Open / edit <ChevronRight size={13} /></button><button className="quiet" onClick={() => downloadText(pack)}>Export TXT</button><IconButton icon={Trash2} label="Delete study pack" onClick={() => deletePack(pack)} /></div></article>) : <div className="empty-large"><BookMarked size={26} /><h3>No study packs yet</h3><p>Open Study Studio and save your first notes pack.</p><button className="secondary" onClick={() => navigate("studio")}>Open Study Studio</button></div>}</div>
          </section>
        )}

        {page === "focus" && (
          <section className="page"><div className="page-heading"><p className="eyebrow">— FOCUS MODE</p><h1>Protect your <em>attention.</em></h1><p className="sub">Choose a single goal and give it your full attention.</p></div>
            <div className="focus-grid"><article className="panel"><span className="label">YOUR FOCUS INTENTION</span><h3>What will you finish?</h3><textarea className="input area intention-area" rows={4} value={intention} onChange={(event) => setIntention(event.target.value)} placeholder="e.g. Solve 15 electrostatics PYQs and review mistakes." /><div className="focus-timer"><Clock3 size={18} /><strong>{timerLabel}</strong><span>25-MINUTE BLOCK</span></div><div className="inline-actions"><button className="primary" onClick={enterFocus}><Target size={15} /> Enter Focus Mode</button><button className="secondary" onClick={resetTimer}><RotateCcw size={14} /> Reset timer</button></div><div className="boundary"><CircleHelp size={18} /><div><b>Browser limitation</b><p>Fullscreen supports focus, but a website cannot block other apps or websites on your computer.</p></div></div></article>
              <article className="panel"><span className="label">A SMALL RESET</span><h3>One step at a time.</h3><p className="muted large-muted">Before you start, write the exact result you want from this session. When it ends, note what worked and the next action.</p><div className="reset-checklist"><div><Check size={15} /> Set one specific task</div><div><Check size={15} /> Keep the needed notes ready</div><div><Check size={15} /> Review mistakes before stopping</div></div></article></div>
          </section>
        )}

        {page === "settings" && (
          <section className="page"><div className="page-heading"><p className="eyebrow">— SYSTEM STATUS</p><h1>Workspace <em>settings.</em></h1><p className="sub">Check service connectivity and configure your local environment.</p></div>
            <article className="panel settings-panel"><div className="settings-row"><div className="setting-symbol"><Activity size={18} /></div><div><b>FastAPI backend</b><p>{apiStatus === "online" ? "Reachable at the configured API base URL." : "Not reachable. Start the backend on port 8000 and check VITE_API_BASE_URL."}</p></div><span className={"settings-status " + (apiStatus === "online" ? "connected" : "")}>{apiStatus === "online" ? "CONNECTED" : apiStatus === "checking" ? "CHECKING" : "OFFLINE"}</span></div><div className="settings-row"><div className="setting-symbol"><BrainCircuit size={18} /></div><div><b>Groq · GPT-OSS 120B</b><p>Configure GROQ_API_KEY and GROQ_MODEL in backend/.env. The key is never sent to the browser.</p></div><span className="settings-status">SERVER ENV</span></div><div className="settings-row"><div className="setting-symbol"><BookMarked size={18} /></div><div><b>Study packs</b><p>Persistent API saves use SQLite. If the API is offline, this browser stores a fallback copy.</p></div><span className="settings-status">{packs.length} SAVED</span></div><div className="settings-warning"><CircleHelp size={18} /><p><b>Before public production:</b> add authentication and per-user data isolation, rate limits, request quotas, migrations and a managed database. The included SQLite endpoints are a functional starter, not yet a multi-user SaaS security layer.</p></div><div className="inline-actions settings-actions"><button className="secondary" onClick={() => { setApiStatus("checking"); apiJson("/api/health").then(() => { setApiStatus("online"); flash("Backend is reachable."); }).catch(() => { setApiStatus("offline"); flash("Backend is not reachable."); }); }}><RotateCcw size={14} /> Recheck connection</button><button className="quiet" onClick={() => { if (confirm("Clear browser-only fallback study packs? This will not delete backend packs.")) { const localOnly = packs.filter((pack) => !pack.local_only && !String(pack.id).startsWith("local-")); setPacks(localOnly); localStorage.setItem(LOCAL_KEY, JSON.stringify(localOnly)); flash("Browser fallback copies cleared."); } }}><Trash2 size={14} /> Clear local fallback</button></div></article>
          </section>
        )}

        <footer><span>NHEWRON® / AI · LEARNING · COMPANION</span><span>FOCUS DEEPER. LEARN BETTER.</span></footer>
      </main>

      {focusActive && <div className="focus-overlay"><div className="focus-card"><img src={logo} alt="" /><p className="eyebrow">FOCUS MODE</p><h2>Stay with <em>your intention.</em></h2><p>{intention.trim() || "Study with intention. One task at a time."}</p><div className="focus-clock">{timerLabel}</div><p className="muted">This fullscreen screen supports focus but cannot lock your computer or block other apps.</p><div className="inline-actions"><button className="primary" onClick={() => setTimerRunning((value) => !value)}>{timerRunning ? <Pause size={15} /> : <Play size={15} />}{timerRunning ? "Pause session" : "Resume session"}</button><button className="secondary" onClick={leaveFocus}>End focus session</button></div></div></div>}
      {toast && <div role="status" className="toast">{toast}</div>}
    </div>
  );
}

function ChatLog({ messages, busy, endRef }) {
  return <div className="chat-log">{messages.map((message, index) => <div key={index} className={"message " + (message.role === "user" ? "user-message" : "ron-message") + (message.isError ? " message-error" : "")}><b>{message.role === "user" ? "You" : "Ron"}</b><p>{message.content}</p></div>)}{busy && <div className="message ron-message"><b>Ron</b><p className="thinking"><LoaderCircle className="spin" size={14} /> Thinking…</p></div>}<div ref={endRef} /></div>;
}

export default App;
