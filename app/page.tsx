"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { pickRandom, WordEntry } from "@/components/wordData";

type Phase = "waiting" | "countdown" | "playing" | "result";

const GAME_DURATION = 60;

type Particle = { id: number; x: number; y: number; color: string; char: string };
let _pid = 0;
const COLORS = ["#00f5ff", "#ff2d78", "#ffe620", "#39ff14", "#bf5fff"];
const CHARS  = ["★", "✦", "◆", "●", "▲"];

export default function Page() {
  const [phase, setPhase]         = useState<Phase>("waiting");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft]   = useState(GAME_DURATION);
  const [score, setScore]         = useState(0);
  const [word, setWord]           = useState<WordEntry>({ hiragana: "　", patterns: [""] });
  const [typed, setTyped]         = useState("");
  const [locked, setLocked]       = useState("");
  const [miss, setMiss]           = useState(false);
  const [cleared, setCleared]     = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [best, setBest]           = useState(0);

  const wordBoxRef  = useRef<HTMLDivElement>(null);
  const phaseRef    = useRef<Phase>("waiting");
  const wordRef     = useRef<WordEntry>({ hiragana: "", patterns: [""] });
  const typedRef    = useRef("");
  const lockedRef   = useRef("");
  const scoreRef    = useRef(0);
  const usedRef     = useRef<Set<string>>(new Set()); // 今ゲームで出た単語

  phaseRef.current  = phase;
  wordRef.current   = word;
  typedRef.current  = typed;
  lockedRef.current = locked;
  scoreRef.current  = score;

  useEffect(() => {
    const b = localStorage.getItem("futamoji-best");
    if (b) setBest(parseInt(b));
  }, []);

  const nextWord = useCallback((prevHiragana?: string) => {
    // 使用済みセットに前の単語を追加
    if (prevHiragana) usedRef.current.add(prevHiragana);
    const w = pickRandom(usedRef.current);
    setWord(w);
    wordRef.current = w;
    setTyped(""); typedRef.current = "";
    setLocked(""); lockedRef.current = "";
    setCleared(true);
    setTimeout(() => setCleared(false), 200);
  }, []);

  const startGame = useCallback(() => {
    usedRef.current = new Set(); // ゲーム開始時に使用済みリストをリセット
    setScore(0); scoreRef.current = 0;
    setTimeLeft(GAME_DURATION);
    setCountdown(3);
    setPhase("countdown");
  }, []);

  // カウントダウン
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      const t = setTimeout(() => {
        nextWord();
        setPhase("playing");
      }, 650);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 900);
    return () => clearTimeout(t);
  }, [phase, countdown, nextWord]);

  // ゲームタイマー
  useEffect(() => {
    if (phase !== "playing") return;
    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(iv);
          setPhase("result");
          const s = scoreRef.current;
          setBest(prev => {
            const next = Math.max(prev, s);
            localStorage.setItem("futamoji-best", String(next));
            return next;
          });
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [phase]);

  // パーティクル
  const spawn = () => {
    const box = wordBoxRef.current?.getBoundingClientRect();
    const cx = box ? box.left + box.width / 2 : window.innerWidth / 2;
    const cy = box ? box.top  + box.height / 2 : window.innerHeight / 2;
    const ps: Particle[] = Array.from({ length: 8 }, (_, i) => ({
      id: ++_pid,
      x:  cx + (Math.random() - 0.5) * 140,
      y:  cy + (Math.random() - 0.5) * 70,
      color: COLORS[i % COLORS.length],
      char:  CHARS[i % CHARS.length],
    }));
    setParticles(p => [...p, ...ps]);
    setTimeout(() => setParticles(p => p.filter(x => !ps.find(n => n.id === x.id))), 700);
  };

  // キー入力
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (phaseRef.current === "waiting" || phaseRef.current === "result") {
          startGame();
        }
        return;
      }
      if (phaseRef.current !== "playing") return;
      const key = e.key.toLowerCase();
      if (key.length !== 1 || !/[a-z]/.test(key)) return;

      const currentWord   = wordRef.current;
      const currentTyped  = typedRef.current;
      const currentLocked = lockedRef.current;
      const nextTyped     = currentTyped + key;

      if (currentLocked) {
        if (currentLocked.startsWith(nextTyped)) {
          setTyped(nextTyped); typedRef.current = nextTyped;
          if (nextTyped === currentLocked) {
            const s = scoreRef.current + 1;
            setScore(s); scoreRef.current = s;
            spawn();
            setTimeout(() => nextWord(currentWord.hiragana), 80);
          }
        } else {
          setMiss(true);
          setTimeout(() => setMiss(false), 350);
        }
      } else {
        const matched = currentWord.patterns.filter(p => p.startsWith(nextTyped));
        if (matched.length > 0) {
          setTyped(nextTyped); typedRef.current = nextTyped;
          if (matched.includes(nextTyped)) {
            const s = scoreRef.current + 1;
            setScore(s); scoreRef.current = s;
            spawn();
            setTimeout(() => nextWord(currentWord.hiragana), 80);
          } else if (matched.length === 1) {
            setLocked(matched[0]); lockedRef.current = matched[0];
          }
        } else {
          setMiss(true);
          setTimeout(() => setMiss(false), 350);
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [nextWord, startGame]);

  const guide    = locked || word.patterns[0] || "";
  const donePart = guide.slice(0, typed.length);
  const restPart = guide.slice(typed.length);
  const progress = (timeLeft / GAME_DURATION) * 100;

  const timeColor =
    timeLeft <= 10 ? "text-[#ff2d78]" :
    timeLeft <= 20 ? "text-[#ffe620]" :
    "text-[#00f5ff]";
  const timeShadow =
    timeLeft <= 10 ? "0 0 20px #ff2d78" :
    timeLeft <= 20 ? "0 0 15px #ffe620" :
    "0 0 15px #00f5ff";

  const barColor = timeLeft <= 10
    ? "linear-gradient(90deg,#ff2d78,#ff6b6b)"
    : timeLeft <= 20
    ? "linear-gradient(90deg,#ffe620,#ffd700)"
    : "linear-gradient(90deg,#00f5ff,#bf5fff)";

  const isNewBest = phase === "result" && score > 0 && score >= best;

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden select-none">

      {/* グリッド背景 */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(0,245,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,245,255,0.04) 1px,transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      {/* 背景オーブ */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full opacity-12"
          style={{ background: "radial-gradient(circle,#00f5ff,transparent 70%)", animation: "floatOrb 7s ease-in-out infinite" }} />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-12"
          style={{ background: "radial-gradient(circle,#ff2d78,transparent 70%)", animation: "floatOrb 7s ease-in-out infinite 2.5s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full opacity-5"
          style={{ background: "radial-gradient(circle,#bf5fff,transparent 70%)" }} />
      </div>

      {/* パーティクル */}
      {particles.map(p => (
        <div key={p.id} className="fixed pointer-events-none text-2xl font-black z-50"
          style={{ left: p.x, top: p.y, color: p.color,
            textShadow: `0 0 12px ${p.color}`,
            animation: "particleUp 0.7s ease forwards" }}>
          {p.char}
        </div>
      ))}

      {/* ===== 待機画面 ===== */}
      {phase === "waiting" && (
        <div className="flex flex-col items-center gap-6 z-10" style={{ animation: "slideUp 0.4s ease forwards" }}>
          <p style={{ color: "rgba(0,245,255,0.45)", fontSize: 11, letterSpacing: "0.25em" }}
            className="uppercase font-rounded">Typing Game for Kids</p>

          <div className="text-center -space-y-1">
            <h1 className="font-rounded font-black leading-none"
              style={{ fontSize: "clamp(4rem,12vw,6rem)", letterSpacing: "-2px", color: "#ffffff" }}>
              ふたもじ
            </h1>
            <h2 className="font-rounded font-black leading-none"
              style={{ fontSize: "clamp(2.8rem,8vw,4.2rem)", color: "#00f5ff",
                textShadow: "0 0 24px rgba(0,245,255,0.6), 0 0 48px rgba(0,245,255,0.3)" }}>
              タイピング
            </h2>
          </div>

          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }} className="font-rounded">
            ひらがな 2もじを ローマじで うとう！
          </p>

          {best > 0 && (
            <div className="flex flex-col items-center" style={{ gap: 6 }}>
              <p className="font-rounded" style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>
                ベスト&nbsp;
                <span style={{ color: "#ffe620", fontSize: 22, fontWeight: 900,
                  textShadow: "0 0 15px rgba(255,230,32,0.5)" }}>{best}</span>
                &nbsp;こ
              </p>
              <button
                onClick={() => {
                  localStorage.removeItem("futamoji-best");
                  setBest(0);
                }}
                className="font-rounded"
                style={{
                  padding: "4px 16px", borderRadius: 8, fontSize: 11,
                  color: "rgba(255,255,255,0.25)", cursor: "pointer",
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}>
                リセット
              </button>
            </div>
          )}

          <button onClick={startGame}
            className="font-rounded font-black"
            style={{
              marginTop: 16, padding: "16px 56px", borderRadius: 18, fontSize: 22,
              color: "#080c14", border: "none", cursor: "pointer",
              background: "linear-gradient(135deg,#00f5ff,#bf5fff)",
              boxShadow: "0 0 40px rgba(0,245,255,0.3), 0 0 80px rgba(191,95,255,0.15)",
            }}>
            スタート！
          </button>

          <p className="font-rounded" style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>
            <kbd style={{ padding: "2px 8px", border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 5, background: "rgba(255,255,255,0.06)",
              fontFamily: "monospace", color: "rgba(255,255,255,0.3)" }}>Space</kbd>
            　でもスタートできます
          </p>
        </div>
      )}

      {/* ===== カウントダウン ===== */}
      {phase === "countdown" && (
        <div className="z-10 flex flex-col items-center">
          {countdown > 0 ? (
            <div key={`cd-${countdown}`} className="font-rounded font-black leading-none tabular-nums"
              style={{ fontSize: "clamp(8rem,22vw,14rem)", color: "#00f5ff",
                textShadow: "0 0 40px #00f5ff, 0 0 80px rgba(0,245,255,0.5)",
                animation: "cdPop 0.9s ease forwards" }}>
              {countdown}
            </div>
          ) : (
            <div className="font-rounded font-black"
              style={{ fontSize: "clamp(3rem,8vw,5rem)", color: "#39ff14",
                textShadow: "0 0 30px #39ff14",
                animation: "cdPop 0.65s ease forwards" }}>
              スタート！
            </div>
          )}
        </div>
      )}

      {/* ===== プレイ中 ===== */}
      {phase === "playing" && (
        <div className="flex flex-col items-center gap-4 z-10 w-full px-5"
          style={{ maxWidth: 520 }}>

          {/* HUD */}
          <div className="w-full flex items-end justify-between">
            <div className={`font-rounded font-black tabular-nums transition-colors ${timeColor}`}
              style={{ fontSize: 38, textShadow: timeShadow }}>
              {timeLeft}
              <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.55, marginLeft: 4 }}>びょう</span>
            </div>
            <div className="text-right">
              <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }} className="font-rounded">クリア</div>
              <span className="font-rounded font-black tabular-nums"
                style={{ fontSize: 52, color: "#ffe620", textShadow: "0 0 20px rgba(255,230,32,0.5)" }}>
                {score}
              </span>
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginLeft: 4 }} className="font-rounded">こ</span>
            </div>
          </div>

          {/* プログレスバー */}
          <div className="w-full overflow-hidden" style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)" }}>
            <div style={{ height: "100%", borderRadius: 2, width: `${progress}%`,
              background: barColor, transition: "width 1s linear, background 0.5s" }} />
          </div>

          {/* メインカード */}
          <div ref={wordBoxRef}
            className="w-full flex flex-col items-center"
            style={{
              padding: "36px 24px 28px",
              borderRadius: 28,
              background: "rgba(13,20,36,0.88)",
              backdropFilter: "blur(12px)",
              border: miss
                ? "1px solid rgba(255,45,120,0.5)"
                : cleared
                ? "1px solid rgba(57,255,20,0.5)"
                : "1px solid rgba(255,255,255,0.07)",
              boxShadow: miss
                ? "0 0 30px rgba(255,45,120,0.2), 0 20px 60px rgba(0,0,0,0.5)"
                : cleared
                ? "0 0 30px rgba(57,255,20,0.2), 0 20px 60px rgba(0,0,0,0.5)"
                : "0 0 0 1px rgba(0,245,255,0.08), 0 20px 60px rgba(0,0,0,0.5)",
              animation: miss ? "shake 0.35s ease" : undefined,
              gap: 20,
            }}>

            {/* ひらがな */}
            <div key={word.hiragana} className="font-rounded font-black leading-none"
              style={{ fontSize: "clamp(5rem,16vw,7rem)", color: "#ffffff", animation: "popIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards" }}>
              {word.hiragana}
            </div>

            {/* ローマ字ガイド */}
            <div className="flex flex-col items-center" style={{ gap: 8 }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "clamp(2rem,6vw,2.8rem)",
                fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                <span style={{ color: miss ? "#ff2d78" : "#39ff14",
                  textShadow: miss ? "0 0 12px rgba(255,45,120,0.6)" : "0 0 12px rgba(57,255,20,0.6)" }}>
                  {donePart}
                </span>
                <span style={{ color: "rgba(255,255,255,0.55)" }}>{restPart}</span>
              </div>

              {/* 複数候補 */}
              {!locked && word.patterns.length > 1 && (
                <div className="flex flex-wrap justify-center" style={{ gap: 6 }}>
                  {word.patterns.map((p, i) => (
                    <span key={i} style={{
                      fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
                      padding: "2px 8px", borderRadius: 5,
                      border: "1px solid rgba(255,255,255,0.14)",
                      color: "rgba(255,255,255,0.25)",
                      background: "rgba(255,255,255,0.04)",
                      textTransform: "uppercase",
                    }}>{p}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 打ち込み中 */}
          <div style={{ height: 36, display: "flex", alignItems: "center",
            fontFamily: "'JetBrains Mono',monospace", fontSize: 22, fontWeight: 700,
            letterSpacing: "0.08em", textTransform: "uppercase",
            color: miss ? "#ff2d78" : "rgba(255,255,255,0.4)",
            transition: "color 0.15s" }}>
            {typed || <span style={{ color: "rgba(255,255,255,0.15)", textTransform: "none" }}>─</span>}
            <span style={{ color: "#00f5ff", animation: "blink 1.2s ease-in-out infinite" }}>▌</span>
          </div>
        </div>
      )}

      {/* ===== 結果画面 ===== */}
      {phase === "result" && (
        <div className="flex flex-col items-center z-10" style={{ gap: 16, animation: "slideUp 0.4s ease forwards" }}>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, letterSpacing: "0.25em" }}
            className="uppercase font-rounded">Result</p>

          <div className="font-rounded font-black tabular-nums leading-none"
            style={{ fontSize: "clamp(7rem,20vw,10rem)", color: "#00f5ff",
              textShadow: "0 0 40px #00f5ff, 0 0 80px rgba(0,245,255,0.4)" }}>
            {score}
          </div>
          <p className="font-rounded font-black" style={{ fontSize: 28, marginTop: -8, color: "#ffffff" }}>
            こ　クリア！
          </p>

          {isNewBest && (
            <p className="font-rounded font-black" style={{ fontSize: 22, color: "#ffe620",
              textShadow: "0 0 18px rgba(255,230,32,0.6)",
              animation: "blink 1.5s ease-in-out infinite" }}>
              🏆　新記録！
            </p>
          )}

          <p className="font-rounded" style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
            ベスト&nbsp;
            <span style={{ color: "#ffe620", fontSize: 18, fontWeight: 900 }}>{best}</span>
            &nbsp;こ
          </p>

          <button onClick={startGame}
            className="font-rounded font-black text-white"
            style={{
              marginTop: 8, padding: "16px 56px", borderRadius: 18, fontSize: 22,
              border: "none", cursor: "pointer",
              background: "linear-gradient(135deg,#ff2d78,#bf5fff)",
              boxShadow: "0 0 40px rgba(255,45,120,0.3), 0 0 80px rgba(191,95,255,0.15)",
            }}>
            もういちど！
          </button>

          <p className="font-rounded" style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>
            <kbd style={{ padding: "2px 8px", border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 5, background: "rgba(255,255,255,0.06)",
              fontFamily: "monospace", color: "rgba(255,255,255,0.3)" }}>Space</kbd>
            　でもリトライできます
          </p>

          {/* ベストリセット */}
          {best > 0 && (
            <button
              onClick={() => {
                localStorage.removeItem("futamoji-best");
                setBest(0);
              }}
              className="font-rounded"
              style={{
                marginTop: 4, padding: "6px 20px", borderRadius: 10, fontSize: 12,
                color: "rgba(255,255,255,0.3)", cursor: "pointer",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.12)",
              }}>
              ベストをリセット
            </button>
          )}
        </div>
      )}

      {/* アニメーション定義 */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(24px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes popIn {
          0%   { transform: scale(0.45) rotate(-8deg); opacity: 1; }
          70%  { transform: scale(1.09) rotate(2deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes cdPop {
          0%   { transform: scale(1.6); opacity: 0; }
          30%  { transform: scale(1);   opacity: 1; }
          80%  { transform: scale(1);   opacity: 1; }
          100% { transform: scale(0.8); opacity: 0; }
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%     { transform: translateX(-10px); }
          40%     { transform: translateX(10px); }
          60%     { transform: translateX(-6px); }
          80%     { transform: translateX(6px); }
        }
        @keyframes blink {
          0%,100% { opacity: 1; }
          50%     { opacity: 0.1; }
        }
        @keyframes floatOrb {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-20px); }
        }
        @keyframes particleUp {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-60px) scale(0.4); opacity: 0; }
        }
        .font-rounded { font-family: 'M PLUS Rounded 1c', sans-serif; }
      `}</style>
    </div>
  );
}
