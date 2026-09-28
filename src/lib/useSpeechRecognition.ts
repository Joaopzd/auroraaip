import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typings for the Web Speech API (not in the default TS DOM lib).
type SpeechResultLike = { 0: { transcript: string }; isFinal: boolean; length: number };
type SpeechEventLike = { results: ArrayLike<SpeechResultLike> };
type SpeechErrorLike = { error: string };
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechEventLike) => void) | null;
  onerror: ((e: SpeechErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => RecognitionLike;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Permita o uso do microfone nas configurações do navegador para falar com a Ditto.",
  "service-not-allowed": "Permita o uso do microfone nas configurações do navegador para falar com a Ditto.",
  "audio-capture": "Não encontrei um microfone neste aparelho.",
  network: "Sem conexão para reconhecer a voz. Verifique sua internet.",
  "no-speech": "Não ouvi nada. Toque no microfone e tente de novo.",
  "language-not-supported": "Este navegador não suporta reconhecimento de voz em português.",
};

type Options = {
  lang?: string;
  /** Called continuously with the text heard so far (interim + final). */
  onTranscript: (text: string) => void;
  /** Called once when listening ends normally, with the full text heard. */
  onFinish: (text: string) => void;
  onError: (message: string) => void;
};

export function useSpeechRecognition(options: Options) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);

  const optionsRef = useRef(options);
  optionsRef.current = options;
  const recRef = useRef<RecognitionLike | null>(null);
  const textRef = useRef("");
  const cancelledRef = useRef(false);

  // Checked after mount so server and client render the same HTML.
  useEffect(() => setSupported(getCtor() !== null), []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor || recRef.current) return;

    const rec = new Ctor();
    rec.lang = optionsRef.current.lang ?? "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    textRef.current = "";
    cancelledRef.current = false;
    let failed = false;

    rec.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript;
      textRef.current = text.trim();
      optionsRef.current.onTranscript(textRef.current);
    };

    rec.onerror = (event) => {
      if (event.error === "aborted") return;
      failed = true;
      const message = ERROR_MESSAGES[event.error];
      if (message) optionsRef.current.onError(message);
    };

    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      if (!failed && !cancelledRef.current) optionsRef.current.onFinish(textRef.current);
    };

    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      recRef.current = null;
      setListening(false);
    }
  }, []);

  /** Stop listening and deliver what was heard. */
  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  /** Stop listening and discard (no onFinish). */
  const cancel = useCallback(() => {
    if (!recRef.current) return;
    cancelledRef.current = true;
    recRef.current.abort();
  }, []);

  useEffect(() => () => {
    cancelledRef.current = true;
    recRef.current?.abort();
  }, []);

  return { supported, listening, start, stop, cancel };
}
