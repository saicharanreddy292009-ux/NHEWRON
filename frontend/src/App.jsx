import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Activity, ArrowDownToLine, ArrowUpRight, BookMarked, BookOpen, BrainCircuit,
  Check, ChevronRight, CircleHelp, Clock3, ExternalLink, Eye, EyeOff, FileText, Focus,
  History, LayoutDashboard, LoaderCircle, Menu, MessageCircle, NotebookPen, Pause, Play,
  Plus, RotateCcw, Send, Settings, Sparkles, Sun, Moon, Target, Trash2, X
} from "lucide-react";
import logo from "../nhewron-mark.png";
import "./styles.css";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
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

function readLocalPacks(storageKey = LOCAL_KEY) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

async function apiJson(path, options = {}, accessToken = null) {
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {}),
    },
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
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState({ username: "", full_name: "", email: "" });
  const [profileDraft, setProfileDraft] = useState({ username: "", full_name: "" });
  const [accountBusy, setAccountBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [studioHistory, setStudioHistory] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeStudioChatId, setActiveStudioChatId] = useState(null);
  const [extractingTranscript, setExtractingTranscript] = useState(false);
  const [transcriptSummary, setTranscriptSummary] = useState("");
  const [transcriptLanguage, setTranscriptLanguage] = useState("");
  const [transcriptIsGenerated, setTranscriptIsGenerated] = useState(false);
  const [transcriptExtractionError, setTranscriptExtractionError] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("nhewron.theme") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
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
  const [packs, setPacks] = useState([]);
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
  const localStorageKey = session?.user?.id ? `${LOCAL_KEY}.${session.user.id}` : LOCAL_KEY;
  const requestApi = useCallback((path, options = {}) => apiJson(path, options, session?.access_token), [session?.access_token]);
  const accountName = profile.full_name || session?.user?.user_metadata?.full_name || session?.user?.email?.split("@")[0] || "Learner";
  const dateLabel = useMemo(() => new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }).toUpperCase(), []);

  function flash(message) {
    setToast(message);
    window.clearTimeout(flash.timeout);
    flash.timeout = window.setTimeout(() => setToast(""), 2800);
  }

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return undefined;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setAuthLoading(false);
    }).catch(() => { if (active) setAuthLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
        setPage("settings");
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try { localStorage.setItem("nhewron.theme", theme); } catch { /* storage may be disabled */ }
  }, [theme]);

  useEffect(() => {
    if (!session?.user?.id) {
      setPacks([]);
      setProfile({ username: "", full_name: "", email: "" });
      setProfileDraft({ username: "", full_name: "" });
      setApiStatus("checking");
      return undefined;
    }
    let alive = true;
    setPacks(readLocalPacks(localStorageKey));
    requestApi("/api/health").then(() => { if (alive) setApiStatus("online"); }).catch(() => { if (alive) setApiStatus("offline"); });
    requestApi("/api/study-packs")
      .then((data) => {
        if (alive && Array.isArray(data.items)) {
          setPacks(data.items);
          localStorage.setItem(localStorageKey, JSON.stringify(data.items));
        }
      })
      .catch(() => {});
    requestApi("/api/profile")
      .then((data) => {
        if (alive) {
          setProfile(data);
          setProfileDraft({ username: data.username || "", full_name: data.full_name || "" });
        }
      })
      .catch((error) => { if (alive) flash(error.message || "Could not load profile."); });
    requestApi("/api/chat-history?mode=ai")
      .then((data) => { if (alive) setChatHistory(Array.isArray(data.items) ? data.items : []); })
      .catch(() => {});
    requestApi("/api/chat-history?mode=studio")
      .then((data) => { if (alive) setStudioHistory(Array.isArray(data.items) ? data.items : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [session?.user?.id, requestApi, localStorageKey]);

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
    setTranscriptExtractionError("");
    flash("Lecture loaded. Use Auto-extract transcript to retrieve available captions.");
  }

  async function extractTranscript() {
    const parsed = youtubeId(videoUrl);
    if (!parsed) {
      setVideoId("");
      setTranscriptExtractionError("Paste a valid YouTube link first.");
      flash("Paste a valid YouTube link first.");
      return;
    }
    setVideoId(parsed);
    setExtractingTranscript(true);
    setTranscriptExtractionError("");
    try {
      const result = await requestApi("/api/youtube/transcript", {
        method: "POST",
        body: JSON.stringify({ youtube_url: videoUrl.trim() }),
      });
      setTranscript(result.transcript || "");
      setTranscriptSummary(result.summary || "");
      setTranscriptLanguage(result.language || "Unknown");
      setTranscriptIsGenerated(Boolean(result.is_generated));
      setNotes((current) => current.trim() ? current : (result.summary || ""));
      const historySaved = await persistChatHistory("studio", studioMessages, {
        source_url: videoUrl.trim(),
        transcript: result.transcript || "",
        summary: result.summary || "",
      });
      setTranscriptExtractionError([
        result.summary_error || "",
        historySaved ? "" : "Transcript extracted, but saved chat history is unavailable until the updated Supabase schema is applied.",
      ].filter(Boolean).join(" "));
      if (result.transcript_truncated) {
        flash("Transcript extracted. It was shortened to fit the study workspace.");
      } else {
        flash("Transcript extracted. Ron can now answer questions about this video.");
      }
    } catch (error) {
      const detail = error.message || "The transcript could not be extracted.";
      setTranscriptExtractionError(detail);
      flash(detail);
    } finally {
      setExtractingTranscript(false);
    }
  }

  function startNewChat(target = "main") {
    if (target === "studio") {
      setStudioMessages([{ role: "assistant", content: "Ask a follow-up question about the video transcript or its summary." }]);
      setActiveStudioChatId(null);
      setTranscript("");
      setTranscriptSummary("");
      setTranscriptLanguage("");
      setTranscriptIsGenerated(false);
      setTranscriptExtractionError("");
    } else {
      setMessages([{ role: "assistant", content: GREETING }]);
      setActiveChatId(null);
    }
  }

  async function loadChatSession(sessionId, target = "main") {
    if (!sessionId) return;
    try {
      const saved = await requestApi("/api/chat-history/" + encodeURIComponent(sessionId));
      const restored = Array.isArray(saved.messages) ? saved.messages.map(({ role, content }) => ({ role, content })) : [];
      if (target === "studio") {
        setStudioMessages(restored.length ? restored : [{ role: "assistant", content: "Ask a follow-up about this video." }]);
        setActiveStudioChatId(saved.id);
        setVideoUrl(saved.source_url || "");
        setVideoId(youtubeId(saved.source_url || "") || "");
        setTranscript(saved.transcript || "");
        setTranscriptSummary(saved.summary || "");
        navigate("studio");
      } else {
        setMessages(restored.length ? restored : [{ role: "assistant", content: GREETING }]);
        setActiveChatId(saved.id);
        navigate("ai");
      }
      flash("Chat history restored.");
    } catch (error) {
      flash(error.message || "Could not restore this conversation.");
    }
  }

  async function persistChatHistory(target, finalMessages, metadata = {}) {
    const isStudio = target === "studio";
    const activeId = isStudio ? activeStudioChatId : activeChatId;
    const firstQuestion = finalMessages.find((item) => item.role === "user")?.content || "";
    const sourceUrl = metadata.source_url !== undefined ? metadata.source_url : (isStudio ? (videoUrl.trim() || null) : null);
    const savedTranscript = metadata.transcript !== undefined ? metadata.transcript : (isStudio ? transcript : "");
    const savedSummary = metadata.summary !== undefined ? metadata.summary : (isStudio ? transcriptSummary : "");
    const payload = {
      mode: isStudio ? "studio" : "ai",
      title: firstQuestion.trim().replace(/\s+/g, " ").slice(0, 72) || (isStudio ? "YouTube study session" : "Ron AI conversation"),
      source_url: sourceUrl || null,
      transcript: (savedTranscript || "").slice(0, 100000),
      summary: (savedSummary || "").slice(0, 12000),
      messages: finalMessages
        .filter((item) => (item.role === "user" || item.role === "assistant") && String(item.content || "").trim())
        .slice(-100)
        .map((item) => ({ role: item.role, content: String(item.content).slice(0, 12000) })),
    };
    try {
      const saved = activeId
        ? await requestApi("/api/chat-history/" + encodeURIComponent(activeId), { method: "PUT", body: JSON.stringify(payload) })
        : await requestApi("/api/chat-history", { method: "POST", body: JSON.stringify(payload) });
      if (isStudio) {
        setActiveStudioChatId(saved.id);
        setStudioHistory((current) => [saved, ...current.filter((item) => item.id !== saved.id)].slice(0, 30));
      } else {
        setActiveChatId(saved.id);
        setChatHistory((current) => [saved, ...current.filter((item) => item.id !== saved.id)].slice(0, 30));
      }
      return true;
    } catch (error) {
      flash("Reply received, but chat history could not be saved. " + (error.message || "Check the chat history database setup."));
      return false;
    }
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
      const context = target === "studio"
        ? [
            transcriptSummary ? "VIDEO SUMMARY\n" + transcriptSummary : "",
            transcript ? "TRANSCRIPT EXCERPT\n" + transcript.slice(0, 8500) : "",
          ].filter(Boolean).join("\n\n").slice(0, 12000)
        : "";
      const response = await fetch(API_BASE + "/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
          Authorization: `Bearer ${session.access_token}`,
        },
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
      let assistantContent = "";
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
            assistantContent += payload.delta;
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
      if (assistantContent.trim()) {
        await persistChatHistory(target, [...newMessages, { role: "assistant", content: assistantContent }]);
      }
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
        ? await requestApi("/api/study-packs/" + encodeURIComponent(activePackId), { method: "PUT", body: JSON.stringify(payload) })
        : await requestApi("/api/study-packs", { method: "POST", body: JSON.stringify(payload) });
      setPacks((current) => {
        const updated = [saved, ...current.filter((pack) => pack.id !== saved.id)];
        localStorage.setItem(localStorageKey, JSON.stringify(updated));
        return updated;
      });
      setActivePackId(saved.id);
      flash("Study pack saved to the backend.");
    } catch {
      const localPack = { ...payload, id: activePackId || "local-" + Date.now(), created_at: new Date().toISOString(), local_only: true };
      const updated = [localPack, ...packs.filter((pack) => pack.id !== localPack.id)];
      setPacks(updated);
      localStorage.setItem(localStorageKey, JSON.stringify(updated));
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
      if (!String(pack.id).startsWith("local-")) await requestApi("/api/study-packs/" + encodeURIComponent(pack.id), { method: "DELETE" });
    } catch { /* local cache can still be cleared */ }
    const updated = packs.filter((item) => item.id !== pack.id);
    setPacks(updated);
    localStorage.setItem(localStorageKey, JSON.stringify(updated));
    if (activePackId === pack.id) setActivePackId(null);
    flash("Study pack deleted.");
  }


  async function saveProfile(event) {
    event.preventDefault();
    const username = profileDraft.username.trim();
    const full_name = profileDraft.full_name.trim();
    if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
      flash("Username must be 3–24 characters using letters, numbers, or underscores.");
      return;
    }
    setAccountBusy(true);
    try {
      const updated = await requestApi("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ username, full_name }),
      });
      setProfile(updated);
      setProfileDraft({ username: updated.username || "", full_name: updated.full_name || "" });
      flash("Profile updated.");
    } catch (error) {
      flash(error.message || "Unable to update profile.");
    } finally {
      setAccountBusy(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    if (newPassword.length < 8) {
      flash("Choose a password with at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      flash("The passwords do not match.");
      return;
    }
    if (!supabase) { flash("Authentication is not configured."); return; }
    setAccountBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      setRecoveryMode(false);
      flash("Password changed successfully.");
    } catch (error) {
      flash(error.message || "Unable to change password.");
    } finally {
      setAccountBusy(false);
    }
  }

  async function exportAccountData() {
    setAccountBusy(true);
    try {
      let studyPacks = packs;
      try {
        const result = await requestApi("/api/study-packs");
        if (Array.isArray(result.items)) studyPacks = result.items;
      } catch { /* include the signed-in user's browser cache when the API is offline */ }
      const payload = {
        exported_at: new Date().toISOString(),
        account: {
          email: session?.user?.email || "",
          username: profile.username || "",
          full_name: profile.full_name || accountName,
        },
        study_packs: studyPacks,
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "nhewron-account-export.json";
      anchor.click();
      URL.revokeObjectURL(url);
      flash("Account data export downloaded.");
    } finally {
      setAccountBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    setAccountBusy(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setPacks([]);
      setMessages([{ role: "assistant", content: GREETING }]);
      setStudioMessages([{ role: "assistant", content: "Load your lecture and paste a transcript if you have one. Ask me a doubt, and I’ll use the transcript you provide as extra context." }]);
      setPage("dashboard");
      flash("Signed out successfully.");
    } catch (error) {
      flash(error.message || "Unable to sign out.");
    } finally {
      setAccountBusy(false);
    }
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

  if (authLoading) return <div className="auth-loading"><LoaderCircle className="spin" size={25} /><span>Preparing your workspace…</span></div>;
  if (!session) return <AuthScreen configured={Boolean(supabase)} />;

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
          <div className="top-right"><button className="theme-toggle" type="button" onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>{theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}<span>{theme === "dark" ? "Light mode" : "Dark mode"}</span></button><span className={"api-badge " + (apiStatus === "online" ? "connected" : "")}><i />{apiStatus === "online" ? "API ONLINE" : apiStatus === "checking" ? "CONNECTING" : "OFFLINE MODE"}</span><button type="button" className="avatar avatar-button" title="Open profile settings" aria-label="Open profile settings" onClick={() => navigate("settings")}>{accountName.slice(0, 1).toUpperCase()}</button></div>
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
              <form className="youtube-form" onSubmit={(event) => { event.preventDefault(); loadVideo(); }}><input className="input" value={videoUrl} onChange={(event) => { setVideoUrl(event.target.value); setTranscriptExtractionError(""); }} placeholder="Paste a YouTube video URL…" aria-label="YouTube video URL" /><button className="secondary"><Play size={14} /> Load lecture</button><button type="button" className="primary" onClick={extractTranscript} disabled={extractingTranscript || !videoUrl.trim()}>{extractingTranscript ? <LoaderCircle className="spin" size={14} /> : <FileText size={14} />}{extractingTranscript ? "Extracting…" : "Auto-extract transcript"}</button></form>
              <p className="hint">Videos that disallow embeds or are age-restricted may only play on YouTube. Use the direct link if the player shows an error.</p>
            </article>
            <div className="studio-grid">
              <div className="studio-main">
                <article className="panel video-panel"><div className="panel-top"><div><span className="label">NOW STUDYING</span><h3>{videoId ? "Lecture · " + videoId : "Your lecture"}</h3></div><span className="small-pill"><i className="status-dot" /> PLAYER</span></div>
                  <div className="video-frame">
                    {videoId ? <iframe key={videoId} title="YouTube study lecture" src={"https://www.youtube-nocookie.com/embed/" + videoId + "?rel=0&playsinline=1"} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /> : <div className="video-placeholder"><span><Play size={26} fill="currentColor" /></span><b>Your lecture appears here</b><small>Paste a link above to begin.</small></div>}
                  </div>
                  {videoId && <div className="video-fallback"><p className="hint">If playback is blocked, the owner may have disabled embedding or the video may have age restrictions.</p><a className="secondary" href={"https://www.youtube.com/watch?v=" + videoId} target="_blank" rel="noopener noreferrer">Open on YouTube <ExternalLink size={13} /></a></div>}
                  {transcriptExtractionError && <div className="transcript-alert" role="status"><CircleHelp size={16} /><span>{transcriptExtractionError}</span></div>}
                  {transcriptSummary && <article className="panel transcript-summary"><div className="panel-top"><div><span className="label">VIDEO SUMMARY</span><h3>Key ideas from this lecture</h3></div><span className="small-pill">{transcriptLanguage || "Transcript"}{transcriptIsGenerated ? " · auto captions" : " · captions"}</span></div><div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{transcriptSummary}</ReactMarkdown></div><p className="hint">Ask Ron a follow-up in the panel. The summary and a transcript excerpt are included as context.</p></article>}
                  <div className="transcript-section"><label className="field-label" htmlFor="transcript">VIDEO TRANSCRIPT</label><textarea id="transcript" className="input area" rows={7} value={transcript} onChange={(event) => { setTranscript(event.target.value); }} placeholder="Extract captions automatically, or paste a transcript here." /><div className="inline-actions"><button type="button" className="secondary" onClick={organiseTranscript}><Sparkles size={14} /> Organise transcript</button><button type="button" className="quiet" onClick={() => { setTranscript(""); setTranscriptSummary(""); setTranscriptLanguage(""); setTranscriptExtractionError(""); }}>Clear</button></div><p className="hint">Only captions available through YouTube can be extracted. Private, age-restricted, caption-disabled, or blocked videos may require a manual transcript.</p></div>
                </article>
                <div className="section-heading study-pack-heading"><div><p className="eyebrow">BUILT FROM THE LECTURE</p><h2>Your study pack</h2></div><div className="inline-actions"><button className="secondary" onClick={savePack}><BookMarked size={14} /> Save pack</button><button className="secondary" onClick={() => window.print()}><FileText size={14} /> Export PDF</button><button className="quiet" onClick={() => downloadText(currentPack())}><ArrowDownToLine size={14} /> TXT</button></div></div>
                <div className="output-grid">
                  <article className="panel output-panel"><div className="panel-top"><h3>Quick notes</h3><span className="output-tag">NOTES</span></div><textarea className="input area output-area" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Generated or personal notes…" rows={8} /></article>
                  <article className="panel output-panel"><div className="panel-top"><h3>Concept roadmap</h3><span className="output-tag">NEXT STEPS</span></div><textarea className="input area output-area" value={roadmap} onChange={(event) => setRoadmap(event.target.value)} placeholder={"1. Understand the core concept\n2. Review formulas\n3. Solve practice questions"} rows={8} /></article>
                  <article className="panel output-panel"><div className="panel-top"><h3>Important problems</h3><span className="output-tag">PRACTICE</span></div><textarea className="input area output-area" value={questions} onChange={(event) => setQuestions(event.target.value)} placeholder="Questions and practice prompts…" rows={8} /></article>
                </div>
              </div>
              <aside className="panel ron-panel"><div className="ron-header"><div className="ron-avatar"><Sparkles size={18} /></div><div><h3>Ron <span>AI companion</span></h3><small><i className={"status-dot " + (apiStatus === "online" ? "dot-on" : "")} /> {apiStatus === "online" ? "API REACHABLE" : "CHECK API CONNECTION"}</small></div></div>
                <ChatHistoryBar history={studioHistory} activeId={activeStudioChatId} onSelect={(id) => loadChatSession(id, "studio")} onNew={() => startNewChat("studio")} label="Video chat history" />
                <ChatLog messages={studioMessages} busy={studioSending} endRef={studioEndRef} />
                <form className="chat-form" onSubmit={(event) => sendChat(event, "studio")}><input className="input" value={studioInput} onChange={(event) => setStudioInput(event.target.value)} placeholder="Ask about this lecture…" aria-label="Ask Ron about this lecture" /><button className="primary send-button" aria-label="Send message" disabled={studioSending || !studioInput.trim()}><Send size={15} /></button></form>
                <p className="hint">When you ask about this lecture, the pasted transcript is included in the API request as context.</p>
              </aside>
            </div>
          </section>
        )}

        {page === "ai" && (
          <section className="page"><div className="page-heading"><p className="eyebrow">— YOUR AI COMPANION</p><h1>Meet <em>Ron.</em></h1><p className="sub">Ask doubts, revise concepts, and make the next step clear.</p></div>
            <div className="ai-layout"><article className="panel ai-chat-panel"><div className="ron-header"><div className="ron-avatar large"><Sparkles size={20} /></div><div><h3>Ron <span>Learning companion</span></h3><small><i className={"status-dot " + (apiStatus === "online" ? "dot-on" : "")} /> {apiStatus === "online" ? "FASTAPI CONNECTED" : "API OFFLINE / NOT CONFIGURED"}</small></div></div><ChatHistoryBar history={chatHistory} activeId={activeChatId} onSelect={(id) => loadChatSession(id, "main")} onNew={() => startNewChat("main")} label="Ron chat history" /><ChatLog messages={messages} busy={sending} endRef={chatEndRef} /><form className="chat-form main-chat-form" onSubmit={(event) => sendChat(event, "main")}><input id="ron-main-input" className="input" value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="Message Ron…" aria-label="Message Ron" /><button className="primary send-button" disabled={sending || !chatInput.trim()} aria-label="Send message">{sending ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}</button></form></article>
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
          <section className="page profile-page">
            <div className="page-heading">
              <p className="eyebrow">— YOUR ACCOUNT</p>
              <h1>Profile <em>settings.</em></h1>
              <p className="sub">Manage your details, security, appearance, and personal data.</p>
            </div>

            <div className="profile-layout">
              <article className="panel profile-card">
                <div className="profile-card-heading">
                  <div className="profile-symbol">{accountName.slice(0, 1).toUpperCase()}</div>
                  <div><h2>{accountName}</h2><p>{session.user.email}</p><span className="account-chip"><Check size={12} /> Signed in</span></div>
                </div>
                <form className="profile-form" onSubmit={saveProfile}>
                  <div className="profile-section-title"><div><h3>Personal information</h3><p>Your public-facing profile details.</p></div></div>
                  <label className="profile-field"><span>Full name</span><input className="input" value={profileDraft.full_name} onChange={(event) => setProfileDraft((value) => ({ ...value, full_name: event.target.value }))} placeholder="Your full name" maxLength={100} /></label>
                  <label className="profile-field"><span>Username</span><input className="input" value={profileDraft.username} onChange={(event) => setProfileDraft((value) => ({ ...value, username: event.target.value }))} placeholder="your_username" minLength={3} maxLength={24} autoComplete="username" /><small>3–24 letters, numbers, or underscores. Usernames must be unique.</small></label>
                  <label className="profile-field"><span>Email address</span><input className="input" value={session.user.email || ""} readOnly disabled /><small>Email changes require a separate verification flow.</small></label>
                  <div className="profile-actions"><button className="primary" disabled={accountBusy}><Check size={14} /> Save changes</button></div>
                </form>
              </article>

              <div className="profile-side-column">
                <article className="panel profile-card">
                  <div className="profile-section-title"><div><h3>Appearance</h3><p>Choose how NHEWRON looks on this device.</p></div><Sun size={18} /></div>
                  <div className="appearance-options">
                    <button type="button" className={"appearance-option " + (theme === "light" ? "selected" : "")} onClick={() => setTheme("light")}><span className="appearance-preview light-preview"><i /><i /><i /></span><span><b>Light</b><small>Bright and clear</small></span>{theme === "light" && <Check size={15} />}</button>
                    <button type="button" className={"appearance-option " + (theme === "dark" ? "selected" : "")} onClick={() => setTheme("dark")}><span className="appearance-preview dark-preview"><i /><i /><i /></span><span><b>Dark</b><small>Easy on the eyes</small></span>{theme === "dark" && <Check size={15} />}</button>
                  </div>
                </article>

                <article className="panel profile-card">
                  <div className="profile-section-title"><div><h3>Password & security</h3><p>Choose a strong password for your account.</p></div><Settings size={18} /></div>
                  <form className="profile-form password-form" onSubmit={changePassword}>
                    <label className="profile-field"><span>New password</span><div className="password-input-wrap"><input className="input" type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} autoComplete="new-password" placeholder="At least 8 characters" required /><button type="button" className="password-visibility" onClick={() => setShowNewPassword((value) => !value)} aria-label={showNewPassword ? "Hide new password" : "Show new password"} title={showNewPassword ? "Hide password" : "Show password"}>{showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
                    <label className="profile-field"><span>Confirm new password</span><div className="password-input-wrap"><input className="input" type={showConfirmNewPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} autoComplete="new-password" placeholder="Enter it again" required /><button type="button" className="password-visibility" onClick={() => setShowConfirmNewPassword((value) => !value)} aria-label={showConfirmNewPassword ? "Hide confirmation password" : "Show confirmation password"} title={showConfirmNewPassword ? "Hide password" : "Show password"}>{showConfirmNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
                    <div className="profile-actions"><button type="submit" className="secondary" disabled={accountBusy || !newPassword || !confirmPassword}>Update password</button></div>
                  </form>
                </article>

                <article className="panel profile-card">
                  <div className="profile-section-title"><div><h3>Your data</h3><p>Keep a personal copy of your NHEWRON study packs.</p></div><ArrowDownToLine size={18} /></div>
                  <div className="data-export-row"><div><b>Export account data</b><small>Profile details and saved study packs as JSON.</small></div><button className="secondary" onClick={exportAccountData} disabled={accountBusy}><ArrowDownToLine size={14} /> Export</button></div>
                </article>

                <article className="panel profile-card signout-card">
                  <div className="profile-section-title"><div><h3>Sign out</h3><p>End your current session on this device.</p></div><ExternalLink size={18} /></div>
                  <div className="data-export-row"><div><b>{session.user.email}</b><small>You can sign in again at any time.</small></div><button className="danger-button" onClick={signOut} disabled={accountBusy}><X size={14} /> Sign out</button></div>
                </article>
              </div>
            </div>
          </section>
        )}

        <footer><span>NHEWRON® / AI · LEARNING · COMPANION</span><span>FOCUS DEEPER. LEARN BETTER.</span></footer>
      </main>

      {focusActive && <div className="focus-overlay"><div className="focus-card"><img src={logo} alt="" /><p className="eyebrow">FOCUS MODE</p><h2>Stay with <em>your intention.</em></h2><p>{intention.trim() || "Study with intention. One task at a time."}</p><div className="focus-clock">{timerLabel}</div><p className="muted">This fullscreen screen supports focus but cannot lock your computer or block other apps.</p><div className="inline-actions"><button className="primary" onClick={() => setTimerRunning((value) => !value)}>{timerRunning ? <Pause size={15} /> : <Play size={15} />}{timerRunning ? "Pause session" : "Resume session"}</button><button className="secondary" onClick={leaveFocus}>End focus session</button></div></div></div>}
      {toast && <div role="status" className="toast">{toast}</div>}
    </div>
  );
}



function AuthScreen({ configured }) {
  const [mode, setMode] = useState("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!configured || !supabase) {
      setError("Authentication is not configured yet. Add the Supabase URL and publishable key to the frontend environment, then redeploy.");
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setMessage("Your account has been created. Check your email to verify it, then sign in.");
          setMode("signin");
          setPassword("");
          setConfirmPassword("");
        } else {
          setMessage("Account created. Welcome to NHEWRON.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    setError("");
    setMessage("");
    if (!configured || !supabase) {
      setError("Authentication is not configured yet.");
      return;
    }
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }
    setBusy(true);
    try {
      const redirectTo = window.location.origin;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (resetError) throw resetError;
      setMessage("Password reset instructions have been sent if this email is registered.");
    } catch (err) {
      setError(err.message || "Could not start password reset.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-brand-panel">
        <a className="auth-brand" href="/" aria-label="NHEWRON home"><img src={logo} alt="" /><span><b>NHEW<span>RON</span><sup>®</sup></b><small>AI / LEARNING / COMPANION</small></span></a>
        <div className="auth-message">
          <p className="eyebrow">YOUR LEARNING WORKSPACE</p>
          <h1>Make space for <em>real progress.</em></h1>
          <p>Keep your lectures, notes, practice, and focus in one place. Your workspace follows your account wherever you sign in.</p>
          <div className="auth-feature-list"><div><BookOpen size={17} /><span>One home for your study materials</span></div><div><BrainCircuit size={17} /><span>Learn with Ron, your AI companion</span></div><div><Focus size={17} /><span>Build a focused daily routine</span></div></div>
        </div>
        <p className="auth-footer-note">FOCUS DEEPER. LEARN BETTER.</p>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand"><img src={logo} alt="" /><b>NHEW<span>RON</span></b></div>
          <p className="eyebrow">{mode === "signin" ? "WELCOME BACK" : "YOUR NEXT CHAPTER"}</p>
          <h2>{mode === "signin" ? "Sign in to continue" : "Create your account"}</h2>
          <p className="auth-subtitle">{mode === "signin" ? "Pick up where your learning left off." : "Set up your personal learning workspace."}</p>

          {!configured && <div className="auth-notice"><CircleHelp size={17} /><span>Authentication setup required. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in Vercel and configure the matching backend environment variables.</span></div>}
          {error && <div role="alert" className="auth-alert auth-error">{error}</div>}
          {message && <div role="status" className="auth-alert auth-success">{message}</div>}

          <form className="auth-form" onSubmit={submit}>
            {mode === "signup" && <label className="profile-field"><span>Full name</span><input className="input" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="How should we call you?" autoComplete="name" maxLength={100} required /></label>}
            <label className="profile-field"><span>Email address</span><input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required /></label>
            <label className="profile-field"><span>Password</span><div className="password-input-wrap"><input className="input" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required /><button type="button" className="password-visibility" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
            {mode === "signup" && <label className="profile-field"><span>Confirm password</span><div className="password-input-wrap"><input className="input" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter password again" autoComplete="new-password" minLength={8} required /><button type="button" className="password-visibility" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"} title={showConfirmPassword ? "Hide password" : "Show password"}>{showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>}
            <button className="primary auth-submit" type="submit" disabled={busy || !configured}>{busy ? <LoaderCircle className="spin" size={16} /> : null}{mode === "signin" ? "Sign in" : "Create account"}<ChevronRight size={16} /></button>
          </form>

          {mode === "signin" && <button className="auth-link-button" type="button" onClick={resetPassword} disabled={busy}>Forgot your password?</button>}
          <div className="auth-switch">{mode === "signin" ? "New to NHEWRON?" : "Already have an account?"}<button type="button" onClick={() => { setMode((value) => value === "signin" ? "signup" : "signin"); setError(""); setMessage(""); }} disabled={busy}>{mode === "signin" ? "Create an account" : "Sign in"}</button></div>
          <p className="auth-legal">By continuing, you agree to use your workspace responsibly and keep your account secure.</p>
        </div>
      </section>
    </main>
  );
}

function ChatHistoryBar({ history, activeId, onSelect, onNew, label }) {
  return (
    <div className="chat-history-toolbar">
      <div className="chat-history-select"><History size={14} /><select aria-label={label} value={activeId || ""} onChange={(event) => onSelect(event.target.value)}><option value="">Recent chats</option>{history.map((item) => <option key={item.id} value={item.id}>{item.title || (item.mode === "studio" ? "Video study" : "Ron AI")} · {new Date(item.updated_at || item.created_at).toLocaleDateString()}</option>)}</select></div>
      <button type="button" className="quiet new-chat-button" onClick={onNew}><Plus size={13} /> New chat</button>
    </div>
  );
}

function ChatLog({ messages, busy, endRef }) {
  return <div className="chat-log">{messages.map((message, index) => <div key={index} className={"message " + (message.role === "user" ? "user-message" : "ron-message") + (message.isError ? " message-error" : "")}><b>{message.role === "user" ? "You" : "Ron"}</b>{message.role === "assistant" ? (
        <div className="markdown-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
              table: ({ node, ...props }) => <div className="markdown-table-wrap"><table {...props} /></div>,
            }}
          >
            {message.content || ""}
          </ReactMarkdown>
        </div>
      ) : <p>{message.content}</p>}</div>)}{busy && <div className="message ron-message"><b>Ron</b><p className="thinking"><LoaderCircle className="spin" size={14} /> Thinking…</p></div>}<div ref={endRef} /></div>;
}

export default App;
