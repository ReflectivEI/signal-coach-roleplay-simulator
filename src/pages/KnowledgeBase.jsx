import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, Sparkles, Send, Copy, Wand2, Loader2, Zap, BookOpen, MessageCircle, ChevronDown, ChevronUp, Users, Heart, Plus, Trophy } from "lucide-react";
import NavPill from "@/components/ui/NavPill";
import { SIGNAL_CAPABILITIES } from "@/components/roleplay/signalIntelligenceSOT";

const communicationTemplates = [
  { title: "Feel-Felt-Found", capability: "objection_navigation", content: "I understand how you feel. Other physicians have felt the same way. What they've found is that [benefit/outcome]." },
  { title: "Acknowledge-Bridge-Close", capability: "commitment_generation", content: "That's an important consideration. [Acknowledge]. What we've seen is [bridge to benefit]. How would [closing question]?" },
  { title: "Problem-Agitate-Solve", capability: "value_connection", content: "Many physicians struggle with [problem]. This leads to [negative impact]. [Your solution] addresses this by [benefit]." },
  { title: "Before-After-Bridge", capability: "value_connection", content: "Before [your solution], patients experienced [challenge]. After, they [improved outcome]. The bridge is [your specific benefit]." },
  { title: "Assumptive Next Step", capability: "commitment_generation", content: "Based on what we've discussed, would it make sense to [specific next action]? I can [support offer]." },
  { title: "Trial Close with Options", capability: "commitment_generation", content: "Would you prefer to start with [option A] or [option B]? Either way, I'll ensure [support commitment]." },
];

// Build capability labels from SOT
const CAPABILITY_LABELS = Object.fromEntries(
  SIGNAL_CAPABILITIES.map(cap => [cap.id, cap.label])
);

const SNIPPET_CATEGORIES = [
  { id: "all", label: "All" },
  { id: "objection_handling", label: "Objection Handling" },
  { id: "opening_line", label: "Opening Lines" },
  { id: "value_framing", label: "Value Framing" },
  { id: "commitment_gaining", label: "Commitment Gaining" },
  { id: "listening_response", label: "Listening & Response" },
];

const articles = [
  { id: "fda-approval", title: "FDA Drug Approval Process Overview", desc: "Understanding the FDA's drug approval pathway from preclinical testing through post-market surveillance", tags: ["FDA", "drug approval", "clinical trials"], category: "FDA", content: "The FDA drug approval process includes preclinical testing, Phase 1-3 clinical trials, NDA/BLA review, and post-marketing surveillance. Phase 1 tests safety in 20-100 healthy volunteers. Phase 2 assesses efficacy in 100-500 patients. Phase 3 confirms efficacy in 1,000-5,000 patients. The NDA review takes 10-12 months with priority review available for breakthrough therapies." },
  { id: "clinical-design", title: "Clinical Trial Design Fundamentals", desc: "Core concepts in clinical trial design that every pharma professional should understand", tags: ["clinical trials", "RCT", "endpoints"], category: "Clinical Trials", content: "Randomized controlled trials (RCTs) are the gold standard for establishing causality. Key elements include blinding (single, double, open-label), control types (placebo, active comparator, standard of care), and endpoints (primary, secondary, exploratory). Statistical considerations include p-value, confidence interval, hazard ratio, and number needed to treat." },
  { id: "hipaa-basics", title: "HIPAA Compliance for Pharma Sales", desc: "Essential HIPAA knowledge for maintaining compliance in pharmaceutical sales interactions", tags: ["HIPAA", "compliance", "privacy"], category: "Compliance", content: "HIPAA protects individually identifiable health information (PHI). Sales reps must follow the minimum necessary standard, maintain business associate agreements, and implement security safeguards. Never request specific patient information, avoid looking at patient charts, be careful with sample signature logs, and maintain confidentiality of any incidental PHI exposure." },
  { id: "hcp-engagement", title: "HCP Engagement Best Practices", desc: "Guidelines for effective and compliant healthcare provider engagement", tags: ["HCP", "engagement", "compliance"], category: "HCP", content: "Effective HCP engagement requires pre-call planning (researching specialty, reviewing publications, understanding practice dynamics), leading with value during interactions, listening more than speaking, and respecting time constraints. Compliance considerations include speaker program guidelines, proper sample documentation, Sunshine Act reporting, and following virtual engagement protocols." },
  { id: "market-access", title: "Understanding Payer Dynamics", desc: "Key concepts in market access and payer navigation for pharmaceutical products", tags: ["payers", "formulary", "market access"], category: "Market Access", content: "Payer types include commercial payers (national insurers, regional health plans, self-insured employers) and government payers (Medicare Part D, Medicaid, VA). Formulary tiers range from Tier 1 generic to specialty tier. Access barriers include prior authorization, step therapy, quantity limits, and site of care restrictions. Value demonstration requires clinical differentiation, pharmacoeconomic data, real-world evidence, and patient outcomes." },
  { id: "pricing-transparency", title: "Drug Pricing and Transparency", desc: "Navigate drug pricing conversations with clarity and confidence", tags: ["pricing", "transparency", "WAC"], category: "Market Access", content: "Key pricing terms: WAC (Wholesale Acquisition Cost) is the manufacturer's list price. AWP (Average Wholesale Price) is WAC plus markup. ASP (Average Sales Price) is used for Medicare Part B reimbursement. Discounts include Medicaid rebates, commercial rebates, 340B pricing, and patient assistance programs. Transparency requirements include Sunshine Act reporting and state pricing laws. Frame cost conversations around total cost of care, avoided hospitalizations, quality of life improvements, and long-term outcomes." },
];

