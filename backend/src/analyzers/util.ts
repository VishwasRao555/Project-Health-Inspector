import type { SourceFile } from "ts-morph";
import path from "path";
import type { AnalysisContext } from "../context/buildContext";

/** Absolute ts-morph file path -> posix path relative to the repo root. */
export function relPath(ctx: AnalysisContext, absPath: string): string {
  return path.relative(ctx.rootDir, absPath).split(path.sep).join("/");
}

/** True for files that live under common test/spec/story locations. */
export function isTestFile(rel: string): boolean {
  return /(\.test\.|\.spec\.|\.stories\.|__tests__\/|__mocks__\/)/.test(rel);
}

/** True for files that look like React component sources. */
export function looksLikeComponentFile(rel: string): boolean {
  return /\.(tsx|jsx)$/.test(rel);
}

/**
 * Common English/technical-writing misspellings. Deliberately a curated map (not a
 * full dictionary) so detection stays deterministic and free of false positives on
 * code identifiers, brand names, and jargon.
 */
export const COMMON_MISSPELLINGS: Record<string, string> = {
  recieve: "receive",
  recieved: "received",
  recieving: "receiving",
  seperate: "separate",
  seperated: "separated",
  seperately: "separately",
  occured: "occurred",
  occuring: "occurring",
  definately: "definitely",
  definatly: "definitely",
  accomodate: "accommodate",
  accomodation: "accommodation",
  acheive: "achieve",
  acheived: "achieved",
  arguement: "argument",
  begining: "beginning",
  calender: "calendar",
  cancelled: "canceled",
  collegue: "colleague",
  commited: "committed",
  commiting: "committing",
  comitted: "committed",
  concious: "conscious",
  curently: "currently",
  dependancy: "dependency",
  dependancies: "dependencies",
  enviroment: "environment",
  enviromental: "environmental",
  existance: "existence",
  extention: "extension",
  fimilar: "familiar",
  finaly: "finally",
  fucntion: "function",
  funtion: "function",
  functon: "function",
  goverment: "government",
  grammer: "grammar",
  guage: "gauge",
  helpfull: "helpful",
  hierachy: "hierarchy",
  hieght: "height",
  immediatly: "immediately",
  independant: "independent",
  initialise: "initialize",
  intialize: "initialize",
  intantiate: "instantiate",
  langauge: "language",
  lenght: "length",
  libary: "library",
  maintainance: "maintenance",
  maintenence: "maintenance",
  managable: "manageable",
  neccessary: "necessary",
  necesary: "necessary",
  noticable: "noticeable",
  occassion: "occasion",
  ocurrence: "occurrence",
  paramter: "parameter",
  paramater: "parameter",
  permanant: "permanent",
  posible: "possible",
  prefered: "preferred",
  proccess: "process",
  pronunciation: "pronunciation",
  publically: "publicly",
  recomend: "recommend",
  recommened: "recommend",
  refered: "referred",
  refering: "referring",
  relevent: "relevant",
  reponse: "response",
  responsability: "responsibility",
  responsibilty: "responsibility",
  retreive: "retrieve",
  retrun: "return",
  seperator: "separator",
  succesful: "successful",
  succesfully: "successfully",
  suprise: "surprise",
  syncronize: "synchronize",
  syncronous: "synchronous",
  tempory: "temporary",
  threshhold: "threshold",
  truely: "truly",
  unfortunatly: "unfortunately",
  untill: "until",
  usuage: "usage",
  utilites: "utilities",
  utilty: "utility",
  visable: "visible",
  wether: "whether",
  writting: "writing",
  recieves: "receives",
  thier: "their",
  teh: "the",
  adress: "address",
  alot: "a lot",
  becuase: "because",
};

export interface SpellingHit {
  word: string;
  suggestion: string;
  index: number;
}

/** Scans free-form text for words in the curated misspelling map. Case-insensitive. */
export function findSpellingMistakes(text: string): SpellingHit[] {
  const hits: SpellingHit[] = [];
  const re = /[A-Za-z]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const lower = m[0].toLowerCase();
    const suggestion = COMMON_MISSPELLINGS[lower];
    if (suggestion) hits.push({ word: m[0], suggestion, index: m.index });
  }
  return hits;
}

/** Line number (1-based) for a character offset within `text`. */
export function lineAt(text: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === "\n") line++;
  }
  return line;
}

/**
 * Extracts `{ text, line }` for every `//` and block comment in a source file by
 * scanning raw text while skipping over string/template literal contents. A small
 * hand-rolled scanner beats ts-morph's per-node comment APIs here since we want every
 * comment in the file, not just ones attached as trivia to a particular statement.
 */
export function commentsOf(sf: SourceFile): { text: string; line: number }[] {
  const text = sf.getFullText();
  const out: { text: string; line: number }[] = [];
  const n = text.length;
  let i = 0;
  while (i < n) {
    const ch = text[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < n && text[i] !== quote) {
        i += text[i] === "\\" ? 2 : 1;
      }
      i++;
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") {
      const start = i;
      while (i < n && text[i] !== "\n") i++;
      out.push({ text: text.slice(start, i), line: lineAt(text, start) });
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      const start = i;
      i += 2;
      while (i < n && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i = Math.min(i + 2, n);
      out.push({ text: text.slice(start, i), line: lineAt(text, start) });
      continue;
    }
    i++;
  }
  return out;
}

/** True when a `//` comment body looks like leftover commented-out code rather than prose. */
export function looksLikeCode(commentBody: string): boolean {
  const body = commentBody.trim();
  if (!body || /^[A-Z][\s\S]*[.!?]$/.test(body)) return false; // reads like a sentence
  return /[;{}()=]|^(const|let|var|function|if|for|while|return|import|export|class)\b/.test(body);
}
