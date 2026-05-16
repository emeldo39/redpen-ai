import { useState, useRef, useEffect } from "react";

// ═══ LOGO (embedded) ═══════════════════════════════════════════════
// ═══ LOGO (embedded) ═══════════════════════════════════════════════
import LOGO_B64 from "./redpen-ai-logo-white.png";

// ═══ PROMPTS ═══════════════════════════════════════════════════════

const HUMANIZE_PROMPT = `You are a writing editor that removes AI-generated text patterns.

PATTERNS TO FIX: significance inflation, promotional language, copula avoidance (serves as/stands as), AI vocabulary (delve/tapestry/pivotal/crucial/foster/garner/align with/landscape), -ing phrase stacking, chatbot artifacts (Great question!/Let me know if..), rule of three, negative parallelism (It's not just X it's Y), em dash overuse, boldface overuse, emoji decorations, excessive hedging, generic conclusions, vague attributions, persuasive tropes (at its core/the real question is), signposting (Let's dive in), false ranges, filler phrases (in order to/it is important to note), synonym cycling.

PERSONALITY: Add genuine voice. Have opinions. Vary sentence rhythm. Use "I" when it fits. Be specific. Acknowledge complexity.

OUTPUT FORMAT — use EXACTLY these headers:
## DRAFT REWRITE
[first pass]
## AI AUDIT
[3-5 bullet points starting with • identifying remaining AI tells]
## FINAL REWRITE
[polished version]
## CHANGES MADE
[5-8 bullet points starting with • summarizing what was fixed]`;

const DETECT_PROMPT = `You are an AI writing detector. Score 0-100 (0-25=likely human, 26-50=mixed, 51-75=probably AI, 76-100=certainly AI).

Check CONTENT (significance inflation, promotional language, vague attributions), LANGUAGE (AI vocabulary: delve/tapestry/pivotal/crucial/foster/garner, copula avoidance, synonym cycling, rule of three, negative parallelism), STYLE (em dash overuse, boldface, emojis, title case headings), FILLER (filler phrases, excessive hedging, generic conclusions, signposting, chatbot artifacts).

Respond ONLY with valid JSON (no markdown):
{"score":<0-100>,"verdict":"<'likely_human'|'mixed'|'likely_ai'|'certainly_ai'>","summary":"<2-3 sentence assessment>","findings":[{"category":"<CONTENT|LANGUAGE|STYLE|FILLER>","pattern":"<name>","quote":"<exact phrase max 60 chars>","note":"<one sentence>"}],"clean_signals":["<1-3 human things>"]}
Return 4-10 findings.`;

const GRAMMAR_PROMPT = `You are a meticulous grammar and style editor. Error types: GRAMMAR, SPELLING, PUNCTUATION, STYLE, CLARITY. Score 0-100, grade A-F.

Respond ONLY with valid JSON (no markdown):
{"score":<0-100>,"grade":"<A|B|C|D|F>","error_count":<number>,"summary":"<2-sentence assessment>","errors":[{"type":"<GRAMMAR|SPELLING|PUNCTUATION|STYLE|CLARITY>","original":"<text max 80 chars>","corrected":"<fixed>","explanation":"<one sentence>"}],"corrected_text":"<full corrected text>","strengths":["<1-3 things done well>"]}`;

const PLAGIARISM_PROMPT = `You are an originality checker. Search the web for 3-5 distinctive phrases (10-20 words each) from the text.

Respond ONLY with valid JSON (no markdown):
{"originality_score":<0-100>,"risk_level":"<'low'|'medium'|'high'>","summary":"<2-3 sentence assessment>","matches":[{"phrase":"<max 80 chars>","found":<true|false>,"source":"<domain or null>","url":"<url or null>","note":"<one sentence>"}],"original_elements":["<1-3 original things>"],"disclaimer":"Web search covers publicly indexed content only. For academic submission, use a dedicated plagiarism database."}`;

function buildChatSystem(ctx) {
  return `You are a sharp writing coach and editor specializing in AI detection (29 patterns from Wikipedia's WikiProject AI Cleanup), grammar, originality, voice, tone, and rhetorical effectiveness. Be direct, specific, conversational. Give concrete rewrites when helpful. Use markdown for formatting.
${ctx ? `\n---\nUser's working text:\n\n${ctx}\n---` : ""}`;
}

// ═══ DATA ══════════════════════════════════════════════════════════

const SAMPLE = `In today's rapidly evolving technological landscape, artificial intelligence serves as a pivotal force reshaping the way we work and live. These groundbreaking tools—nestled at the intersection of innovation and practicality—are transforming industries, underscoring their vital role in modern workflows.

At its core, the value proposition is clear: AI enhances productivity, streamlines processes, and fosters collaboration. It's not just about automation; it's about unlocking human potential at scale, ensuring that organizations can remain agile while delivering seamless, intuitive experiences to users.

Industry observers have noted that adoption has accelerated from hobbyist experiments to enterprise-wide rollouts. Despite challenges typical of emerging technologies—including bias and accountability—the ecosystem continues to thrive.

In conclusion, the future looks bright. Exciting times lie ahead as we continue this journey toward excellence. Let me know if you'd like me to expand on any section!`;

const CAT_AI = {
  CONTENT:  {color:"#7C3AED",bg:"#FAF5FF",border:"#DDD6FE",label:"Content"},
  LANGUAGE: {color:"#B91C1C",bg:"#FEF2F2",border:"#FECACA",label:"Language"},
  STYLE:    {color:"#B45309",bg:"#FFFBEB",border:"#FDE68A",label:"Style"},
  FILLER:   {color:"#0369A1",bg:"#F0F9FF",border:"#BAE6FD",label:"Filler"},
};
const CAT_GRAMMAR = {
  GRAMMAR:     {color:"#B91C1C",bg:"#FEF2F2",border:"#FECACA",label:"Grammar"},
  SPELLING:    {color:"#7C3AED",bg:"#FAF5FF",border:"#DDD6FE",label:"Spelling"},
  PUNCTUATION: {color:"#B45309",bg:"#FFFBEB",border:"#FDE68A",label:"Punctuation"},
  STYLE:       {color:"#0369A1",bg:"#F0F9FF",border:"#BAE6FD",label:"Style"},
  CLARITY:     {color:"#065F46",bg:"#ECFDF5",border:"#A7F3D0",label:"Clarity"},
};

const NAV_TOOLS = [
  {id:"detect",    icon:"⊙", label:"AI Detect"},
  {id:"grammar",   icon:"✦", label:"Grammar"},
  {id:"plagiarism",icon:"◈", label:"Originality"},
  {id:"humanize",  icon:"✎", label:"Humanize"},
  {id:"chat",      icon:"◉", label:"AI Chat"},
];
const NAV_INFO = [
  {id:"about",    icon:"◎", label:"About"},
  {id:"pricing",  icon:"◐", label:"Pricing"},
  {id:"tips",     icon:"◆", label:"Tips"},
  {id:"faq",      icon:"◇", label:"FAQ"},
];

const getAIVerdictMeta = s => s<=25?{label:"Likely Human",color:"#166534",bg:"#F0FDF4",border:"#BBF7D0"}:s<=50?{label:"Mixed Signals",color:"#92400E",bg:"#FFFBEB",border:"#FDE68A"}:s<=75?{label:"Probably AI",color:"#9A3412",bg:"#FFF7ED",border:"#FDBA74"}:{label:"Almost Certainly AI",color:"#7F1D1D",bg:"#FEF2F2",border:"#FECACA"};
const getGradeColor = g => ({A:"#166534",B:"#1D4ED8",C:"#92400E",D:"#9A3412",F:"#7F1D1D"}[g]||"#57534E");
const getRiskMeta   = r => r==="low"?{label:"Low Risk",color:"#166534",bg:"#F0FDF4",border:"#BBF7D0"}:r==="medium"?{label:"Medium Risk",color:"#92400E",bg:"#FFFBEB",border:"#FDE68A"}:{label:"High Risk",color:"#7F1D1D",bg:"#FEF2F2",border:"#FECACA"};

const CHAT_PROMPTS_CTX = ["What AI patterns do you see in my text?","Rewrite the weakest sentence","How would you improve the opening paragraph?","Give this text a grammar score","What's the tone — and does it work?","What would make this sound more human?"];
const CHAT_PROMPTS_GEN = ["What makes writing sound AI-generated?","How do I write more like myself?","What's the difference between grammar and style?","When to use a comma vs a semicolon?","Most common AI vocabulary words to avoid?","How do I write a strong opening sentence?"];

// ═══ MARKDOWN RENDERER ══════════════════════════════════════════════