const categories = ["All", "FDA", "Clinical Trials", "Compliance", "HCP", "Market Access"];

const SUMMARY_LENGTHS = [
  { id: "brief", label: "Brief" },
  { id: "standard", label: "Standard" },
  { id: "detailed", label: "Detailed" },
];

export default function KnowledgeBase() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeTab, setActiveTab] = useState("articles");
  const [searchQuery, setSearchQuery] = useState("");
  const [aiQuery, setAiQuery] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiSourceArticles, setAiSourceArticles] = useState([]);
  const [isAsking, setIsAsking] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [customizeTemplate, setCustomizeTemplate] = useState(null);
  const [customizeInputs, setCustomizeInputs] = useState({ product: "", patientType: "", challenge: "" });
  const [customizedContent, setCustomizedContent] = useState("");
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [summarizingIdx, setSummarizingIdx] = useState(null);
  const [articleSummaries, setArticleSummaries] = useState({});
  const [summaryLengths, setSummaryLengths] = useState({});
  const [followUpIdx, setFollowUpIdx] = useState(null);
  const [followUpQueries, setFollowUpQueries] = useState({});
  const [followUpAnswers, setFollowUpAnswers] = useState({});
  const [isFollowingUp, setIsFollowingUp] = useState({});
  const [expandedSummaries, setExpandedSummaries] = useState({});
  // Template Ask AI
  const [templateAiQuery, setTemplateAiQuery] = useState({});
  const [templateAiAnswer, setTemplateAiAnswer] = useState({});
  const [templateAiLoading, setTemplateAiLoading] = useState({});
  // Peer Learning
  const [snippets, setSnippets] = useState([]);
  const [snippetCatFilter, setSnippetCatFilter] = useState("all");
  const [showShareForm, setShowShareForm] = useState(false);
  const [shareForm, setShareForm] = useState({ title: "", content: "", capability: "", category: "objection_handling", disease_state: "", context: "" });
  const [sharing, setSharing] = useState(false);
  const [upvoted, setUpvoted] = useState({});
  const [templateAiOpen, setTemplateAiOpen] = useState({});

  const filteredArticles = articles.filter((a) => {
    const catMatch = activeCategory === "All" || a.category === activeCategory;
    const searchMatch = !searchQuery || a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return catMatch && searchMatch;
  });

  const filteredSnippets = snippets.filter(s =>
    snippetCatFilter === "all" || s.category === snippetCatFilter
  );

  const curatedSnippets = snippets.filter(s => s.curated);

  useEffect(() => {
    // Fetch snippets from Cloudflare Worker backend
    fetch('/api/snippets')
      .then(res => res.json())
      .then(data => setSnippets(Array.isArray(data.snippets) ? data.snippets : []))
      .catch(err => {
        console.error('Failed to fetch snippets:', err);
        setSnippets([]);
      });
  }, []);

  const askAI = async () => {
    if (!aiQuery.trim()) return;
    setIsAsking(true);
    setAiAnswer("");
    setAiSourceArticles([]);
    try {
      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiQuery })
      });
      const data = await res.json();
      setAiAnswer(data.response || data.text || data.content || '');
    } catch {
      setAiAnswer('AI service unavailable.');
    }
    setIsAsking(false);
  };

  const askTemplateAI = async (tmpl, idx) => {
    const query = templateAiQuery[idx]?.trim();
    if (!query) return;
    setTemplateAiLoading(prev => ({ ...prev, [idx]: true }));
    try {
      const prompt = `You are a sales coach helping a pharmaceutical representative understand and apply a communication template.

Template: "${tmpl.title}"
Template content: "${tmpl.content}"

User's question: "${query}"

Provide specific, practical guidance on how to use this template to address their question. Give concrete examples with real pharma context if relevant.`;
      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: 500 })
      });
      if (res.ok) {
        const data = await res.json();
        setTemplateAiAnswer(prev => ({ ...prev, [idx]: typeof data.response === 'string' ? data.response : String(data.response) }));
      }
    } catch (err) {
      console.error('Template AI error:', err);
    } finally {
      setTemplateAiLoading(prev => ({ ...prev, [idx]: false }));
    }
  };

  const copyTemplate = (content, idx) => {
    navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const openCustomize = (template) => {
    setCustomizeTemplate(template);
    setCustomizedContent("");
    setCustomizeInputs({ product: "", patientType: "", challenge: "" });
    setCustomizeOpen(true);
  };

  const personalizeTemplate = async () => {
    if (!customizeInputs.product || !customizeInputs.patientType || !customizeInputs.challenge) return;
    setIsCustomizing(true);
    try {
      const prompt = `Adapt this sales communication template for specific context:

Original template: "${customizeTemplate.content}"

Context:
- Product: ${customizeInputs.product}
- Patient type: ${customizeInputs.patientType}
- Challenge: ${customizeInputs.challenge}

Provide a personalized version of this template that incorporates these specific details. Keep it natural, conversational, and compliant. Focus on observable patient/HCP benefits.`;
      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: 500 })
      });
      if (res.ok) {
        const data = await res.json();
        setCustomizedContent(typeof data.response === 'string' ? data.response : String(data.response));
      }
    } catch (err) {
      console.error('Template personalization error:', err);
    } finally {
      setIsCustomizing(false);
    }
  };

  const summarizeArticle = async (articleIdx, lengthOverride) => {
    const length = lengthOverride || summaryLengths[articleIdx] || "brief";
    setSummarizingIdx(articleIdx);
    try {
      const article = articles[articleIdx];
      const lengthInstructions = {
        brief: "Provide a 2-3 sentence summary",
        standard: "Provide a 1-paragraph summary",
        detailed: "Provide a 2-3 paragraph detailed summary"
      };
      const prompt = `Summarize this article for a pharmaceutical sales professional:

Title: "${article.title}"
Content: ${article.content}

${lengthInstructions[length] || lengthInstructions.brief}

Focus on practical applications and relevance to sales professionals. Include key takeaways.`;
      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: length === 'detailed' ? 800 : 400 })
      });
      if (res.ok) {
        const data = await res.json();
        setArticleSummaries(prev => ({ ...prev, [articleIdx]: { text: typeof data.response === 'string' ? data.response : String(data.response), length } }));
      }
    } catch (err) {
      console.error('Article summarization error:', err);
    } finally {
      setSummarizingIdx(null);
    }
  };

  const handleFollowUp = async (articleIdx) => {
    const query = followUpQueries[articleIdx];
    if (!query?.trim()) return;
    setIsFollowingUp(prev => ({ ...prev, [articleIdx]: true }));
    try {
      const article = articles[articleIdx];
      const prompt = `Answer this follow-up question about the article "${article.title}":

Article content: ${article.content}

Follow-up question: "${query}"

Provide a detailed, practical answer relevant to pharmaceutical sales professionals. Connect the answer back to real-world sales situations where applicable.`;
      const res = await fetch('/api/llm/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, max_tokens: 600 })
      });
      if (res.ok) {
        const data = await res.json();
        setFollowUpAnswers(prev => ({ ...prev, [articleIdx]: typeof data.response === 'string' ? data.response : String(data.response) }));
      }
    } catch (err) {
      console.error('Follow-up question error:', err);
    } finally {
      setIsFollowingUp(prev => ({ ...prev, [articleIdx]: false }));
    }
  };

  const injectToQA = (articleTitle) => {
    setAiQuery(`Tell me more about ${articleTitle} and how it applies to pharma sales`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const shareSnippet = async () => {
    if (!shareForm.title || !shareForm.content || !shareForm.capability) return;
    setSharing(true);
    try {
      // In real implementation would POST to backend
      const newSnippet = {
        id: `custom_${Date.now()}`,
        ...shareForm,
        upvotes: 0,
        createdAt: new Date().toLocaleString()
      };
      // Add to knowledge base (in real app would persist to backend)
      console.log('Snippet shared:', newSnippet);
      setShareForm({ title: "", content: "", capability: "" });
      setSharedAlert(true);
      setTimeout(() => setSharedAlert(false), 3000);
    } catch (err) {
      console.error('Share snippet error:', err);
    } finally {
      setSharing(false);
    }
  };

  const upvoteSnippet = async (snippet) => {
    if (upvoted[snippet.id]) return;
    try {
      // In real implementation would POST to backend
      setUpvoted(prev => ({ ...prev, [snippet.id]: true }));
      console.log('Upvoted snippet:', snippet.id);
    } catch (err) {
      console.error('Upvote error:', err);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
        <p className="text-sm text-gray-600 mt-1">Industry guides, communication templates, and peer-shared best practices</p>
      </div>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: "Curated Articles", value: articles.length, tone: "bg-teal-50 border-teal-200 text-teal-800" },
          { label: "Communication Templates", value: communicationTemplates.length, tone: "bg-slate-50 border-slate-200 text-slate-800" },
          { label: "Signal Intelligence Capabilities", value: SIGNAL_CAPABILITIES.length, tone: "bg-amber-50 border-amber-200 text-amber-800" },
        ].map((item) => (
          <div key={item.label} className={`rounded-xl border px-4 py-3 ${item.tone}`}>
            <p className="text-xs uppercase tracking-wide font-semibold opacity-80">{item.label}</p>
            <p className="text-2xl font-bold mt-1">{item.value}</p>
          </div>
        ))}
      </div>

      {/* AI Q&A */}
      <Card className="mb-8 border-teal-100">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-500" />
            <span className="font-semibold text-sm">AI-Powered Q&A</span>
            <span className="text-xs text-gray-500 ml-1">— synthesizes across all articles</span>
          </div>
          <div className="flex gap-2">
            <Input value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder="Ask about FDA approval, compliance, payer dynamics, HCP engagement..." onKeyDown={(e) => e.key === "Enter" && askAI()} className="text-sm" />
            <Button onClick={askAI} disabled={isAsking} className="bg-teal-500 hover:bg-teal-600 text-white flex-shrink-0">
              {isAsking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          {aiAnswer && (
            <div className="space-y-3">
              {aiSourceArticles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-xs text-gray-500">Sources:</span>
                  {aiSourceArticles.map(t => <span key={t} className="text-xs px-2 py-0.5 rounded-full border border-teal-200 text-teal-700 bg-teal-50">{t}</span>)}
                </div>
              )}
              <div className="p-5 bg-teal-50 border border-teal-100 rounded-lg">
                <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed space-y-3"><ReactMarkdown>{aiAnswer}</ReactMarkdown></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Tabs — NavPill style */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { id: "articles", icon: BookOpen, label: "Articles" },
          { id: "templates", icon: Wand2, label: "Templates" },
          { id: "peer", icon: Users, label: "Peer Best Practices" },
        ].map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`inline-flex items-center gap-1.5 rounded-full border font-semibold transition-all duration-200 text-xs px-3 py-1 ${activeTab === id
              ? "border-[#39ACAC] text-[#39ACAC] bg-[#e6f7f7]"
              : "border-[#1A334D] text-[#1A334D] bg-white hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7]"
              }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* ── ARTICLES TAB ── */}
      {activeTab === "articles" && (
        <>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search articles, topics, or tags..." className="pl-10" />
          </div>
          <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mb-6">
            <TabsList className="bg-transparent flex-wrap h-auto gap-2 p-0">
              {categories.map((cat) => <TabsTrigger key={cat} value={cat} className="text-sm px-4 py-2 rounded-full border border-[#1A334D] hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7] data-[state=active]:bg-[#39ACAC] data-[state=active]:text-white data-[state=active]:border-[#1A334D]">{cat}</TabsTrigger>)}
            </TabsList>
          </Tabs>
          <div className="space-y-4">
            {filteredArticles.map((article, idx) => (
              <Card key={article.title} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 space-y-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">{article.title}</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">{article.desc}</p>
                  </div>
                  {articleSummaries[idx] && expandedSummaries[idx] && (
                    <div className="bg-teal-50 border border-teal-100 rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-teal-700 uppercase tracking-wide">{articleSummaries[idx].length} Summary</span>
                        <button onClick={() => setExpandedSummaries(prev => ({ ...prev, [idx]: false }))} className="text-gray-400 hover:text-gray-600"><ChevronUp className="w-3 h-3" /></button>
                      </div>
                      <div className="prose prose-sm max-w-none text-gray-700 text-sm leading-relaxed"><ReactMarkdown>{articleSummaries[idx].text}</ReactMarkdown></div>
                      {(followUpAnswers[idx] || []).map((qa, qIdx) => (
                        <div key={qIdx} className="mt-3 space-y-2 border-t border-teal-100 pt-3">
                          <p className="text-xs font-medium text-gray-600">Q: {qa.q}</p>
                          <div className="prose prose-sm max-w-none text-gray-700 text-xs leading-relaxed"><ReactMarkdown>{qa.a}</ReactMarkdown></div>
                        </div>
                      ))}
                      {followUpIdx === idx ? (
                        <div className="flex gap-2 mt-3 pt-2 border-t border-teal-100">
                          <Input value={followUpQueries[idx] || ""} onChange={(e) => setFollowUpQueries(prev => ({ ...prev, [idx]: e.target.value }))} placeholder="Ask a follow-up question..." className="text-xs h-8" onKeyDown={(e) => e.key === "Enter" && handleFollowUp(idx)} />
                          <Button size="sm" className="h-8 bg-teal-500 hover:bg-teal-600 text-white flex-shrink-0" onClick={() => handleFollowUp(idx)} disabled={isFollowingUp[idx]}>
                            {isFollowingUp[idx] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          </Button>
                        </div>
                      ) : (
                        <NavPill onClick={() => setFollowUpIdx(idx)} className="mt-1"><MessageCircle className="w-3 h-3" /> Ask a follow-up</NavPill>
                      )}
                    </div>
                  )}
                  {articleSummaries[idx] && !expandedSummaries[idx] && (
                    <NavPill onClick={() => setExpandedSummaries(prev => ({ ...prev, [idx]: true }))}><ChevronDown className="w-3 h-3" /> Show summary</NavPill>
                  )}
                  <div className="flex gap-1.5 flex-wrap">
                    {article.tags.map((tag) => <span key={tag} className="text-xs px-2 py-0.5 rounded-full border border-gray-200 text-gray-600 bg-gray-50">{tag}</span>)}
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <div className="flex items-center gap-1 border rounded-md overflow-hidden">
                      {SUMMARY_LENGTHS.map(({ id, label }) => (
                        <button key={id} onClick={() => setSummaryLengths(prev => ({ ...prev, [idx]: id }))} className={`text-xs px-2 py-1 transition-colors ${(summaryLengths[idx] || "brief") === id ? "bg-teal-500 text-white" : "text-gray-600 hover:bg-gray-50"}`}>{label}</button>
                      ))}
                    </div>
                    <NavPill
                      onClick={() => summarizeArticle(idx)}
                      className={`flex-1 justify-center ${summarizingIdx === idx ? "opacity-60 pointer-events-none" : ""}`}
                    >
                      {summarizingIdx === idx ? <><Loader2 className="w-3 h-3 animate-spin" /> Summarizing...</> : <><Zap className="w-3 h-3" /> Summarize</>}
                    </NavPill>
                    <NavPill onClick={() => injectToQA(article.title)}><Sparkles className="w-3 h-3" /> Ask AI</NavPill>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ── TEMPLATES TAB ── */}
      {activeTab === "templates" && (
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-1">Communication Templates</h2>
          <p className="text-sm text-gray-600 mb-6">Proven conversation frameworks. Use AI to personalize or ask questions about how to apply them.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {communicationTemplates.map((tmpl, idx) => (
              <Card key={tmpl.title} className="hover:border-teal-200 hover:shadow-md transition-all">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-sm text-gray-900">{tmpl.title}</h4>
                    {tmpl.capability && <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "#e6f7f7", color: "#1A334D", border: "1px solid #b2e4e4" }}>{CAPABILITY_LABELS[tmpl.capability]}</span>}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg">{tmpl.content}</p>
                  <div className="flex gap-2">
                    <NavPill onClick={() => openCustomize(tmpl)}><Wand2 className="w-3 h-3" /> Customize</NavPill>
                    <NavPill onClick={() => copyTemplate(tmpl.content, idx)}><Copy className="w-3 h-3" />{copiedIdx === idx ? "Copied!" : "Copy"}</NavPill>
                  </div>
                  {/* Ask AI about this template */}
                  <div className="border-t border-gray-100 pt-3">
                    <NavPill onClick={() => setTemplateAiOpen(prev => ({ ...prev, [idx]: !prev[idx] }))}>
                      <Sparkles className="w-3 h-3" /> Ask AI about this template
                      {templateAiOpen[idx] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </NavPill>
                    {templateAiOpen[idx] && (
                      <div className="mt-2 space-y-2">
                        <div className="flex gap-2">
                          <Input value={templateAiQuery[idx] || ""} onChange={e => setTemplateAiQuery(prev => ({ ...prev, [idx]: e.target.value }))} placeholder="e.g. When should I use this? How do I adapt it for objections?" className="text-xs h-8" onKeyDown={e => e.key === "Enter" && askTemplateAI(tmpl, idx)} />
                          <Button size="sm" className="h-8 bg-teal-500 hover:bg-teal-600 text-white flex-shrink-0 px-2" onClick={() => askTemplateAI(tmpl, idx)} disabled={templateAiLoading[idx]}>
                            {templateAiLoading[idx] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          </Button>
                        </div>
                        {templateAiAnswer[idx] && (
                          <div className="bg-teal-50 border border-teal-100 rounded-lg p-3">
                            <p className="text-xs text-gray-700 leading-relaxed">{templateAiAnswer[idx]}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── PEER BEST PRACTICES TAB ── */}
      {activeTab === "peer" && (
        <div className="space-y-6">
          {/* Header + Share */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Peer Best Practices</h2>
              <p className="text-sm text-gray-600">Anonymously shared winning communication snippets from your team. Curated by managers.</p>
            </div>
            <Button size="sm" className="bg-teal-500 hover:bg-teal-600 flex-shrink-0" onClick={() => setShowShareForm(v => !v)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Share a Snippet
            </Button>
          </div>

          {/* Share Form */}
          {showShareForm && (
            <Card className="border-teal-200">
              <CardContent className="p-5 space-y-3">
                <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2"><Users className="w-4 h-4 text-teal-500" /> Share Anonymously</h3>
                <Input value={shareForm.title} onChange={e => setShareForm(p => ({ ...p, title: e.target.value }))} placeholder="Title (e.g. 'Handling the formulary objection')" className="text-sm" />
                <Textarea value={shareForm.content} onChange={e => setShareForm(p => ({ ...p, content: e.target.value }))} placeholder="Share the exact language, approach, or strategy that worked..." className="text-sm min-h-[100px]" />
                <div className="grid grid-cols-2 gap-3">
                  <select value={shareForm.capability} onChange={e => setShareForm(p => ({ ...p, capability: e.target.value }))} className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-400">
                    <option value="">Select Capability</option>
                    {Object.entries(CAPABILITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <select value={shareForm.category} onChange={e => setShareForm(p => ({ ...p, category: e.target.value }))} className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-400">
                    {SNIPPET_CATEGORIES.filter(c => c.id !== "all").map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <Input value={shareForm.context} onChange={e => setShareForm(p => ({ ...p, context: e.target.value }))} placeholder="Context: when/where did this work? (optional)" className="text-sm" />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setShowShareForm(false)}>Cancel</Button>
                  <Button size="sm" className="bg-teal-500 hover:bg-teal-600" onClick={shareSnippet} disabled={!shareForm.title || !shareForm.content || !shareForm.capability || sharing}>
                    {sharing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <><Plus className="w-3.5 h-3.5 mr-1" /></>}Share Anonymously
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Curated by Manager */}
          {curatedSnippets.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-gray-900">Manager Curated</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">{curatedSnippets.length} featured</span>
              </div>
              <div className="space-y-3">
                {curatedSnippets.map(snippet => (
                  <SnippetCard key={snippet.id} snippet={snippet} upvoted={upvoted[snippet.id]} onUpvote={() => upvoteSnippet(snippet)} curated />
                ))}
              </div>
            </div>
          )}

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {SNIPPET_CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setSnippetCatFilter(cat.id)} className={`text-sm px-4 py-2 rounded-full border font-semibold transition-all hover:-translate-y-0.5 ${snippetCatFilter === cat.id ? "border-[#1A334D] text-white" : "border-[#1A334D] text-[#1A334D] bg-white hover:border-[#39ACAC] hover:text-[#39ACAC] hover:bg-[#e6f7f7]"}`} style={snippetCatFilter === cat.id ? { background: "#39ACAC" } : {}}>
                {cat.label}
              </button>
            ))}
          </div>

          {/* Snippet List */}
          {filteredSnippets.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-600">No snippets yet</p>
              <p className="text-xs text-gray-500 mt-1">Be the first to share a winning communication strategy</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSnippets.map(snippet => (
                <SnippetCard key={snippet.id} snippet={snippet} upvoted={upvoted[snippet.id]} onUpvote={() => upvoteSnippet(snippet)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Customize Dialog */}
      <Dialog open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Customize "{customizeTemplate?.title}"</DialogTitle>
            <DialogDescription>Provide details to personalize this template with AI</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium text-gray-700 block mb-1">Product Name</label><Input value={customizeInputs.product} onChange={(e) => setCustomizeInputs({ ...customizeInputs, product: e.target.value })} placeholder="e.g., DrugName™" /></div>
            <div><label className="text-sm font-medium text-gray-700 block mb-1">Target Patient Type</label><Input value={customizeInputs.patientType} onChange={(e) => setCustomizeInputs({ ...customizeInputs, patientType: e.target.value })} placeholder="e.g., Patients with moderate symptoms" /></div>
            <div><label className="text-sm font-medium text-gray-700 block mb-1">Specific Challenge</label><Input value={customizeInputs.challenge} onChange={(e) => setCustomizeInputs({ ...customizeInputs, challenge: e.target.value })} placeholder="e.g., Side effect concerns" /></div>
            {customizedContent && (
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-teal-900 mb-2">Personalized Version</p>
                <p className="text-sm text-gray-700 leading-relaxed mb-3">{customizedContent}</p>
                <Button variant="outline" size="sm" className="text-xs w-full" onClick={() => { navigator.clipboard.writeText(customizedContent); setCopiedIdx("customized"); setTimeout(() => setCopiedIdx(null), 2000); }}>
                  <Copy className="w-3 h-3 mr-1" />{copiedIdx === "customized" ? "Copied!" : "Copy to Clipboard"}
                </Button>
              </div>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setCustomizeOpen(false)}>Cancel</Button>
              <Button className="bg-teal-500 hover:bg-teal-600" onClick={personalizeTemplate} disabled={!customizeInputs.product || !customizeInputs.patientType || !customizeInputs.challenge || isCustomizing}>
                {isCustomizing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
                {isCustomizing ? "Personalizing..." : "Personalize"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SnippetCard({ snippet, upvoted, onUpvote, curated }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(snippet.content); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <Card className={`transition-all hover:shadow-md ${curated ? "border-amber-200 bg-amber-50/30" : "border-gray-100"}`}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-sm text-gray-900">{snippet.title}</h4>
            {curated && <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 flex items-center gap-1 font-medium"><Trophy className="w-2.5 h-2.5" /> Curated</span>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {snippet.capability && <span className="text-xs px-2 py-0.5 rounded-full hidden sm:block" style={{ background: "#e6f7f7", color: "#1A334D", border: "1px solid #b2e4e4" }}>{snippet.capability.replace(/_/g, " ")}</span>}
          </div>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed bg-white border border-gray-100 rounded-lg p-3">{snippet.content}</p>
        {snippet.context && <p className="text-xs text-gray-500 italic">{snippet.context}</p>}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            <button onClick={onUpvote} disabled={upvoted} className={`flex items-center gap-1 text-xs font-medium transition-colors ${upvoted ? "text-teal-600" : "text-gray-400 hover:text-teal-600"}`}>
              <Heart className={`w-3.5 h-3.5 ${upvoted ? "fill-teal-500 text-teal-500" : ""}`} />
              {snippet.upvotes || 0}
            </button>
            <span className="text-xs text-gray-400">{snippet.shared_by_role || "Anonymous Rep"}</span>
          </div>
          <NavPill onClick={copy}><Copy className="w-3 h-3" />{copied ? "Copied!" : "Copy"}</NavPill>
        </div>
      </CardContent>
    </Card>
  );
}
