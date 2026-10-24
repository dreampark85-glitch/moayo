// 한국어 조사 보정 (순수). 받침 유무로 은/는·이/가·을/를·과/와·으로/로를 고른다.
export type JosaPair = '은/는' | '이/가' | '을/를' | '으로/로' | '과/와';

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const RIEUL = 8; // 종성 'ㄹ' 인덱스
// 숫자를 읽을 때 마지막 음절의 종성: 영·삼·육 = 받침, 일·칠·팔 = ㄹ받침, 그 외 없음
const DIGIT_BATCHIM: Record<string, number | null> = {
  '0': 21, '1': RIEUL, '2': null, '3': 16, '4': null, '5': null, '6': 1, '7': RIEUL, '8': RIEUL, '9': null,
};

/** 마지막 글자의 종성 인덱스 (없으면 null, 0이면 받침 없음) */
function finalConsonant(word: string): number | null {
  const last = word.trim().slice(-1);
  if (!last) return null;
  const code = last.charCodeAt(0);
  if (code >= HANGUL_BASE && code <= HANGUL_END) {
    const jong = (code - HANGUL_BASE) % 28;
    return jong === 0 ? null : jong;
  }
  if (last in DIGIT_BATCHIM) return DIGIT_BATCHIM[last];
  return null;
}

/** word에 받침 여부에 맞는 조사를 붙인 문자열 (예: withJosa('런지','은/는') → '런지는') */
export function withJosa(word: string, pair: JosaPair): string {
  const jong = finalConsonant(word);
  const has = jong !== null;
  switch (pair) {
    case '은/는':
      return `${word}${has ? '은' : '는'}`;
    case '이/가':
      return `${word}${has ? '이' : '가'}`;
    case '을/를':
      return `${word}${has ? '을' : '를'}`;
    case '과/와':
      return `${word}${has ? '과' : '와'}`;
    case '으로/로':
      return `${word}${has && jong !== RIEUL ? '으로' : '로'}`;
  }
}