function inlineMd(text) {
  const parts=[]; const re=/(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g; let last=0,m;
  while((m=re.exec(text))!==null){
    if(m.index>last)parts.push(text.slice(last,m.index));
    if(m[0].startsWith("**"))parts.push(<strong key={m.index}>{m[2]}</strong>);
    else if(m[0].startsWith("*"))parts.push(<em key={m.index}>{m[3]}</em>);
    else parts.push(<code key={m.index} style={{background:"#F0EBE3",borderRadius:"3px",padding:"1px 5px",fontSize:"12px",fontFamily:"monospace"}}>{m[4]}</code>);
    last=m.index+m[0].length;
  }
  if(last<text.length)parts.push(text.slice(last));
  return parts.length?parts:text;
}

function renderMd(text) {
  const lines=text.split("\n"); const els=[]; let i=0;
  while(i<lines.length){
    const l=lines[i];
    if(/^[-*•]\s/.test(l)){const it=[];while(i<lines.length&&/^[-*•]\s/.test(lines[i])){it.push(lines[i].replace(/^[-*•]\s/,""));i++;}els.push(<ul key={i} style={{margin:"6px 0",paddingLeft:"18px"}}>{it.map((x,j)=><li key={j} style={{marginBottom:"3px"}}>{inlineMd(x)}</li>)}</ul>);continue;}
    if(/^\d+\.\s/.test(l)){const it=[];while(i<lines.length&&/^\d+\.\s/.test(lines[i])){it.push(lines[i].replace(/^\d+\.\s/,""));i++;}els.push(<ol key={i} style={{margin:"6px 0",paddingLeft:"20px"}}>{it.map((x,j)=><li key={j} style={{marginBottom:"3px"}}>{inlineMd(x)}</li>)}</ol>);continue;}
    if(l.startsWith("```")){const cl=[];i++;while(i<lines.length&&!lines[i].startsWith("```")){cl.push(lines[i]);i++;}els.push(<pre key={i} style={{background:"#F0EBE3",border:"1px solid #E7E2D9",borderRadius:"4px",padding:"10px 12px",fontSize:"12px",fontFamily:"monospace",overflowX:"auto",margin:"8px 0",whiteSpace:"pre-wrap"}}>{cl.join("\n")}</pre>);i++;continue;}
    if(/^#{1,3}\s/.test(l)){const lv=(l.match(/^(#{1,3})/)||["",""])[1].length;els.push(<div key={i} style={{fontWeight:"600",fontSize:lv===1?"16px":"14px",marginTop:"10px",marginBottom:"4px"}}>{inlineMd(l.replace(/^#{1,3}\s/,""))}</div>);i++;continue;}
    if(/^---+$/.test(l.trim())){els.push(<hr key={i} style={{border:"none",borderTop:"1px solid #E7E2D9",margin:"10px 0"}}/>);i++;continue;}
    if(l.trim()===""){els.push(<div key={i} style={{height:"6px"}}/>);i++;continue;}
    els.push(<div key={i} style={{marginBottom:"2px",lineHeight:"1.65"}}>{inlineMd(l)}</div>);i++;
  }
  return els;
}

// ═══ SUB-COMPONENTS ════════════════════════════════════════════════

function CircleGauge({score,color}){
  const [a,setA]=useState(0);
  useEffect(()=>{const t=setTimeout(()=>setA(score),120);return()=>clearTimeout(t);},[score]);
  const r=50,c=2*Math.PI*r,off=c-(a/100)*c;
  return(<svg width="124" height="124" style={{overflow:"visible",flexShrink:0}}>
    <circle cx="62" cy="62" r={r} fill="none" stroke="#EDE8E0" strokeWidth="8"/>
    <circle cx="62" cy="62" r={r} fill="none" stroke={color} strokeWidth="8" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" transform="rotate(-90 62 62)" style={{transition:"stroke-dashoffset 1.3s cubic-bezier(0.34,1.56,0.64,1)"}}/>
    <text x="62" y="57" textAnchor="middle" fill={color} style={{fontSize:"25px",fontWeight:"700",fontFamily:"'Lora',Georgia,serif"}}>{a}</text>
    <text x="62" y="73" textAnchor="middle" fill="#A8A29E" style={{fontSize:"10px",letterSpacing:"0.08em",fontFamily:"'Lora',Georgia,serif"}}>/ 100</text>
  </svg>);
}

function FadeIn({children,delay=0,style:s={}}){
  const [v,setV]=useState(false);
  useEffect(()=>{const t=setTimeout(()=>setV(true),delay);return()=>clearTimeout(t);},[delay]);
  return <div style={{opacity:v?1:0,transform:v?"translateY(0)":"translateY(10px)",transition:"opacity .45s ease,transform .45s ease",...s}}>{children}</div>;
}

function SH({title,color}){
  return <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"12px"}}>
    <div style={{width:"3px",height:"19px",backgroundColor:color,borderRadius:"2px",flexShrink:0}}/>
    <span style={{fontFamily:"'Lora',Georgia,serif",fontSize:"11px",fontWeight:"600",letterSpacing:"0.14em",textTransform:"uppercase",color}}>{title}</span>
  </div>;
}

function LoadSteps({steps,stage}){
  return <div style={{padding:"32px 0"}}>
    {steps.map((label,i)=>(
      <div key={i} style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"14px",opacity:stage>=i+1?1:0.3,transition:"opacity .4s"}}>
        <div style={{width:"20px",height:"20px",borderRadius:"50%",flexShrink:0,backgroundColor:stage>i+1?"#B91C1C":"transparent",border:`2px solid ${stage>=i+1?"#B91C1C":"#E7E2D9"}`,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .3s"}}>
          {stage>i+1&&<span style={{color:"white",fontSize:"10px"}}>✓</span>}
          {stage===i+1&&<div style={{width:"7px",height:"7px",borderRadius:"50%",backgroundColor:"#B91C1C",animation:"bounce 1.2s ease-in-out infinite"}}/>}
        </div>
        <span style={{fontSize:"15px",fontStyle:stage===i+1?"italic":"normal",color:stage>=i+1?"#1C1917":"#A8A29E"}}>{label}</span>
      </div>
    ))}
  </div>;
}

function CopyBtn({text}){
  const [ok,setOk]=useState(false);
  return <button className="copy-btn" onClick={()=>{navigator.clipboard?.writeText(text);setOk(true);setTimeout(()=>setOk(false),1800);}} style={{marginTop:"10px",background:"none",border:"1px solid #D6D0C8",borderRadius:"4px",padding:"7px 14px",fontSize:"12px",letterSpacing:"0.06em",textTransform:"uppercase",color:"#57534E",cursor:"pointer",fontFamily:"'Lora',Georgia,serif",transition:"background .15s"}}>
    {ok?"✓ Copied!":"Copy to clipboard"}
  </button>;
}

// ═══ INFO PAGES ════════════════════════════════════════════════════

