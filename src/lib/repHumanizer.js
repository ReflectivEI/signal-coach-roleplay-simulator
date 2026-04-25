function normalizeText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function splitSentences(text = "") {
  return normalizeText(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function shortenLongSentence(sentence = "") {
  const words = normalizeText(sentence).split(" ").filter(Boolean);
  if (words.length <= 20) return normalizeText(sentence);

  const splitIndex = words.findIndex((word, index) =>
    index > 8 && /(because|so|instead|and|but)$/i.test(word.replace(/[,.!?]/g, ""))
  );

  if (splitIndex === -1) {
    return normalizeText(sentence);
  }

  const first = words.slice(0, splitIndex + 1).join(" ").replace(/[,:;]+$/, "");
  const second = words.slice(splitIndex + 1).join(" ");
  if (!first || !second) return normalizeText(sentence);

  return `${first}. ${second.charAt(0).toUpperCase()}${second.slice(1)}`;
}

function addCadenceLead(text = "", context = {}) {
  const normalized = normalizeText(text);
  if (!normalized) return normalized;
  if (/^(honestly|the main thing is|where it changes is|in practice|so what actually changes is)\b/i.test(normalized)) {
    return normalized;
  }

  const hcpTurn = String(context?.hcpTurn || "").toLowerCase();
  if (/what changes|what specifically|what'?s different|what does that change|what happens after/i.test(hcpTurn)) {
    return `The main difference is ${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`;
  }
  if (/how does that work|what do i do differently|implementation|workflow/i.test(hcpTurn)) {
    return `In practice, ${normalized.charAt(0).toLowerCase()}${normalized.slice(1)}`;
  }
  return normalized;
}

export function humanizeRepResponse(text = "", context = {}) {
  let output = normalizeText(text);
  if (!output) return output;

  output = output
    .replace(/^What happens instead is\b/i, "So what actually changes is")
    .replace(/^The specific change is\b/i, "The main difference is")
    .replace(/^What changes is\b/i, "So what actually changes is")
    .replace(/^The direct answer is\b/i, "The main thing is")
    .replace(/\bimproves efficiency\b/gi, "cuts down the extra office work")
    .replace(/\breduces burden\b/gi, "cuts down the repeat work")
    .replace(/\breduces callbacks\b/gi, "cuts down the callback loop")
    .replace(/\s+([.?!,])/g, "$1")
    .trim();

  output = addCadenceLead(output, context);

  const sentences = splitSentences(output).map((sentence) => shortenLongSentence(sentence));
  output = normalizeText(sentences.join(" "));

  if (output && !/[.?!]$/.test(output)) {
    output = `${output}.`;
  }

  return output;
}