function AboutPage(){
  return <div style={{maxWidth:"640px"}}>
    <div style={{marginBottom:"32px"}}>
      <div style={{fontSize:"11px",letterSpacing:"0.18em",textTransform:"uppercase",color:"#B91C1C",fontWeight:"600",marginBottom:"8px"}}>About</div>
      <h1 style={{fontSize:"clamp(22px,5vw,30px)",fontWeight:"700",letterSpacing:"-0.02em",lineHeight:1.2,margin:"0 0 14px",color:"#1C1917"}}>RedPen.AI — The Editorial Writing Suite</h1>
      <p style={{fontSize:"15px",lineHeight:"1.75",color:"#44403C",fontStyle:"italic"}}>Built for writers who know the difference between text that was generated and text that was written.</p>
    </div>

    <div style={{height:"1px",backgroundColor:"#E7E2D9",marginBottom:"28px"}}/>

    <div style={{marginBottom:"28px"}}>
      <h2 style={{fontSize:"17px",fontWeight:"600",marginBottom:"10px",color:"#1C1917"}}>What is RedPen.AI?</h2>
      <p style={{fontSize:"14px",lineHeight:"1.75",color:"#44403C",marginBottom:"12px"}}>RedPen.AI is a five-tool writing suite powered by Claude (Anthropic's AI) and built on the Humanizer skill — a comprehensive framework derived from Wikipedia's <em>Signs of AI Writing</em> guide maintained by WikiProject AI Cleanup.</p>
      <p style={{fontSize:"14px",lineHeight:"1.75",color:"#44403C"}}>The project catalogs 29 specific patterns that AI systems produce repeatedly — from significance inflation and copula avoidance to synonym cycling and the rule of three. RedPen.AI turns that research into practical tools anyone can use.</p>
    </div>

    <div style={{marginBottom:"28px"}}>
      <h2 style={{fontSize:"17px",fontWeight:"600",marginBottom:"10px",color:"#1C1917"}}>The five tools</h2>
      {[
        {icon:"⊙",name:"AI Detect",desc:"Scans any text for 29 AI writing patterns across four categories — Content, Language, Style, and Filler. Returns a 0–100 score, verdict badge, category breakdown, and per-finding annotations with exact quoted phrases."},
        {icon:"✦",name:"Grammar",desc:"Checks grammar, spelling, punctuation, style, and clarity. Each issue gets an Original → Corrected diff card. Returns a letter grade (A–F), a full corrected version, and a 'what's working' section."},
        {icon:"◈",name:"Originality",desc:"Uses live web search to look up distinctive phrases from your text and check whether they appear in published sources. Returns an originality score, risk level, and a phrase-by-phrase results table with source links."},
        {icon:"✎",name:"Humanize",desc:"Runs a three-stage pipeline: draft rewrite → AI self-audit of that draft → final rewrite. Strips all AI patterns and injects genuine voice and rhythm. Optional: paste a sample of your own writing for voice matching."},
        {icon:"◉",name:"AI Chat",desc:"A context-aware writing coach that maintains full conversation history. Load your working text as context, then ask anything — from sentence-level rewrites to explanations of why certain patterns read as AI-generated."},
      ].map(t=>(
        <div key={t.name} style={{display:"flex",gap:"14px",marginBottom:"16px",padding:"14px 16px",backgroundColor:"#FFF",border:"1.5px solid #E7E2D9",borderRadius:"8px"}}>
          <span style={{fontSize:"20px",flexShrink:0,marginTop:"2px"}}>{t.icon}</span>
          <div>
            <div style={{fontSize:"14px",fontWeight:"600",color:"#1C1917",marginBottom:"4px"}}>{t.name}</div>
            <p style={{margin:0,fontSize:"13px",lineHeight:"1.6",color:"#57534E"}}>{t.desc}</p>
          </div>
        </div>
      ))}
    </div>

    <div style={{marginBottom:"28px"}}>
      <h2 style={{fontSize:"17px",fontWeight:"600",marginBottom:"10px",color:"#1C1917"}}>The source</h2>
      <p style={{fontSize:"14px",lineHeight:"1.75",color:"#44403C"}}>The pattern library is based on Wikipedia's <em>WikiProject AI Cleanup</em> documentation — a crowd-sourced effort by thousands of editors who've been systematically identifying and removing AI-generated content from the encyclopedia since 2023. It's arguably the most rigorous public dataset of AI writing tells that exists.</p>
    </div>

    <div style={{padding:"16px 20px",backgroundColor:"#FAF8F4",border:"1px solid #E7E2D9",borderRadius:"8px"}}>
      <p style={{margin:0,fontSize:"13px",lineHeight:"1.65",color:"#78716C",fontStyle:"italic"}}>RedPen.AI is powered by Claude (Anthropic). All analysis runs live — nothing is stored or logged. Each session is independent.</p>
    </div>
  </div>;
}

function PricingPage(){
  return <div style={{maxWidth:"640px"}}>
    <div style={{marginBottom:"32px"}}>
      <div style={{fontSize:"11px",letterSpacing:"0.18em",textTransform:"uppercase",color:"#B91C1C",fontWeight:"600",marginBottom:"8px"}}>Pricing</div>
      <h1 style={{fontSize:"clamp(22px,5vw,30px)",fontWeight:"700",letterSpacing:"-0.02em",lineHeight:1.2,margin:"0 0 14px",color:"#1C1917"}}>All tools. No paywall.</h1>
      <p style={{fontSize:"15px",lineHeight:"1.75",color:"#44403C",fontStyle:"italic"}}>RedPen.AI is completely free to use. Here's exactly what that means.</p>
    </div>

    <div style={{height:"1px",backgroundColor:"#E7E2D9",marginBottom:"28px"}}/>

    <div style={{backgroundColor:"#F0FDF4",border:"1.5px solid #BBF7D0",borderRadius:"10px",padding:"24px",marginBottom:"28px",display:"flex",gap:"16px",alignItems:"flex-start"}}>
      <span style={{fontSize:"28px",flexShrink:0}}>✓</span>
      <div>
        <div style={{fontSize:"17px",fontWeight:"600",color:"#166534",marginBottom:"8px"}}>100% Free — No account required</div>
        <p style={{margin:0,fontSize:"14px",lineHeight:"1.7",color:"#166534"}}>Every tool on RedPen.AI is free. No subscription, no credits, no sign-up. Open it and start using it.</p>
      </div>
    </div>

    <div style={{marginBottom:"28px"}}>
      <h2 style={{fontSize:"17px",fontWeight:"600",marginBottom:"16px",color:"#1C1917"}}>What's included — free</h2>
      {[
        ["⊙","AI Detect","Unlimited scans. Full pattern breakdown with scores, category pills, and annotated findings."],
        ["✦","Grammar Check","Unlimited checks. Letter grade, full diff cards, corrected text, and strengths summary."],
        ["◈","Originality Check","Live web search per check. Phrase-by-phrase table with source links. Unlimited use."],
        ["✎","Humanize","Full 3-stage pipeline: draft → audit → final rewrite. Optional voice matching. Unlimited."],
        ["◉","AI Chat","Full multi-turn conversations. Context-aware (load your text). No session limits."],
      ].map(([icon,name,desc])=>(
        <div key={name} style={{display:"flex",gap:"12px",alignItems:"flex-start",padding:"12px 0",borderBottom:"1px solid #F0EBE3"}}>
          <span style={{fontSize:"18px",flexShrink:0,marginTop:"1px"}}>{icon}</span>
          <div style={{flex:1}}>
            <div style={{fontSize:"14px",fontWeight:"600",color:"#1C1917",marginBottom:"2px"}}>{name}</div>
            <p style={{margin:0,fontSize:"13px",lineHeight:"1.55",color:"#57534E"}}>{desc}</p>
          </div>
          <span style={{fontSize:"13px",fontWeight:"600",color:"#166534",flexShrink:0,paddingTop:"1px"}}>Free</span>
        </div>
      ))}
    </div>

    <div style={{marginBottom:"28px"}}>
      <h2 style={{fontSize:"17px",fontWeight:"600",marginBottom:"12px",color:"#1C1917"}}>Any limitations?</h2>
      <p style={{fontSize:"14px",lineHeight:"1.75",color:"#44403C",marginBottom:"10px"}}>RedPen.AI is a web app powered by the Anthropic API. A few things to keep in mind:</p>
      {[
        "Each session is independent — conversation history doesn't persist between browser sessions",
        "Very long texts (10,000+ words) may be truncated by the model's context window",
        "The Originality checker uses live web search — results depend on what's publicly indexed",
        "Usage is subject to the Anthropic API rate limits (generous for normal use)",
      ].map((item,i)=>(
        <div key={i} style={{display:"flex",gap:"10px",marginBottom:"8px"}}>
          <span style={{color:"#B45309",flexShrink:0,marginTop:"2px"}}>◦</span>
          <span style={{fontSize:"14px",lineHeight:"1.6",color:"#44403C"}}>{item}</span>
        </div>
      ))}
    </div>

    <div style={{padding:"16px 20px",backgroundColor:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:"8px"}}>
      <p style={{margin:0,fontSize:"13px",lineHeight:"1.65",color:"#92400E"}}><strong>Academic use note:</strong> The Originality checker searches publicly indexed web content. It is not a substitute for academic plagiarism databases like Turnitin, iThenticate, or Copyleaks, which have access to unpublished manuscripts, paywalled journals, and student paper databases.</p>
    </div>
  </div>;
}

function TipsPage(){
  const tips = [
    {
      title:"Run Detect before Humanize",
      body:"Before you humanize anything, run the Detect tool first. It shows you exactly which patterns are present, so the Humanize step has a target. Seeing the score drop after humanizing is satisfying — and instructive.",
    },
    {
      title:"Use voice matching for consistent rewrites",
      body:"In the Humanize tab, paste a paragraph or two of your own writing before running. The model will match your sentence rhythm, vocabulary level, punctuation habits, and tone. Without this, rewrites default to a clean-but-generic voice.",
    },
    {
      title:"Chain the tools in order",
      body:"The most effective workflow is: Grammar → Detect → Humanize → Detect again → Originality. Fix technical errors first, then strip AI patterns, then verify the score dropped, then confirm nothing was inadvertently borrowed.",
    },
    {
      title:"Run Humanize twice on stubborn text",
      body:"Some text — especially content that was heavily templated or generated in a specific style — holds onto AI patterns after the first pass. Use the 'Run again on final' button to do a second pass. Scores almost always improve.",
    },
    {
      title:"Use the Chat agent for explanations",
      body:"Don't just accept the rewrite — ask the Chat agent why specific sentences were flagged. Type something like 'Why is serves-as a problem?' or 'What's wrong with negative parallelism?' Understanding the patterns helps you avoid them in future writing.",
    },
    {
      title:"Grammar before Humanize, always",
      body:"The Humanize tool rewrites sentences structurally. If you run it on text with grammar errors, those errors may survive (or new ones may be introduced in the rewrite). Fix grammar first so you're working with clean input.",
    },
    {
      title:"The Detect score isn't absolute",
      body:"A score of 72 doesn't mean '72% of this text is AI-generated.' It means the text contains many patterns that strongly correlate with AI generation. Human writers occasionally use these patterns too — the score reflects weight of evidence, not a binary verdict.",
    },
    {
      title:"Load context in the Chat tab",
      body:"The Chat agent is most powerful when your text is loaded as context. Click 'Load my text as context' and the agent can answer specific questions: 'Rewrite sentence 3', 'Is the conclusion too generic?', 'What would a journalist cut from this paragraph?'",
    },
    {
      title:"Paste a writing sample to detect your own AI tells",
      body:"Even human writers pick up patterns from reading too much AI-generated content. Paste your own writing into the Detect tool occasionally. If it scores above 30, you may have absorbed some of the vocabulary or sentence structures you want to avoid.",
    },
    {
      title:"Don't humanize everything",
      body:"Technical documentation, formal reports, and legal writing sometimes need the structured, impersonal register that Detect flags as 'AI-like.' Use judgment. The goal is writing that sounds like a person — but the right person for the context.",
    },
  ];
  return <div style={{maxWidth:"640px"}}>
    <div style={{marginBottom:"32px"}}>
      <div style={{fontSize:"11px",letterSpacing:"0.18em",textTransform:"uppercase",color:"#B91C1C",fontWeight:"600",marginBottom:"8px"}}>Tips</div>
      <h1 style={{fontSize:"clamp(22px,5vw,30px)",fontWeight:"700",letterSpacing:"-0.02em",lineHeight:1.2,margin:"0 0 14px",color:"#1C1917"}}>Getting the most out of RedPen.AI</h1>
      <p style={{fontSize:"15px",lineHeight:"1.75",color:"#44403C",fontStyle:"italic"}}>Practical advice from working with these tools across thousands of texts.</p>
    </div>
    <div style={{height:"1px",backgroundColor:"#E7E2D9",marginBottom:"28px"}}/>
    {tips.map((tip,i)=>(
      <div key={i} style={{marginBottom:"22px",paddingBottom:"22px",borderBottom:"1px solid #F0EBE3"}}>
        <div style={{display:"flex",gap:"12px",marginBottom:"8px"}}>
          <div style={{width:"24px",height:"24px",borderRadius:"50%",backgroundColor:"#B91C1C",color:"white",fontSize:"12px",fontWeight:"700",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"1px"}}>{i+1}</div>
          <h3 style={{fontSize:"15px",fontWeight:"600",color:"#1C1917",margin:0,paddingTop:"3px"}}>{tip.title}</h3>
        </div>
        <p style={{margin:"0 0 0 36px",fontSize:"14px",lineHeight:"1.75",color:"#44403C"}}>{tip.body}</p>
      </div>
    ))}
  </div>;
}

function FAQPage(){
  const [open,setOpen]=useState(null);
  const faqs=[
    {q:"Is this actually free?",a:"Yes, completely. No account, no credits, no subscription. RedPen.AI runs as a Claude artifact — you just open it and use it."},
    {q:"How does the AI Detect score work?",a:"The detector checks for 29 documented patterns across four categories: Content (significance inflation, promotional language, vague attributions), Language (AI vocabulary words, copula avoidance, rule of three), Style (em dash overuse, mechanical bolding), and Filler (filler phrases, generic conclusions, chatbot artifacts). Each pattern found adds weight to the score. A score of 76–100 means the text has heavy, consistent evidence of AI generation. A score under 25 means the text has few or no detectable patterns."},
    {q:"What's the difference between Humanize and a paraphraser?",a:"A paraphraser swaps words and restructures sentences while preserving the same basic content. Humanize does something different: it specifically targets the structural and vocabulary patterns that make AI writing detectable — then runs a self-audit where the model critiques its own rewrite to catch whatever survived the first pass. The goal isn't just different wording; it's writing that actually sounds like a person wrote it."},
    {q:"Can the AI Detect tool catch all AI-generated text?",a:"No. The detector is based on patterns that frequently appear in AI-generated text — but AI systems don't always produce all of them, and human writers occasionally produce some of them. The score reflects the weight of evidence, not a guaranteed verdict. A highly skilled writer using AI as a first draft and then heavily editing it may score surprisingly low. Conversely, a human writer who has absorbed a lot of AI-generated prose may score higher than expected."},
    {q:"Is the Originality checker the same as Turnitin?",a:"No. The Originality checker uses live web search to look for distinctive phrases from your text in publicly indexed content. Turnitin, iThenticate, and similar academic tools have access to unpublished manuscripts, institutional repositories, paywalled journals, and databases of student submissions that are not publicly searchable. For academic submission, always use a purpose-built plagiarism detection tool."},
    {q:"Does RedPen.AI store my text or conversations?",a:"No. Each session runs independently. When you close the tab or refresh, nothing persists. Your text is sent to Anthropic's API for processing (the same API that powers Claude.ai) but is not stored or used for training per Anthropic's data policies."},
    {q:"Why does the Humanize tool use a three-stage pipeline?",a:"The first-pass rewrite (Draft) handles the obvious patterns — removing AI vocabulary, breaking up the rule-of-three structures, replacing copula avoidance. But some patterns survive because they're subtle or contextually appropriate-looking. The AI Audit step has the model critically read its own draft and flag what still reads as generated. The Final Rewrite then fixes those remaining tells. This self-critique approach consistently produces cleaner output than a single rewrite pass."},
    {q:"What is voice matching and how does it work?",a:"In the Humanize tab, you can paste a sample of your own writing (a paragraph or two from a previous piece, an email, a blog post). This gets included in the system prompt, and the model uses it as a style reference — matching your sentence length patterns, vocabulary level, punctuation habits, and overall register. Without a voice sample, the model defaults to a clear but somewhat generic editorial voice."},
    {q:"What text length works best?",a:"All five tools work on text from a single sentence to several thousand words. For best results with the Humanize and Detect tools, paragraphs of 100–800 words tend to give the most accurate and actionable results. Very short text (under 50 words) may not have enough signal for a meaningful score. Very long text (10,000+ words) may hit context window limits and get truncated."},
    {q:"Can I use this on text I didn't write with AI?",a:"Yes, and it can be useful. Human writing sometimes scores unexpectedly high on the detector — especially writing that borrows from AI-generated sources, writing that leans on corporate or academic boilerplate, or writing from non-native English speakers who've picked up the same structural patterns AI favors. The Grammar and Chat tools work equally well on any writing regardless of its origin."},
  ];
  return <div style={{maxWidth:"640px"}}>
    <div style={{marginBottom:"32px"}}>
      <div style={{fontSize:"11px",letterSpacing:"0.18em",textTransform:"uppercase",color:"#B91C1C",fontWeight:"600",marginBottom:"8px"}}>FAQ</div>
      <h1 style={{fontSize:"clamp(22px,5vw,30px)",fontWeight:"700",letterSpacing:"-0.02em",lineHeight:1.2,margin:"0 0 14px",color:"#1C1917"}}>Frequently asked questions</h1>
      <p style={{fontSize:"15px",lineHeight:"1.75",color:"#44403C",fontStyle:"italic"}}>Everything you need to know before you start.</p>
    </div>
    <div style={{height:"1px",backgroundColor:"#E7E2D9",marginBottom:"6px"}}/>
    {faqs.map((f,i)=>(
      <div key={i} style={{borderBottom:"1px solid #E7E2D9"}}>
        <button onClick={()=>setOpen(open===i?null:i)} style={{width:"100%",padding:"16px 0",background:"none",border:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"16px",textAlign:"left",fontFamily:"'Lora',Georgia,serif"}}>
          <span style={{fontSize:"14px",fontWeight:"600",color:"#1C1917",lineHeight:"1.4"}}>{f.q}</span>
          <span style={{fontSize:"18px",color:"#B91C1C",flexShrink:0,transform:open===i?"rotate(45deg)":"none",transition:"transform .2s"}}>{open===i?"×":"+"}</span>
        </button>
        {open===i&&(
          <div style={{paddingBottom:"16px"}}>
            <p style={{margin:0,fontSize:"14px",lineHeight:"1.75",color:"#44403C"}}>{f.a}</p>
          </div>
        )}
      </div>
    ))}
  </div>;
}

// ═══ MAIN APP ══════════════════════════════════════════════════════

export default function App(){
  const [mode,setMode]=useState("about");
  const [input,setInput]=useState("");
  const [voiceSample,setVoiceSample]=useState("");
  const [showVoice,setShowVoice]=useState(false);
  const [appState,setAppState]=useState("idle");
  const [stage,setStage]=useState(0);
  const [error,setError]=useState("");
  const resultRef=useRef(null);
  const [isMobile,setIsMobile]=useState(typeof window!=="undefined"&&window.innerWidth<768);
  const [sideOpen,setSideOpen]=useState(typeof window!=="undefined"&&window.innerWidth>=768);
  useEffect(()=>{
    const check=()=>setIsMobile(window.innerWidth<768);
    window.addEventListener("resize",check);
    return()=>window.removeEventListener("resize",check);
  },[]);

  // humanize
  const [hDraft,setHDraft]=useState(""); const [hAudit,setHAudit]=useState([]); const [hFinal,setHFinal]=useState(""); const [hChanges,setHChanges]=useState([]);
  // detect
  const [dScore,setDScore]=useState(0); const [dSummary,setDSummary]=useState(""); const [dFindings,setDFindings]=useState([]); const [dClean,setDClean]=useState([]);
  // grammar
  const [gScore,setGScore]=useState(0); const [gGrade,setGGrade]=useState(""); const [gCount,setGCount]=useState(0); const [gSummary,setGSummary]=useState(""); const [gErrors,setGErrors]=useState([]); const [gFixed,setGFixed]=useState(""); const [gStrengths,setGStrengths]=useState([]);
  // plagiarism
  const [pScore,setPScore]=useState(0); const [pRisk,setPRisk]=useState(""); const [pSummary,setPSummary]=useState(""); const [pMatches,setPMatches]=useState([]); const [pOriginal,setPOriginal]=useState([]); const [pDisclaimer,setPDisclaimer]=useState("");
  // chat
  const [chatMsgs,setChatMsgs]=useState([]); const [chatInput,setChatInput]=useState(""); const [chatLoading,setChatLoading]=useState(false); const [chatError,setChatError]=useState(""); const [ctxOn,setCtxOn]=useState(false);
  const chatEndRef=useRef(null); const chatInputRef=useRef(null);

  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:"smooth"});},[chatMsgs,chatLoading]);

  const isToolMode = NAV_TOOLS.some(t=>t.id===mode);

  function reset(){setAppState("idle");setStage(0);setError("");setHDraft("");setHAudit([]);setHFinal("");setHChanges([]);setDScore(0);setDSummary("");setDFindings([]);setDClean([]);setGScore(0);setGGrade("");setGCount(0);setGSummary("");setGErrors([]);setGFixed("");setGStrengths([]);setPScore(0);setPRisk("");setPSummary("");setPMatches([]);setPOriginal([]);setPDisclaimer("");}

  async function callAPI(sys,user,extra={}){
    const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1500,system:sys,messages:[{role:"user",content:user}],...extra})});
    const d=await r.json(); if(!r.ok)throw new Error(d.error?.message||"API error");
    return d.content?.map(b=>b.text||"").join("")||"";
  }
  function parseJSON(raw){return JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```\s*$/,"").trim());}
  function parseHumanize(text){const s={};text.split(/^##\s+/m).forEach(p=>{const ls=p.trim().split("\n");const h=ls[0].trim().toUpperCase();const b=ls.slice(1).join("\n").trim();if(h.includes("DRAFT"))s.draft=b;else if(h.includes("AUDIT"))s.audit=b;else if(h.includes("FINAL"))s.final=b;else if(h.includes("CHANGES"))s.changes=b;});return s;}
  const scroll=()=>setTimeout(()=>resultRef.current?.scrollIntoView({behavior:"smooth"}),100);

  async function runDetect(){if(!input.trim())return;setAppState("loading");setStage(1);setError("");
    try{const raw=await callAPI(DETECT_PROMPT,`Analyze:\n\n${input}`);const p=parseJSON(raw);setStage(2);setTimeout(()=>{setDScore(p.score??0);setDSummary(p.summary??"");setDFindings(p.findings??[]);setDClean(p.clean_signals??[]);setAppState("done");scroll();},400);}catch(e){setError(e.message);setAppState("error");}}

  async function runGrammar(){if(!input.trim())return;setAppState("loading");setStage(1);setError("");
    try{const raw=await callAPI(GRAMMAR_PROMPT,`Check:\n\n${input}`);setStage(2);const p=parseJSON(raw);setTimeout(()=>{setGScore(p.score??0);setGGrade(p.grade??"");setGCount(p.error_count??0);setGSummary(p.summary??"");setGErrors(p.errors??[]);setGFixed(p.corrected_text??"");setGStrengths(p.strengths??[]);setAppState("done");scroll();},400);}catch(e){setError(e.message);setAppState("error");}}

  async function runPlagiarism(){if(!input.trim())return;setAppState("loading");setStage(1);setError("");
    try{const raw=await callAPI(PLAGIARISM_PROMPT,`Check originality:\n\n${input}`,{tools:[{type:"web_search_20250305",name:"web_search"}]});setStage(2);const p=parseJSON(raw);setTimeout(()=>{setPScore(p.originality_score??0);setPRisk(p.risk_level??"low");setPSummary(p.summary??"");setPMatches(p.matches??[]);setPOriginal(p.original_elements??[]);setPDisclaimer(p.disclaimer??"");setAppState("done");scroll();},400);}catch(e){setError(e.message);setAppState("error");}}

  async function runHumanize(){if(!input.trim())return;setAppState("loading");setStage(1);setError("");setHDraft("");setHAudit([]);setHFinal("");setHChanges([]);
    const uc=voiceSample.trim()?`Voice sample:\n\n${voiceSample}\n\n---\n\nHumanize:\n\n${input}`:`Humanize:\n\n${input}`;
    try{const raw=await callAPI(HUMANIZE_PROMPT,uc);const p=parseHumanize(raw);setStage(2);
      setTimeout(()=>{setHDraft(p.draft||"");setStage(3);setTimeout(()=>{setHAudit((p.audit||"").split("\n").map(l=>l.replace(/^[•\-\*]\s*/,"").trim()).filter(Boolean));setStage(4);setTimeout(()=>{setHFinal(p.final||"");setHChanges((p.changes||"").split("\n").map(l=>l.replace(/^[•\-\*]\s*/,"").trim()).filter(Boolean));setAppState("done");scroll();},600);},400);},300);
    }catch(e){setError(e.message);setAppState("error");}}

  async function sendChat(msg){
    const text=(msg||chatInput).trim();if(!text||chatLoading)return;
    setChatInput("");setChatError("");
    const nm=[...chatMsgs,{role:"user",content:text}];setChatMsgs(nm);setChatLoading(true);
    try{const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:buildChatSystem(ctxOn?input:""),messages:nm})});
      const d=await r.json();if(!r.ok)throw new Error(d.error?.message||"API error");
      setChatMsgs(prev=>[...prev,{role:"assistant",content:d.content?.map(b=>b.text||"").join("")||""}]);
    }catch(e){setChatError(e.message);setChatMsgs(prev=>prev.slice(0,-1));}finally{setChatLoading(false);}
  }

  const wc=input.trim()?input.trim().split(/\s+/).length:0;
  const aiMeta=getAIVerdictMeta(dScore); const riskMeta=getRiskMeta(pRisk);
  const catCounts=dFindings.reduce((a,f)=>{a[f.category]=(a[f.category]||0)+1;return a;},{});
  const loadSteps={detect:["Reading the text","Scanning for AI patterns"],grammar:["Reading the text","Checking grammar & style"],plagiarism:["Reading the text","Searching the web for matches"],humanize:["Reading the text","Writing a cleaner draft","Running the AI audit","Finalizing the rewrite"]}[mode]||[];
  const runMap={detect:runDetect,grammar:runGrammar,plagiarism:runPlagiarism,humanize:runHumanize};
  const btnLabel={detect:"Scan for AI patterns",grammar:"Check Grammar",plagiarism:"Check Originality",humanize:"Apply the Red Pen"};

  // Sidebar: on mobile = full-width overlay drawer; on desktop = inline 200px or collapsed 56px
  const desktopW = sideOpen ? "220px" : "56px";
  const navItemClick = (id, isChat) => {
    setMode(id);
    if(!isChat) reset();
    if(isMobile) setSideOpen(false); // auto-close on mobile after selection
  };

  // Shared sidebar inner content (used in both mobile overlay and desktop inline)
  const SidebarContent = () => (
    <>
      {/* Logo area — unified background, no border conflict */}
      <div style={{padding:"16px 14px 12px",borderBottom:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",gap:"10px",minHeight:"72px",flexShrink:0,backgroundColor:"#1A1A1A"}}>
        <img src={LOGO_B64} alt="RedPen.AI" style={{width:"42px",height:"42px",objectFit:"contain",flexShrink:0,borderRadius:"6px"}} />
        <div>
          <div style={{fontSize:"14px",fontWeight:"700",color:"#FFFFFF",letterSpacing:"0.06em",lineHeight:1.1}}>REDPEN.AI</div>
          <div style={{fontSize:"8px",color:"#B91C1C",letterSpacing:"0.2em",textTransform:"uppercase",marginTop:"3px"}}>Editorial Suite</div>
        </div>
      </div>

      {/* Tools */}
      <div style={{padding:"14px 10px 4px",flexShrink:0}}>
        <div style={{fontSize:"9px",letterSpacing:"0.2em",textTransform:"uppercase",color:"rgba(255,255,255,0.28)",padding:"0 8px",marginBottom:"8px"}}>Tools</div>
        {NAV_TOOLS.map(t=>{
          const active=mode===t.id;
          return <button key={t.id} className="nav-item" onClick={()=>navItemClick(t.id,t.id==="chat")}
            style={{width:"100%",padding:"9px 10px",display:"flex",alignItems:"center",gap:"10px",background:active?"rgba(185,28,28,0.3)":"transparent",border:"none",cursor:"pointer",borderRadius:"6px",marginBottom:"2px",justifyContent:"flex-start",color:active?"#FF8080":"rgba(255,255,255,0.72)",fontFamily:"'Lora',Georgia,serif",transition:"background .15s,color .15s",borderLeft:active?"3px solid #B91C1C":"3px solid transparent"}}>
            <span style={{fontSize:"16px",flexShrink:0,width:"20px",textAlign:"center"}}>{t.icon}</span>
            <span style={{fontSize:"13px",fontWeight:active?"600":"400",whiteSpace:"nowrap"}}>{t.label}</span>
          </button>;
        })}
      </div>

      <div style={{height:"1px",backgroundColor:"rgba(255,255,255,0.08)",margin:"8px 14px",flexShrink:0}}/>

      {/* Info */}
      <div style={{padding:"4px 10px",flexShrink:0}}>
        <div style={{fontSize:"9px",letterSpacing:"0.2em",textTransform:"uppercase",color:"rgba(255,255,255,0.28)",padding:"0 8px",marginBottom:"8px"}}>Info</div>
        {NAV_INFO.map(t=>{
          const active=mode===t.id;
          return <button key={t.id} className="nav-item" onClick={()=>navItemClick(t.id,false)}
            style={{width:"100%",padding:"9px 10px",display:"flex",alignItems:"center",gap:"10px",background:active?"rgba(185,28,28,0.3)":"transparent",border:"none",cursor:"pointer",borderRadius:"6px",marginBottom:"2px",justifyContent:"flex-start",color:active?"#FF8080":"rgba(255,255,255,0.72)",fontFamily:"'Lora',Georgia,serif",transition:"background .15s,color .15s",borderLeft:active?"3px solid #B91C1C":"3px solid transparent"}}>
            <span style={{fontSize:"15px",flexShrink:0,width:"20px",textAlign:"center"}}>{t.icon}</span>
            <span style={{fontSize:"13px",fontWeight:active?"600":"400",whiteSpace:"nowrap"}}>{t.label}</span>
          </button>;
        })}
      </div>

      <div style={{flex:1}}/>

      {/* Collapse button — desktop only */}
      {!isMobile && (
        <div style={{padding:"12px 10px",borderTop:"1px solid rgba(255,255,255,0.08)",flexShrink:0}}>
          <button onClick={()=>setSideOpen(!sideOpen)} className="nav-item"
            style={{width:"100%",padding:"8px 10px",display:"flex",alignItems:"center",justifyContent:"flex-end",gap:"8px",background:"transparent",border:"none",cursor:"pointer",borderRadius:"6px",color:"rgba(255,255,255,0.35)",fontFamily:"'Lora',Georgia,serif",fontSize:"12px"}}>
            <span style={{transform:sideOpen?"none":"rotate(180deg)",transition:"transform .2s",fontSize:"16px"}}>‹</span>
            {sideOpen&&<span style={{fontSize:"11px",letterSpacing:"0.04em"}}>Collapse</span>}
          </button>
        </div>
      )}
    </>
  );

  return(
    <div style={{display:"flex",minHeight:"100vh",backgroundColor:"#FAF8F4",fontFamily:"'Lora',Georgia,serif",color:"#1C1917"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes bounce{0%,80%,100%{transform:scale(0.8);opacity:0.5}40%{transform:scale(1.2);opacity:1}}
        @keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
        textarea:focus{outline:none;}
        .chat-ta:focus{border-color:#B91C1C!important;box-shadow:0 0 0 3px rgba(185,28,28,0.1)!important;}
        .txt-inp:focus{border-color:#B91C1C!important;box-shadow:0 0 0 3px rgba(185,28,28,0.1)!important;}
        textarea{resize:vertical;}
        .btn-r{transition:opacity .2s,transform .15s;}
        .btn-r:hover:not(:disabled){opacity:.85;transform:translateY(-1px);}
        .btn-r:disabled{opacity:.45;cursor:not-allowed;}
        .btn-g{transition:border-color .18s,color .18s;}
        .btn-g:hover{border-color:#1C1917!important;color:#1C1917!important;}
        .finding:hover{border-color:#C8C2BA!important;}
        .copy-btn:hover{background:#F0EBE3!important;}
        .nav-item{transition:background .15s,color .15s;}
        .nav-item:hover{background:rgba(255,255,255,0.1)!important;}
        .send-btn:hover:not(:disabled){background:#991B1B!important;}
        .send-btn:disabled{opacity:.4;cursor:not-allowed;}
        .chip:hover{background:#F0EBE3!important;border-color:#C8C2BA!important;}
        .msg{animation:fadeUp .3s ease;}
        .faq-btn:hover{background:rgba(185,28,28,0.04)!important;}
        .mob-overlay{animation:slideIn .25s ease;}
      `}</style>

      {/* ── MOBILE OVERLAY SIDEBAR ── */}
      {isMobile && sideOpen && (
        <>
          {/* Backdrop */}
          <div onClick={()=>setSideOpen(false)} style={{position:"fixed",inset:0,backgroundColor:"rgba(0,0,0,0.55)",zIndex:40,backdropFilter:"blur(2px)"}}/>
          {/* Drawer */}
          <div className="mob-overlay" style={{position:"fixed",top:0,left:0,bottom:0,width:"260px",backgroundColor:"#141414",zIndex:50,display:"flex",flexDirection:"column",overflowY:"auto"}}>
            {/* Close button row */}
            <div style={{display:"flex",justifyContent:"flex-end",padding:"12px 12px 0"}}>
              <button onClick={()=>setSideOpen(false)} style={{background:"rgba(255,255,255,0.08)",border:"none",borderRadius:"6px",width:"32px",height:"32px",cursor:"pointer",color:"rgba(255,255,255,0.6)",fontSize:"18px",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
            </div>
            <SidebarContent/>
          </div>
        </>
      )}

      {/* ── DESKTOP INLINE SIDEBAR ── */}
      {!isMobile && (
        <div style={{width:desktopW,minHeight:"100vh",backgroundColor:"#141414",display:"flex",flexDirection:"column",flexShrink:0,transition:"width .2s ease",overflow:"hidden",position:"sticky",top:0,alignSelf:"flex-start",height:"100vh"}}>
          <SidebarContent/>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <div style={{flex:1,overflowY:"auto",minWidth:0,display:"flex",flexDirection:"column"}}>

        {/* Mobile top bar */}
        {isMobile && (
          <div style={{position:"sticky",top:0,zIndex:30,backgroundColor:"#141414",borderBottom:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",gap:"10px",padding:"10px 16px",flexShrink:0}}>
            <button onClick={()=>setSideOpen(true)} style={{background:"none",border:"none",cursor:"pointer",color:"#FFFFFF",fontSize:"20px",padding:"4px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              ☰
            </button>
            <img src={LOGO_B64} alt="RedPen.AI" style={{width:"28px",height:"28px",objectFit:"contain",borderRadius:"4px"}}/>
            <div>
              <div style={{fontSize:"13px",fontWeight:"700",color:"#FFFFFF",letterSpacing:"0.06em",lineHeight:1}}>REDPEN.AI</div>
              <div style={{fontSize:"8px",color:"#B91C1C",letterSpacing:"0.16em",textTransform:"uppercase"}}>Editorial Suite</div>
            </div>
          </div>
        )}

        <div style={{flex:1}}>
        <div style={{maxWidth:"780px",margin:"0 auto",padding:isMobile?"20px 16px 60px":"36px 28px 60px"}}>

          {/* ── INFO PAGES ── */}
          {mode==="about"&&<AboutPage/>}
          {mode==="pricing"&&<PricingPage/>}
          {mode==="tips"&&<TipsPage/>}
          {mode==="faq"&&<FAQPage/>}

          {/* ── CHAT MODE ── */}
          {mode==="chat"&&(
            <div>
              <div style={{marginBottom:"20px",borderBottom:"2px solid #1C1917",paddingBottom:"14px"}}>
                <div style={{fontSize:"11px",letterSpacing:"0.18em",textTransform:"uppercase",color:"#B91C1C",fontWeight:"600",marginBottom:"4px"}}>AI Chat</div>
                <h1 style={{fontSize:"24px",color:"#1C1917",fontWeight:"600",letterSpacing:"-0.02em",margin:0}}>Writing Coach</h1>
              </div>
              <div style={{marginBottom:"14px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"8px"}}>
                <div style={{fontSize:"13px",color:"#78716C"}}>
                  {ctxOn?<span style={{color:"#166534",fontWeight:"500"}}>✓ Working text loaded as context</span>:<span style={{fontStyle:"italic"}}>No text context loaded</span>}
                </div>
                <div style={{display:"flex",gap:"8px"}}>
                  {input.trim()&&<button onClick={()=>setCtxOn(!ctxOn)} style={{padding:"5px 12px",border:`1px solid ${ctxOn?"#BBF7D0":"#D6D0C8"}`,borderRadius:"4px",background:ctxOn?"#F0FDF4":"none",fontSize:"12px",color:ctxOn?"#166534":"#57534E",cursor:"pointer",fontFamily:"'Lora',Georgia,serif",transition:"background .15s"}}>{ctxOn?"Remove context":"Load my text as context"}</button>}
                  {chatMsgs.length>0&&<button onClick={()=>{setChatMsgs([]);setChatError("");}} style={{padding:"5px 12px",border:"1px solid #D6D0C8",borderRadius:"4px",background:"none",fontSize:"12px",color:"#57534E",cursor:"pointer",fontFamily:"'Lora',Georgia,serif"}}>Clear chat</button>}
                </div>
              </div>
              <div style={{backgroundColor:"#FFF",border:"1.5px solid #E7E2D9",borderRadius:"10px",minHeight:"360px",maxHeight:"460px",overflowY:"auto",padding:"20px",marginBottom:"12px",display:"flex",flexDirection:"column",gap:"16px"}}>
                {chatMsgs.length===0&&!chatLoading&&(
                  <div style={{flex:1,display:"flex",flexDirection:"column",justifyContent:"center"}}>
                    <div style={{textAlign:"center",marginBottom:"24px"}}>
                      <div style={{fontSize:"30px",marginBottom:"8px"}}>◉</div>
                      <p style={{margin:0,fontSize:"15px",color:"#78716C",fontStyle:"italic"}}>Your writing coach is ready.</p>
                      <p style={{margin:"4px 0 0",fontSize:"13px",color:"#A8A29E"}}>Ask anything about writing, grammar, or AI detection.</p>
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:"8px",justifyContent:"center"}}>
                      {(input.trim()?CHAT_PROMPTS_CTX:CHAT_PROMPTS_GEN).map((p,i)=>(
                        <button key={i} className="chip" onClick={()=>sendChat(p)} style={{padding:"7px 14px",border:"1px solid #E7E2D9",borderRadius:"20px",background:"#FAFAF8",fontSize:"12px",color:"#44403C",cursor:"pointer",fontFamily:"'Lora',Georgia,serif",transition:"background .15s,border-color .15s",textAlign:"left",lineHeight:"1.4"}}>{p}</button>
                      ))}
                    </div>
                  </div>
                )}
                {chatMsgs.map((msg,i)=>(
                  <div key={i} className="msg" style={{display:"flex",justifyContent:msg.role==="user"?"flex-end":"flex-start"}}>
                    {msg.role==="assistant"&&<div style={{width:"28px",height:"28px",borderRadius:"50%",backgroundColor:"#1C1917",color:"#FAF8F4",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",flexShrink:0,marginRight:"10px",marginTop:"2px"}}>◉</div>}
                    <div style={{maxWidth:"78%",padding:msg.role==="user"?"10px 14px":"12px 16px",borderRadius:msg.role==="user"?"18px 18px 4px 18px":"4px 18px 18px 18px",backgroundColor:msg.role==="user"?"#1C1917":"#FAF8F4",border:msg.role==="user"?"none":"1.5px solid #E7E2D9",color:msg.role==="user"?"#FAF8F4":"#1C1917",fontSize:"14px",lineHeight:"1.65"}}>
                      {msg.role==="user"?<span style={{whiteSpace:"pre-wrap"}}>{msg.content}</span>:<div style={{fontSize:"14px"}}>{renderMd(msg.content)}</div>}
                    </div>
                    {msg.role==="user"&&<div style={{width:"28px",height:"28px",borderRadius:"50%",backgroundColor:"#E7E2D9",color:"#57534E",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",flexShrink:0,marginLeft:"10px",marginTop:"2px"}}>✎</div>}
                  </div>
                ))}
                {chatLoading&&<div className="msg" style={{display:"flex",alignItems:"flex-end"}}>
                  <div style={{width:"28px",height:"28px",borderRadius:"50%",backgroundColor:"#1C1917",color:"#FAF8F4",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",flexShrink:0,marginRight:"10px"}}>◉</div>
                  <div style={{padding:"12px 16px",borderRadius:"4px 18px 18px 18px",backgroundColor:"#FAF8F4",border:"1.5px solid #E7E2D9",display:"flex",gap:"5px",alignItems:"center"}}>
                    {[0,1,2].map(j=><div key={j} style={{width:"7px",height:"7px",borderRadius:"50%",backgroundColor:"#B91C1C",animation:"pulse 1.2s ease-in-out infinite",animationDelay:`${j*0.2}s`}}/>)}
                  </div>
                </div>}
                <div ref={chatEndRef}/>
              </div>
              {chatError&&<div style={{padding:"10px 14px",backgroundColor:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"6px",color:"#991B1B",fontSize:"13px",marginBottom:"10px",fontFamily:"monospace"}}>⚠ {chatError}</div>}
              <div style={{display:"flex",gap:"8px",alignItems:"flex-end",backgroundColor:"#FFF",border:"1.5px solid #E7E2D9",borderRadius:"8px",padding:"10px 12px"}}
                onFocusCapture={e=>e.currentTarget.style.borderColor="#B91C1C"}
                onBlurCapture={e=>e.currentTarget.style.borderColor="#E7E2D9"}>
                <textarea ref={chatInputRef} className="chat-ta" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChat();}}} placeholder="Ask anything… (Enter to send, Shift+Enter for newline)" rows={3} style={{flex:1,border:"none",background:"none",fontSize:"14px",lineHeight:"1.7",fontFamily:"'Lora',Georgia,serif",color:"#1C1917",resize:"none",outline:"none",padding:"12px 10px"}}/>
                <button className="send-btn" onClick={()=>sendChat()} disabled={!chatInput.trim()||chatLoading} style={{width:"36px",height:"36px",borderRadius:"50%",backgroundColor:"#B91C1C",color:"white",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:"16px",transition:"background .15s"}}>↑</button>
              </div>
              <div style={{marginTop:"6px",fontSize:"11px",color:"#A8A29E",textAlign:"right"}}>Enter to send · Shift+Enter for newline</div>
            </div>
          )}

          {/* ── TOOL MODES ── */}
          {isToolMode&&mode!=="chat"&&(
            <div>
              {/* Page header */}
              <div style={{marginBottom:"24px",borderBottom:"2px solid #1C1917",paddingBottom:"14px"}}>
                <div style={{fontSize:"11px",letterSpacing:"0.18em",textTransform:"uppercase",color:"#B91C1C",fontWeight:"600",marginBottom:"4px"}}>
                  {{detect:"AI Detect",grammar:"Grammar",plagiarism:"Originality",humanize:"Humanize"}[mode]}
                </div>
                <h1 style={{fontSize:"24px",color:"#1C1917",fontWeight:"600",letterSpacing:"-0.02em",margin:0}}>
                  {{detect:"Scan for AI patterns",grammar:"Check grammar & style",plagiarism:"Verify originality",humanize:"Humanize your writing"}[mode]}
                </h1>
              </div>

              {/* Input */}
              {(appState==="idle"||appState==="error")&&(
                <div>
                  <div style={{marginBottom:"14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                      <label style={{fontSize:"11px",letterSpacing:"0.12em",textTransform:"uppercase",fontWeight:"600",color:"#57534E"}}>
                        {{detect:"Text to analyze",grammar:"Text to check",plagiarism:"Text to verify",humanize:"Text to humanize"}[mode]}
                      </label>
                      <div style={{display:"flex",gap:"12px",alignItems:"center"}}>
                        <span style={{fontSize:"12px",color:"#A8A29E",fontFamily:"monospace"}}>{wc}w</span>
                        <button onClick={()=>setInput(SAMPLE)} style={{fontSize:"11px",color:"#B91C1C",background:"none",border:"none",cursor:"pointer",textDecoration:"underline",fontFamily:"'Lora',Georgia,serif",padding:0}}>Try a sample</button>
                      </div>
                    </div>
                    <textarea className="txt-inp" value={input} onChange={e=>setInput(e.target.value)}
                      placeholder={{detect:"Paste any text to check for AI patterns...",grammar:"Paste text to check for grammar errors...",plagiarism:"Paste text to check for originality...",humanize:"Paste AI-generated text to clean up..."}[mode]}
                      rows={9} style={{width:"100%",boxSizing:"border-box",padding:"16px",fontSize:"15px",lineHeight:"1.7",fontFamily:"'Lora',Georgia,serif",backgroundColor:"#FFF",border:"1.5px solid #E7E2D9",borderRadius:"6px",color:"#1C1917",transition:"border-color .2s,box-shadow .2s"}}/>
                  </div>
                  {mode==="plagiarism"&&<div style={{marginBottom:"12px",padding:"10px 14px",backgroundColor:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:"6px",fontSize:"12px",color:"#0369A1",lineHeight:"1.55"}}>ℹ This check searches publicly indexed web content. Not a substitute for academic plagiarism tools like Turnitin.</div>}
                  {mode==="humanize"&&(
                    <div style={{marginBottom:"12px"}}>
                      <button onClick={()=>setShowVoice(!showVoice)} style={{background:"none",border:"none",cursor:"pointer",padding:0,fontSize:"13px",color:"#78716C",fontFamily:"'Lora',Georgia,serif",display:"flex",alignItems:"center",gap:"8px"}}>
                        <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:"16px",height:"16px",flexShrink:0,border:`1.5px solid ${showVoice?"#B91C1C":"#A8A29E"}`,borderRadius:"3px",backgroundColor:showVoice?"#B91C1C":"transparent",color:"white",fontSize:"10px",fontWeight:"bold",transition:"all .15s"}}>{showVoice?"✓":""}</span>
                        Match my voice (paste a writing sample)
                      </button>
                      {showVoice&&<textarea value={voiceSample} onChange={e=>setVoiceSample(e.target.value)} placeholder="Paste a sample of your own writing..." rows={4} style={{marginTop:"10px",width:"100%",boxSizing:"border-box",padding:"13px",fontSize:"14px",lineHeight:"1.65",fontFamily:"'Lora',Georgia,serif",backgroundColor:"#FFFDF9",border:"1.5px dashed #D6D0C8",borderRadius:"6px",color:"#44403C"}}/>}
                    </div>
                  )}
                  {error&&<div style={{padding:"12px 14px",backgroundColor:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"6px",color:"#991B1B",fontSize:"13px",marginBottom:"12px",fontFamily:"monospace"}}>⚠ {error}</div>}
                  <button className="btn-r" onClick={runMap[mode]} disabled={!input.trim()} style={{width:"100%",padding:"13px",backgroundColor:"#B91C1C",color:"#FFF",border:"none",borderRadius:"6px",fontSize:"14px",fontWeight:"600",letterSpacing:"0.08em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'Lora',Georgia,serif"}}>
                    {btnLabel[mode]}
                  </button>
                </div>
              )}
              {appState==="loading"&&<LoadSteps steps={loadSteps} stage={stage}/>}

              {/* ── DETECT RESULTS ── */}
              {appState==="done"&&mode==="detect"&&(
                <div ref={resultRef}>
                  <FadeIn delay={0} style={{marginBottom:"26px"}}>
                    <div style={{backgroundColor:aiMeta.bg,border:`1.5px solid ${aiMeta.border}`,borderRadius:"10px",padding:"22px",display:"flex",gap:"22px",alignItems:"center",flexWrap:"wrap"}}>
                      <CircleGauge score={dScore} color={dScore<=25?"#16a34a":dScore<=50?"#d97706":dScore<=75?"#ea580c":"#b91c1c"}/>
                      <div style={{flex:1,minWidth:"180px"}}>
                        <div style={{display:"inline-block",padding:"3px 11px",borderRadius:"20px",backgroundColor:aiMeta.color+"20",border:`1px solid ${aiMeta.border}`,fontSize:"10px",fontWeight:"700",letterSpacing:"0.12em",textTransform:"uppercase",color:aiMeta.color,marginBottom:"10px"}}>{aiMeta.label}</div>
                        <p style={{margin:0,fontSize:"14px",lineHeight:"1.7",color:"#44403C"}}>{dSummary}</p>
                      </div>
                    </div>
                  </FadeIn>
                  {Object.keys(catCounts).length>0&&<FadeIn delay={100} style={{marginBottom:"20px"}}><div style={{display:"flex",gap:"7px",flexWrap:"wrap"}}>{Object.entries(catCounts).map(([cat,n])=>{const m=CAT_AI[cat]||{color:"#6B7280",bg:"#F9FAFB",border:"#E5E7EB",label:cat};return <div key={cat} style={{display:"flex",alignItems:"center",gap:"5px",padding:"4px 11px",backgroundColor:m.bg,border:`1px solid ${m.border}`,borderRadius:"20px"}}><span style={{fontSize:"10px",fontWeight:"700",letterSpacing:"0.08em",textTransform:"uppercase",color:m.color}}>{m.label}</span><span style={{minWidth:"16px",height:"16px",borderRadius:"50%",backgroundColor:m.color,color:"white",fontSize:"10px",fontWeight:"700",display:"flex",alignItems:"center",justifyContent:"center"}}>{n}</span></div>;})}</div></FadeIn>}
                  {dFindings.length>0&&<FadeIn delay={160} style={{marginBottom:"22px"}}><SH title="Patterns found" color="#B91C1C"/>
                    <div style={{display:"flex",flexDirection:"column",gap:"9px"}}>
                      {dFindings.map((f,i)=>{const m=CAT_AI[f.category]||{color:"#6B7280",bg:"#F9FAFB",border:"#E5E7EB",label:f.category};return <FadeIn key={i} delay={160+i*50}><div className="finding" style={{backgroundColor:"#FFF",border:"1.5px solid #EDE8E0",borderLeft:`4px solid ${m.color}`,borderRadius:"6px",padding:"13px 15px"}}><div style={{display:"flex",gap:"8px",alignItems:"center",marginBottom:"7px",flexWrap:"wrap"}}><span style={{padding:"2px 9px",borderRadius:"12px",backgroundColor:m.bg,border:`1px solid ${m.border}`,fontSize:"10px",fontWeight:"700",letterSpacing:"0.1em",textTransform:"uppercase",color:m.color}}>{m.label}</span><span style={{fontSize:"13px",fontWeight:"600",color:"#1C1917"}}>{f.pattern}</span></div>{f.quote&&<div style={{fontFamily:"monospace",fontSize:"12px",color:m.color,backgroundColor:m.bg,border:`1px solid ${m.border}`,borderRadius:"4px",padding:"5px 10px",marginBottom:"7px",wordBreak:"break-word"}}>"{f.quote}"</div>}<p style={{margin:0,fontSize:"13px",color:"#57534E",lineHeight:"1.55"}}>{f.note}</p></div></FadeIn>;})}
                    </div>
                  </FadeIn>}
                  {dClean.length>0&&<FadeIn delay={220} style={{marginBottom:"22px"}}><SH title="Human signals" color="#166534"/><div style={{backgroundColor:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:"6px",padding:"14px 16px"}}>{dClean.map((s,i)=><div key={i} style={{display:"flex",gap:"10px",alignItems:"flex-start",marginBottom:i<dClean.length-1?"8px":0}}><span style={{color:"#16a34a",flexShrink:0}}>✓</span><span style={{fontSize:"14px",lineHeight:"1.55",color:"#166534"}}>{s}</span></div>)}</div></FadeIn>}
                  <FadeIn delay={280}><div style={{paddingTop:"18px",borderTop:"1px solid #E7E2D9",display:"flex",gap:"9px",flexWrap:"wrap"}}>
                    {dScore>25&&<button className="btn-r" onClick={()=>{const t=input;setMode("humanize");reset();setTimeout(()=>setInput(t),10);}} style={{padding:"10px 20px",backgroundColor:"#B91C1C",color:"#FFF",border:"none",borderRadius:"6px",fontSize:"13px",fontWeight:"600",letterSpacing:"0.06em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'Lora',Georgia,serif"}}>Fix with Humanize →</button>}
                    <button className="btn-g" onClick={reset} style={{padding:"10px 20px",backgroundColor:"transparent",color:"#57534E",border:"1.5px solid #D6D0C8",borderRadius:"6px",fontSize:"13px",fontWeight:"500",letterSpacing:"0.06em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'Lora',Georgia,serif"}}>Scan another</button>
                    <button className="btn-g" onClick={()=>{setMode("chat");setCtxOn(!!input.trim());}} style={{padding:"10px 20px",backgroundColor:"transparent",color:"#57534E",border:"1.5px solid #D6D0C8",borderRadius:"6px",fontSize:"13px",fontWeight:"500",letterSpacing:"0.06em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'Lora',Georgia,serif"}}>Ask the editor →</button>
                  </div></FadeIn>
                </div>
              )}

              {/* ── GRAMMAR RESULTS ── */}
              {appState==="done"&&mode==="grammar"&&(
                <div ref={resultRef}>
                  <FadeIn delay={0} style={{marginBottom:"26px"}}>
                    <div style={{backgroundColor:"#FFF",border:"1.5px solid #E7E2D9",borderRadius:"10px",padding:"22px",display:"flex",gap:"22px",alignItems:"center",flexWrap:"wrap"}}>
                      <CircleGauge score={gScore} color={gScore>=90?"#16a34a":gScore>=80?"#1D4ED8":gScore>=70?"#d97706":gScore>=60?"#ea580c":"#b91c1c"}/>
                      <div style={{flex:1,minWidth:"180px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px"}}>
                          <div style={{width:"42px",height:"42px",borderRadius:"8px",backgroundColor:getGradeColor(gGrade)+"18",border:`2px solid ${getGradeColor(gGrade)}`,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:"22px",fontWeight:"700",color:getGradeColor(gGrade)}}>{gGrade}</span></div>
                          <div><div style={{fontSize:"13px",fontWeight:"600",color:"#1C1917"}}>{gCount===0?"No errors found":`${gCount} issue${gCount!==1?"s":""} found`}</div><div style={{fontSize:"12px",color:"#78716C"}}>Grammar quality score</div></div>
                        </div>
                        <p style={{margin:0,fontSize:"14px",lineHeight:"1.7",color:"#44403C"}}>{gSummary}</p>
                      </div>
                    </div>
                  </FadeIn>
                  {gErrors.length>0&&(()=>{const tc=gErrors.reduce((a,e)=>{a[e.type]=(a[e.type]||0)+1;return a;},{});return <FadeIn delay={100} style={{marginBottom:"18px"}}><div style={{display:"flex",gap:"7px",flexWrap:"wrap"}}>{Object.entries(tc).map(([type,n])=>{const m=CAT_GRAMMAR[type]||{color:"#6B7280",bg:"#F9FAFB",border:"#E5E7EB",label:type};return <div key={type} style={{display:"flex",alignItems:"center",gap:"5px",padding:"4px 11px",backgroundColor:m.bg,border:`1px solid ${m.border}`,borderRadius:"20px"}}><span style={{fontSize:"10px",fontWeight:"700",letterSpacing:"0.08em",textTransform:"uppercase",color:m.color}}>{m.label}</span><span style={{minWidth:"16px",height:"16px",borderRadius:"50%",backgroundColor:m.color,color:"white",fontSize:"10px",fontWeight:"700",display:"flex",alignItems:"center",justifyContent:"center"}}>{n}</span></div>;})}</div></FadeIn>;})()}
                  {gErrors.length>0?<FadeIn delay={150} style={{marginBottom:"22px"}}><SH title="Issues found" color="#B91C1C"/><div style={{display:"flex",flexDirection:"column",gap:"9px"}}>{gErrors.map((e,i)=>{const m=CAT_GRAMMAR[e.type]||{color:"#6B7280",bg:"#F9FAFB",border:"#E5E7EB",label:e.type};return <FadeIn key={i} delay={150+i*45}><div className="finding" style={{backgroundColor:"#FFF",border:"1.5px solid #EDE8E0",borderLeft:`4px solid ${m.color}`,borderRadius:"6px",padding:"13px 15px"}}><div style={{display:"flex",gap:"8px",alignItems:"center",marginBottom:"8px"}}><span style={{padding:"2px 9px",borderRadius:"12px",backgroundColor:m.bg,border:`1px solid ${m.border}`,fontSize:"10px",fontWeight:"700",letterSpacing:"0.1em",textTransform:"uppercase",color:m.color}}>{m.label}</span></div><div style={{display:"flex",gap:"10px",marginBottom:"8px",flexWrap:"wrap"}}><div style={{flex:1,minWidth:"120px"}}><div style={{fontSize:"10px",letterSpacing:"0.08em",textTransform:"uppercase",color:"#A8A29E",marginBottom:"4px"}}>Original</div><div style={{fontFamily:"monospace",fontSize:"12px",color:"#B91C1C",backgroundColor:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"4px",padding:"5px 9px",wordBreak:"break-word"}}>{e.original}</div></div><div style={{display:"flex",alignItems:"center",paddingTop:"18px",color:"#A8A29E"}}>→</div><div style={{flex:1,minWidth:"120px"}}><div style={{fontSize:"10px",letterSpacing:"0.08em",textTransform:"uppercase",color:"#A8A29E",marginBottom:"4px"}}>Corrected</div><div style={{fontFamily:"monospace",fontSize:"12px",color:"#166534",backgroundColor:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:"4px",padding:"5px 9px",wordBreak:"break-word"}}>{e.corrected}</div></div></div><p style={{margin:0,fontSize:"13px",color:"#57534E",lineHeight:"1.55"}}>{e.explanation}</p></div></FadeIn>;})}</div></FadeIn>
                  :<FadeIn delay={150} style={{marginBottom:"22px"}}><div style={{backgroundColor:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:"6px",padding:"24px",textAlign:"center"}}><div style={{fontSize:"28px",marginBottom:"8px"}}>✓</div><p style={{margin:0,fontSize:"15px",color:"#166534",fontWeight:"600"}}>No errors found</p></div></FadeIn>}
                  {gStrengths.length>0&&<FadeIn delay={200} style={{marginBottom:"22px"}}><SH title="What's working" color="#166534"/><div style={{backgroundColor:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:"6px",padding:"14px 16px"}}>{gStrengths.map((s,i)=><div key={i} style={{display:"flex",gap:"10px",alignItems:"flex-start",marginBottom:i<gStrengths.length-1?"8px":0}}><span style={{color:"#16a34a",flexShrink:0}}>✓</span><span style={{fontSize:"14px",lineHeight:"1.55",color:"#166534"}}>{s}</span></div>)}</div></FadeIn>}
                  {gFixed&&gErrors.length>0&&<FadeIn delay={250} style={{marginBottom:"22px"}}><SH title="Corrected text" color="#1D4ED8"/><div style={{backgroundColor:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:"6px",padding:"18px",fontSize:"15px",lineHeight:"1.8",whiteSpace:"pre-wrap",color:"#1C1917"}}>{gFixed}</div><CopyBtn text={gFixed}/></FadeIn>}
                  <FadeIn delay={300}><div style={{paddingTop:"18px",borderTop:"1px solid #E7E2D9",display:"flex",gap:"9px",flexWrap:"wrap"}}>
                    <button className="btn-g" onClick={reset} style={{padding:"10px 20px",backgroundColor:"transparent",color:"#57534E",border:"1.5px solid #D6D0C8",borderRadius:"6px",fontSize:"13px",fontWeight:"500",letterSpacing:"0.06em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'Lora',Georgia,serif"}}>Check another</button>
                    <button className="btn-g" onClick={()=>{setMode("chat");setCtxOn(!!input.trim());}} style={{padding:"10px 20px",backgroundColor:"transparent",color:"#57534E",border:"1.5px solid #D6D0C8",borderRadius:"6px",fontSize:"13px",fontWeight:"500",letterSpacing:"0.06em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'Lora',Georgia,serif"}}>Ask the editor →</button>
                  </div></FadeIn>
                </div>
              )}

              {/* ── PLAGIARISM RESULTS ── */}
              {appState==="done"&&mode==="plagiarism"&&(
                <div ref={resultRef}>
                  <FadeIn delay={0} style={{marginBottom:"26px"}}><div style={{backgroundColor:riskMeta.bg,border:`1.5px solid ${riskMeta.border}`,borderRadius:"10px",padding:"22px",display:"flex",gap:"22px",alignItems:"center",flexWrap:"wrap"}}><CircleGauge score={pScore} color={pScore>=75?"#16a34a":pScore>=50?"#d97706":"#b91c1c"}/><div style={{flex:1,minWidth:"180px"}}><div style={{display:"inline-block",padding:"3px 11px",borderRadius:"20px",backgroundColor:riskMeta.color+"20",border:`1px solid ${riskMeta.border}`,fontSize:"10px",fontWeight:"700",letterSpacing:"0.12em",textTransform:"uppercase",color:riskMeta.color,marginBottom:"10px"}}>{riskMeta.label}</div><p style={{margin:0,fontSize:"14px",lineHeight:"1.7",color:"#44403C"}}>{pSummary}</p></div></div></FadeIn>
                  {pMatches.length>0&&<FadeIn delay={130} style={{marginBottom:"22px"}}><SH title="Phrases checked" color="#B45309"/><div style={{border:"1.5px solid #EDE8E0",borderRadius:"6px",overflow:"hidden",backgroundColor:"#FFF"}}><div style={{display:"grid",gridTemplateColumns:"1fr auto auto",backgroundColor:"#FAF8F4",borderBottom:"1px solid #EDE8E0",padding:"8px 14px",gap:"10px"}}>{["Phrase","Match","Source"].map(h=><span key={h} style={{fontSize:"10px",fontWeight:"700",letterSpacing:"0.1em",textTransform:"uppercase",color:"#78716C"}}>{h}</span>)}</div>{pMatches.map((m,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"1fr auto auto",padding:"11px 14px",borderBottom:i<pMatches.length-1?"1px solid #F0EBE3":"none",gap:"10px",alignItems:"start",background:i%2===1?"#FAFAF8":"white"}}><div><div style={{fontSize:"13px",color:"#1C1917",lineHeight:"1.5",marginBottom:"3px"}}>"{m.phrase}"</div><div style={{fontSize:"12px",color:"#78716C"}}>{m.note}</div></div><div style={{paddingTop:"2px",textAlign:"center"}}><span style={{fontSize:"16px"}}>{m.found?"⚠":"✓"}</span></div><div style={{paddingTop:"2px",minWidth:"90px"}}>{m.found&&m.url?<a href={m.url} target="_blank" rel="noreferrer" style={{fontSize:"12px",color:"#B91C1C",wordBreak:"break-all",textDecoration:"underline"}}>{m.source||m.url}</a>:<span style={{fontSize:"12px",color:"#A8A29E"}}>{m.found?(m.source||"Unknown"):"Not found"}</span>}</div></div>)}</div></FadeIn>}
                  {pOriginal.length>0&&<FadeIn delay={190} style={{marginBottom:"22px"}}><SH title="Appears original" color="#166534"/><div style={{backgroundColor:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:"6px",padding:"14px 16px"}}>{pOriginal.map((s,i)=><div key={i} style={{display:"flex",gap:"10px",alignItems:"flex-start",marginBottom:i<pOriginal.length-1?"8px":0}}><span style={{color:"#16a34a",flexShrink:0}}>✓</span><span style={{fontSize:"14px",lineHeight:"1.55",color:"#166534"}}>{s}</span></div>)}</div></FadeIn>}
                  {pDisclaimer&&<FadeIn delay={230} style={{marginBottom:"22px"}}><div style={{padding:"10px 14px",backgroundColor:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:"6px",fontSize:"12px",color:"#0369A1",lineHeight:"1.55"}}>ℹ {pDisclaimer}</div></FadeIn>}
                  <FadeIn delay={280}><div style={{paddingTop:"18px",borderTop:"1px solid #E7E2D9",display:"flex",gap:"9px",flexWrap:"wrap"}}><button className="btn-g" onClick={reset} style={{padding:"10px 20px",backgroundColor:"transparent",color:"#57534E",border:"1.5px solid #D6D0C8",borderRadius:"6px",fontSize:"13px",fontWeight:"500",letterSpacing:"0.06em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'Lora',Georgia,serif"}}>Check another</button></div></FadeIn>
                </div>
              )}

              {/* ── HUMANIZE RESULTS ── */}
              {appState==="done"&&mode==="humanize"&&(
                <div ref={resultRef}>
                  <div style={{marginBottom:"18px",paddingBottom:"14px",borderBottom:"1px solid #E7E2D9"}}><p style={{margin:0,fontSize:"13px",color:"#78716C",fontStyle:"italic"}}>Here's what happened to your text.</p></div>
                  <FadeIn delay={0} style={{marginBottom:"20px"}}><SH title="Draft rewrite" color="#D97706"/><div style={{backgroundColor:"#FFFBF0",border:"1px solid #FDE68A",borderRadius:"6px",padding:"18px",fontSize:"15px",lineHeight:"1.8",whiteSpace:"pre-wrap",color:"#44403C"}}>{hDraft}</div></FadeIn>
                  <FadeIn delay={200} style={{marginBottom:"20px"}}><SH title="AI audit — what still gives it away" color="#B91C1C"/><div style={{backgroundColor:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"6px",padding:"14px 16px"}}>{hAudit.map((item,i)=><div key={i} style={{display:"flex",gap:"10px",alignItems:"flex-start",marginBottom:i<hAudit.length-1?"10px":0}}><span style={{color:"#B91C1C",flexShrink:0}}>✗</span><span style={{fontSize:"14px",lineHeight:"1.6",color:"#7F1D1D"}}>{item}</span></div>)}</div></FadeIn>
                  <FadeIn delay={400} style={{marginBottom:"20px"}}><SH title="Final rewrite" color="#166534"/><div style={{backgroundColor:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:"6px",padding:"18px",fontSize:"15px",lineHeight:"1.8",whiteSpace:"pre-wrap",color:"#1C1917",position:"relative"}}><div style={{position:"absolute",top:"12px",right:"12px",fontSize:"10px",color:"#166534",letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:"700"}}>✓ Humanized</div>{hFinal}</div><CopyBtn text={hFinal}/></FadeIn>
                  {hChanges.length>0&&<FadeIn delay={580} style={{marginBottom:"20px"}}><SH title="Patterns removed" color="#6B7280"/><div style={{display:"flex",flexWrap:"wrap",gap:"7px"}}>{hChanges.map((c,i)=><div key={i} style={{padding:"4px 11px",border:"1px solid #E7E2D9",borderRadius:"20px",fontSize:"12px",color:"#57534E",backgroundColor:"#FAFAF8",lineHeight:"1.5"}}>{c}</div>)}</div></FadeIn>}
                  <div style={{paddingTop:"18px",borderTop:"1px solid #E7E2D9",display:"flex",gap:"9px",flexWrap:"wrap"}}>
                    <button className="btn-r" onClick={reset} style={{padding:"10px 20px",backgroundColor:"#1C1917",color:"#FAF8F4",border:"none",borderRadius:"6px",fontSize:"13px",fontWeight:"600",letterSpacing:"0.08em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'Lora',Georgia,serif"}}>Start over</button>
                    <button className="btn-g" onClick={()=>{const f=hFinal;reset();setTimeout(()=>setInput(f),10);}} style={{padding:"10px 20px",backgroundColor:"transparent",color:"#57534E",border:"1.5px solid #D6D0C8",borderRadius:"6px",fontSize:"13px",fontWeight:"500",letterSpacing:"0.06em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'Lora',Georgia,serif"}}>Run again on final</button>
                    <button className="btn-g" onClick={()=>{const f=hFinal;reset();setMode("detect");setTimeout(()=>setInput(f),10);}} style={{padding:"10px 20px",backgroundColor:"transparent",color:"#57534E",border:"1.5px solid #D6D0C8",borderRadius:"6px",fontSize:"13px",fontWeight:"500",letterSpacing:"0.06em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'Lora',Georgia,serif"}}>Verify AI score →</button>
                    <button className="btn-g" onClick={()=>{setMode("chat");setCtxOn(true);}} style={{padding:"10px 20px",backgroundColor:"transparent",color:"#57534E",border:"1.5px solid #D6D0C8",borderRadius:"6px",fontSize:"13px",fontWeight:"500",letterSpacing:"0.06em",textTransform:"uppercase",cursor:"pointer",fontFamily:"'Lora',Georgia,serif"}}>Ask the editor →</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div style={{marginTop:"48px",paddingTop:"16px",borderTop:"1px solid #E7E2D9",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:"6px"}}>
            <span style={{fontSize:"11px",color:"#A8A29E",letterSpacing:"0.06em"}}>RedPen.AI · v3.0 · 5 tools</span>
            <span style={{fontSize:"11px",color:"#A8A29E",fontStyle:"italic"}}>Powered by Claude · Based on Wikipedia's AI Writing Patterns guide</span>
          </div>

        </div>
        </div>
      </div>
    </div>
  );
}