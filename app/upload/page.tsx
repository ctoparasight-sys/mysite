"use client";

// =================================================================
// app/upload/page.tsx — Carrierwave RO Submission Wizard
//
// 8 steps:
//   1. What kind of result?    roType + dataType
//   2. The experiment          species + experimentalSystem + orcid
//   3. The content             title + abstract + claim + description
//   4. Methods & reagents      methods + reagents[]
//   5. Evidence quality        confidence + replicateCount + statisticalMethod
//   6. Relationships           link to existing ROs
//   7. Files                   figure + dataFile
//   8. Rights & submit         commercial + disease tags + ipStatus + license
// =================================================================

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// ── Types (inline to avoid import issues during setup) ────────

type ROType = "new_finding" | "negative_result" | "replication_successful"
  | "replication_unsuccessful" | "methodology" | "materials_reagents" | "data_update";
type DataType = "expression_data" | "phenotype_data" | "interaction_data" | "genomic"
  | "cell_culture" | "biochemistry" | "structural_biology" | "computational"
  | "methodology" | "ecology_evolution" | "other";
type ExperimentalSystem = "in_vivo" | "in_vitro" | "ex_vivo" | "in_silico" | "clinical_sample";
type ConfidenceLevel = 1 | 2 | 3;
type StatisticalMethod = "none" | "t_test" | "anova" | "chi_square" | "mann_whitney"
  | "fisher_exact" | "linear_regression" | "survival_analysis" | "other";
type IPStatus = "no_restrictions" | "institutional_review_pending" | "licensed";
type License = "CC-BY-4.0" | "delayed_commercial";
type RelationshipType = "replicates" | "contradicts" | "extends" | "derives_from" | "uses_method_from";
interface Reagent { name: string; type: string; identifier: string; source: string; }
interface FormRelationship { type: RelationshipType | ""; targetId: string; targetTitle: string; note: string; }

interface FormState {
  // Step 1
  roType: ROType | "";
  dataType: DataType | "";
  // Step 2
  species: string;
  experimentalSystem: ExperimentalSystem | "";
  orcid: string;
  // Step 3
  title: string;
  abstract: string;
  claim: string;
  description: string;
  // Step 4
  methods: string;
  reagents: Reagent[];
  // Step 5
  confidence: ConfidenceLevel | 0;
  replicateCount: string;
  statisticalMethod: StatisticalMethod | "";
  // Step 6
  relationships: FormRelationship[];
  // Step 7
  figureFile: File | null;
  dataFile: File | null;
  // Step 8
  hasCommercialRelevance: boolean;
  diseaseTagInput: string;
  diseaseAreaTags: string[];
  ipStatus: IPStatus | "";
  license: License | "";
}

// ── Labels ────────────────────────────────────────────────────

const RO_TYPE_OPTIONS: { value: ROType; label: string; desc: string; icon: string }[] = [
  { value: "new_finding",              label: "New Finding",           icon: "🔬", desc: "A novel experimental result" },
  { value: "negative_result",          label: "Negative Result",       icon: "⊘",  desc: "A null or failed experiment" },
  { value: "replication_successful",   label: "Replication ✓",         icon: "✓",  desc: "Independently confirmed" },
  { value: "replication_unsuccessful", label: "Replication ✗",         icon: "✗",  desc: "Could not reproduce" },
  { value: "methodology",              label: "Methodology",           icon: "📐", desc: "A protocol or method" },
  { value: "materials_reagents",       label: "Reagents",              icon: "🧪", desc: "Validated materials" },
  { value: "data_update",              label: "Data Update",           icon: "📊", desc: "New data to existing work" },
];

const DATA_TYPE_OPTIONS: { value: DataType; label: string }[] = [
  { value: "expression_data",    label: "Expression data" },
  { value: "phenotype_data",     label: "Phenotype data" },
  { value: "interaction_data",   label: "Interaction data" },
  { value: "genomic",            label: "Genomic" },
  { value: "cell_culture",       label: "Cell culture" },
  { value: "biochemistry",       label: "Biochemistry" },
  { value: "structural_biology", label: "Structural biology" },
  { value: "computational",      label: "Computational" },
  { value: "methodology",        label: "Methodology" },
  { value: "ecology_evolution",  label: "Ecology / evolution" },
  { value: "other",              label: "Other" },
];

const EXP_SYSTEM_OPTIONS: { value: ExperimentalSystem; label: string; desc: string }[] = [
  { value: "in_vivo",        label: "In vivo",         desc: "Living organism" },
  { value: "in_vitro",       label: "In vitro",        desc: "Cell/tissue culture" },
  { value: "ex_vivo",        label: "Ex vivo",         desc: "Tissue outside organism" },
  { value: "in_silico",      label: "In silico",       desc: "Computational" },
  { value: "clinical_sample",label: "Clinical sample", desc: "Human biospecimen" },
];

const STAT_OPTIONS: { value: StatisticalMethod; label: string }[] = [
  { value: "none",                label: "None / descriptive" },
  { value: "t_test",              label: "t-test" },
  { value: "anova",               label: "ANOVA" },
  { value: "chi_square",          label: "Chi-square" },
  { value: "mann_whitney",        label: "Mann-Whitney U" },
  { value: "fisher_exact",        label: "Fisher's exact" },
  { value: "linear_regression",   label: "Linear regression" },
  { value: "survival_analysis",   label: "Survival analysis" },
  { value: "other",               label: "Other" },
];

const REAGENT_TYPES = ["strain", "antibody", "plasmid", "chemical", "cell_line", "other"];

const RELATIONSHIP_TYPE_OPTIONS: { value: RelationshipType; label: string }[] = [
  { value: "replicates",       label: "Replicates" },
  { value: "contradicts",      label: "Contradicts" },
  { value: "extends",          label: "Extends" },
  { value: "derives_from",     label: "Derives from" },
  { value: "uses_method_from", label: "Uses method from" },
];

const TOTAL_STEPS = 8;

// ── Styles ────────────────────────────────────────────────────

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:      #080b11;
    --surface: #0f1420;
    --surface2:#131926;
    --border:  #1a2035;
    --muted:   #263050;
    --subtle:  #4a5580;
    --text:    #c0c8e0;
    --bright:  #e8edf8;
    --accent:  #4f8cff;
    --accent2: #2eddaa;
    --warn:    #ff6b6b;
    --mono:    'DM Mono', monospace;
    --sans:    'DM Sans', system-ui, sans-serif;
    --r:       10px;
    --t:       160ms ease;
  }

  body {
    background: var(--bg); color: var(--text);
    font-family: var(--sans); font-size: 15px; line-height: 1.6;
    min-height: 100vh;
  }

  body::before {
    content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background-image:
      linear-gradient(rgba(79,140,255,0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(79,140,255,0.02) 1px, transparent 1px);
    background-size: 56px 56px;
  }

  .wz-wrap {
    max-width: 720px; margin: 0 auto;
    padding: 40px 24px 100px; position: relative; z-index: 1;
  }

  /* Nav */
  .wz-nav {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 40px;
  }
  .wz-wordmark {
    font-family: Helvetica, Arial, sans-serif; font-size: 20px; font-weight: 700;
    color: var(--bright); text-decoration: none; letter-spacing: -0.3px;
  }
  .wz-wordmark em { color: var(--accent); font-style: italic; }

  /* Progress */
  .wz-progress { margin-bottom: 48px; }
  .wz-progress-track {
    display: flex; gap: 6px; margin-bottom: 16px;
  }
  .wz-progress-seg {
    flex: 1; height: 3px; border-radius: 2px;
    background: var(--muted); transition: background 400ms ease;
  }
  .wz-progress-seg.done { background: var(--accent2); }
  .wz-progress-seg.active { background: var(--accent); }
  .wz-progress-label {
    display: flex; justify-content: space-between;
    font-family: var(--mono); font-size: 11px; color: var(--subtle);
  }
  .wz-progress-label span { color: var(--accent); }

  /* Step header */
  .wz-step-header { margin-bottom: 32px; }
  .wz-step-eyebrow {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--subtle); margin-bottom: 10px;
  }
  .wz-step-title {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 26px; font-weight: 700; color: var(--bright);
    letter-spacing: -0.5px; margin-bottom: 8px;
  }
  .wz-step-sub { font-size: 14px; color: var(--subtle); }

  /* Fields */
  .wz-field { margin-bottom: 24px; }
  .wz-label {
    display: block; font-size: 13px; font-weight: 500;
    color: var(--bright); margin-bottom: 8px;
  }
  .wz-label-sub {
    font-family: var(--mono); font-size: 10px; color: var(--subtle);
    margin-left: 8px; font-weight: 400;
  }
  .wz-input, .wz-textarea, .wz-select {
    width: 100%; background: var(--surface);
    border: 1px solid var(--border); border-radius: var(--r);
    color: var(--bright); font-family: var(--sans); font-size: 14px;
    padding: 11px 14px; outline: none;
    transition: border-color var(--t), box-shadow var(--t);
  }
  .wz-input:focus, .wz-textarea:focus, .wz-select:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(79,140,255,0.1);
  }
  .wz-input::placeholder, .wz-textarea::placeholder { color: var(--subtle); }
  .wz-textarea { resize: vertical; min-height: 100px; line-height: 1.6; }
  .wz-select { appearance: none; cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%234a5580' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 14px center;
    padding-right: 36px;
  }
  .wz-char-count {
    font-family: var(--mono); font-size: 10px; color: var(--subtle);
    text-align: right; margin-top: 5px;
  }
  .wz-char-count.warn { color: var(--warn); }

  /* Card grids */
  .wz-card-grid { display: grid; gap: 10px; }
  .wz-card-grid-2 { grid-template-columns: repeat(2, 1fr); }
  .wz-card-grid-3 { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 500px) {
    .wz-card-grid-2, .wz-card-grid-3 { grid-template-columns: 1fr; }
  }

  .wz-option-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); padding: 14px 16px;
    cursor: pointer; transition: all var(--t); user-select: none;
  }
  .wz-option-card:hover { border-color: var(--subtle); }
  .wz-option-card.selected {
    border-color: var(--accent);
    background: rgba(79,140,255,0.08);
  }
  .wz-option-card-icon { font-size: 20px; margin-bottom: 7px; display: block; }
  .wz-option-card-label { font-size: 13px; font-weight: 500; color: var(--bright); }
  .wz-option-card-desc { font-size: 11px; color: var(--subtle); margin-top: 3px; }

  .wz-exp-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); padding: 14px 16px;
    cursor: pointer; transition: all var(--t); user-select: none;
    display: flex; align-items: center; justify-content: space-between;
  }
  .wz-exp-card:hover { border-color: var(--subtle); }
  .wz-exp-card.selected { border-color: var(--accent); background: rgba(79,140,255,0.08); }
  .wz-exp-card-label { font-size: 13px; font-weight: 500; color: var(--bright); }
  .wz-exp-card-desc { font-size: 11px; color: var(--subtle); margin-top: 2px; }
  .wz-exp-card-check {
    width: 18px; height: 18px; border-radius: 50%;
    border: 2px solid var(--border); flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; color: var(--accent); transition: all var(--t);
  }
  .wz-exp-card.selected .wz-exp-card-check {
    background: var(--accent); border-color: var(--accent); color: white;
  }

  /* Confidence selector */
  .wz-conf-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .wz-conf-card {
    background: var(--surface); border: 2px solid var(--border);
    border-radius: 12px; padding: 20px 16px; cursor: pointer;
    transition: all var(--t); text-align: center; user-select: none;
  }
  .wz-conf-card:hover { border-color: var(--subtle); }
  .wz-conf-card.selected-1 { border-color: #ff9f43; background: rgba(255,159,67,0.08); }
  .wz-conf-card.selected-2 { border-color: var(--accent); background: rgba(79,140,255,0.08); }
  .wz-conf-card.selected-3 { border-color: var(--accent2); background: rgba(46,221,170,0.08); }
  .wz-conf-dots { display: flex; justify-content: center; gap: 5px; margin-bottom: 10px; }
  .wz-conf-dot { width: 10px; height: 10px; border-radius: 50%; }
  .wz-conf-level { font-size: 15px; font-weight: 600; color: var(--bright); margin-bottom: 4px; }
  .wz-conf-desc { font-size: 11px; color: var(--subtle); line-height: 1.5; }

  /* Reagents */
  .wz-reagent-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
  .wz-reagent-row {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); padding: 14px 16px;
    display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
  }
  .wz-reagent-row-top { grid-column: 1 / -1; display: flex; gap: 10px; align-items: center; }
  .wz-reagent-del {
    margin-left: auto; background: transparent; border: none;
    color: var(--subtle); cursor: pointer; font-size: 18px; padding: 0 4px;
    transition: color var(--t); line-height: 1;
  }
  .wz-reagent-del:hover { color: var(--warn); }

  /* File upload */
  .wz-dropzone {
    border: 2px dashed var(--border); border-radius: var(--r);
    padding: 32px; text-align: center; cursor: pointer;
    transition: all var(--t);
    background: var(--surface);
  }
  .wz-dropzone:hover, .wz-dropzone.drag-over {
    border-color: var(--accent); background: rgba(79,140,255,0.05);
  }
  .wz-dropzone-icon { font-size: 28px; margin-bottom: 10px; }
  .wz-dropzone-label { font-size: 13px; color: var(--text); margin-bottom: 4px; }
  .wz-dropzone-sub { font-family: var(--mono); font-size: 11px; color: var(--subtle); }
  .wz-file-chosen {
    display: flex; align-items: center; gap: 10px;
    background: rgba(46,221,170,0.06); border: 1px solid rgba(46,221,170,0.2);
    border-radius: var(--r); padding: 12px 16px; margin-top: 10px;
    font-family: var(--mono); font-size: 12px; color: var(--accent2);
  }

  /* Disease tags */
  .wz-tags { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 10px; }
  .wz-tag {
    display: flex; align-items: center; gap: 6px;
    background: rgba(79,140,255,0.1); border: 1px solid rgba(79,140,255,0.25);
    border-radius: 14px; padding: 4px 12px;
    font-family: var(--mono); font-size: 12px; color: var(--accent);
  }
  .wz-tag-x {
    cursor: pointer; color: var(--subtle); font-size: 14px; line-height: 1;
    transition: color var(--t);
  }
  .wz-tag-x:hover { color: var(--warn); }

  /* License cards */
  .wz-license-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .wz-license-card {
    background: var(--surface); border: 2px solid var(--border);
    border-radius: var(--r); padding: 18px; cursor: pointer;
    transition: all var(--t); user-select: none;
  }
  .wz-license-card:hover { border-color: var(--subtle); }
  .wz-license-card.selected { border-color: var(--accent); background: rgba(79,140,255,0.08); }
  .wz-license-title { font-size: 14px; font-weight: 600; color: var(--bright); margin-bottom: 6px; }
  .wz-license-desc { font-size: 12px; color: var(--subtle); line-height: 1.6; }

  /* Review panel */
  .wz-review {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 14px; padding: 24px; margin-bottom: 24px;
  }
  .wz-review-row {
    display: flex; gap: 16px; padding: 10px 0;
    border-bottom: 1px solid var(--border);
  }
  .wz-review-row:last-child { border-bottom: none; }
  .wz-review-key {
    font-family: var(--mono); font-size: 11px; color: var(--subtle);
    width: 160px; flex-shrink: 0; padding-top: 2px;
  }
  .wz-review-val { font-size: 13px; color: var(--text); }
  .wz-review-val.bright { color: var(--bright); font-weight: 500; }
  .wz-review-claim {
    font-family: var(--mono); font-size: 12px; color: var(--accent2);
    background: rgba(46,221,170,0.06); border: 1px solid rgba(46,221,170,0.15);
    border-radius: 6px; padding: 8px 10px; line-height: 1.55;
  }

  /* Navigation buttons */
  .wz-nav-buttons {
    display: flex; justify-content: space-between; align-items: center;
    margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--border);
  }
  .wz-btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 11px 24px; border-radius: var(--r);
    font-size: 14px; font-weight: 500; font-family: var(--sans);
    cursor: pointer; transition: all var(--t);
    border: 1px solid transparent;
  }
  .wz-btn-primary { background: var(--accent); color: white; }
  .wz-btn-primary:hover { background: #6fa3ff; transform: translateY(-1px); }
  .wz-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .wz-btn-ghost { background: transparent; border-color: var(--border); color: var(--text); }
  .wz-btn-ghost:hover { border-color: var(--subtle); color: var(--bright); }
  .wz-btn-submit {
    background: var(--accent2); color: #0a1a14;
    font-weight: 600; padding: 13px 32px; border-radius: 12px;
  }
  .wz-btn-submit:hover { background: #3ef5c0; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(46,221,170,0.25); }
  .wz-btn-submit:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }

  /* Error */
  .wz-error {
    background: rgba(255,107,107,0.08); border: 1px solid rgba(255,107,107,0.25);
    border-radius: var(--r); padding: 12px 16px;
    font-family: var(--mono); font-size: 12px; color: var(--warn);
    margin-bottom: 20px;
  }

  /* Success */
  .wz-success {
    text-align: center; padding: 80px 24px;
  }
  .wz-success-icon { font-size: 56px; margin-bottom: 24px; display: block; }
  .wz-success-title {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 28px; font-weight: 700; color: var(--bright);
    margin-bottom: 12px; letter-spacing: -0.5px;
  }
  .wz-success-hash {
    font-family: var(--mono); font-size: 11px; color: var(--subtle);
    word-break: break-all; margin: 16px 0 32px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); padding: 12px;
  }

  @keyframes wz-in { from { opacity:0; transform:translateX(12px); } to { opacity:1; transform:translateX(0); } }
  .wz-step-body { animation: wz-in 250ms ease both; }

  @keyframes wz-spin { to { transform: rotate(360deg); } }
  .wz-spinner {
    width: 16px; height: 16px; border-radius: 50%;
    border: 2px solid rgba(10,26,20,0.3); border-top-color: #0a1a14;
    animation: wz-spin 0.6s linear infinite; display: inline-block;
  }
`;

// ── Word counter ──────────────────────────────────────────────

function wordCount(text: string) {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

// ── Initial form state ────────────────────────────────────────

const INITIAL: FormState = {
  roType: "", dataType: "",
  species: "", experimentalSystem: "", orcid: "",
  title: "", abstract: "", claim: "", description: "",
  methods: "", reagents: [],
  confidence: 0, replicateCount: "1", statisticalMethod: "",
  relationships: [],
  figureFile: null, dataFile: null,
  hasCommercialRelevance: false, diseaseTagInput: "",
  diseaseAreaTags: [], ipStatus: "", license: "",
};

// ── Relationship step sub-component ───────────────────────────

function RelationshipStep({ form, setForm }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  const [searchQueries, setSearchQueries] = useState<Record<number, string>>({});
  const [searchResults, setSearchResults] = useState<Record<number, { id: string; title: string }[]>>({});
  const debounceRefs = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  function addRelationship() {
    setForm(f => ({
      ...f,
      relationships: [...f.relationships, { type: "", targetId: "", targetTitle: "", note: "" }],
    }));
  }

  function updateRelationship(idx: number, field: keyof FormRelationship, value: string) {
    setForm(f => {
      const rels = [...f.relationships];
      rels[idx] = { ...rels[idx], [field]: value };
      return { ...f, relationships: rels };
    });
  }

  function removeRelationship(idx: number) {
    setForm(f => ({
      ...f,
      relationships: f.relationships.filter((_, i) => i !== idx),
    }));
    setSearchQueries(q => { const next = { ...q }; delete next[idx]; return next; });
    setSearchResults(r => { const next = { ...r }; delete next[idx]; return next; });
  }

  function handleSearch(idx: number, query: string) {
    setSearchQueries(q => ({ ...q, [idx]: query }));
    if (debounceRefs.current[idx]) clearTimeout(debounceRefs.current[idx]);
    if (!query.trim()) {
      setSearchResults(r => ({ ...r, [idx]: [] }));
      return;
    }
    debounceRefs.current[idx] = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ro/list?search=${encodeURIComponent(query)}&limit=10`);
        const data = await res.json();
        const results = (data.ros ?? []).map((r: any) => ({ id: r.id, title: r.title }));
        setSearchResults(prev => ({ ...prev, [idx]: results }));
      } catch {
        setSearchResults(prev => ({ ...prev, [idx]: [] }));
      }
    }, 300);
  }

  function selectTarget(idx: number, id: string, title: string) {
    updateRelationship(idx, "targetId", id);
    updateRelationship(idx, "targetTitle", title);
    setSearchQueries(q => ({ ...q, [idx]: "" }));
    setSearchResults(r => ({ ...r, [idx]: [] }));
  }

  return (
    <>
      {form.relationships.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          {form.relationships.map((rel, i) => (
            <div key={i} style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: "var(--r)", padding: "16px",
            }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
                <select
                  className="wz-select"
                  value={rel.type}
                  onChange={e => updateRelationship(i, "type", e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="">Relationship type...</option>
                  {RELATIONSHIP_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => removeRelationship(i)}
                  style={{
                    background: "transparent", border: "none", color: "var(--subtle)",
                    cursor: "pointer", fontSize: 18, padding: "0 4px", lineHeight: 1,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--warn)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--subtle)")}
                >
                  x
                </button>
              </div>

              {/* Target RO */}
              {rel.targetId ? (
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: "rgba(46,221,170,0.06)", border: "1px solid rgba(46,221,170,0.2)",
                  borderRadius: "var(--r)", padding: "10px 14px", marginBottom: 10,
                  fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent2)",
                }}>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {rel.targetTitle || rel.targetId}
                  </span>
                  <span
                    style={{ cursor: "pointer", color: "var(--subtle)", fontSize: 14 }}
                    onClick={() => {
                      updateRelationship(i, "targetId", "");
                      updateRelationship(i, "targetTitle", "");
                    }}
                  >x</span>
                </div>
              ) : (
                <div style={{ position: "relative", marginBottom: 10 }}>
                  <input
                    className="wz-input"
                    type="text"
                    placeholder="Search for an existing RO by title..."
                    value={searchQueries[i] ?? ""}
                    onChange={e => handleSearch(i, e.target.value)}
                  />
                  {(searchResults[i]?.length ?? 0) > 0 && (
                    <div style={{
                      position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                      background: "var(--surface)", border: "1px solid var(--border)",
                      borderRadius: "0 0 var(--r) var(--r)", maxHeight: 200, overflowY: "auto",
                    }}>
                      {searchResults[i].map(r => (
                        <div
                          key={r.id}
                          onClick={() => selectTarget(i, r.id, r.title)}
                          style={{
                            padding: "10px 14px", cursor: "pointer", fontSize: 13,
                            color: "var(--text)", borderBottom: "1px solid var(--border)",
                            transition: "background 100ms",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <div style={{ fontWeight: 500, color: "var(--bright)", marginBottom: 2 }}>{r.title}</div>
                          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--subtle)" }}>{r.id.slice(0, 8)}...</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Optional note */}
              <input
                className="wz-input"
                type="text"
                placeholder="Note (optional)"
                value={rel.note}
                onChange={e => updateRelationship(i, "note", e.target.value)}
              />
            </div>
          ))}
        </div>
      )}

      <button
        className="wz-btn wz-btn-ghost"
        style={{ fontSize: 13 }}
        onClick={addRelationship}
      >
        + Add relationship
      </button>

      {form.relationships.length === 0 && (
        <p style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--subtle)", marginTop: 16 }}>
          No relationships added. You can skip this step if this RO is standalone.
        </p>
      )}
    </>
  );
}

// ── Component ─────────────────────────────────────────────────

export default function UploadPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState<{ id: string; contentHash: string } | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const figureRef = useRef<HTMLInputElement>(null);
  const dataRef   = useRef<HTMLInputElement>(null);

  // Check auth
  useEffect(() => {
    fetch("/api/me").then(r => r.json()).then(d => {
      if (d.address) setWalletAddress(d.address);
    });
  }, []);

  const set = (key: keyof FormState, value: any) =>
    setForm(f => ({ ...f, [key]: value }));

  // ── Step validation ────────────────────────────────────────

  function canAdvance(): boolean {
    switch (step) {
      case 1: return !!form.roType && !!form.dataType;
      case 2: return !!form.species.trim() && !!form.experimentalSystem;
      case 3: return !!form.title.trim() && !!form.abstract.trim()
                  && !!form.claim.trim() && !!form.description.trim()
                  && wordCount(form.abstract) <= 150;
      case 4: return !!form.methods.trim();
      case 5: return form.confidence > 0 && !!form.statisticalMethod
                  && Number(form.replicateCount) >= 1;
      case 6: return true; // relationships optional
      case 7: return true; // files optional
      case 8: return !!form.ipStatus && !!form.license;
      default: return false;
    }
  }

  // ── Submit ────────────────────────────────────────────────

  async function handleSubmit() {
    setSubmitting(true);
    setError("");

    const metadata = {
      version: 1,
      orcid: form.orcid || undefined,
      species: form.species,
      experimentalSystem: form.experimentalSystem,
      dataType: form.dataType,
      roType: form.roType,
      title: form.title,
      abstract: form.abstract,
      claim: form.claim,
      description: form.description,
      methods: form.methods,
      reagents: form.reagents,
      confidence: form.confidence,
      replicateCount: Number(form.replicateCount),
      statisticalMethod: form.statisticalMethod,
      relationships: form.relationships
        .filter(r => r.type && r.targetId)
        .map(r => ({ type: r.type as RelationshipType, targetId: r.targetId, note: r.note || undefined })),
      hasCommercialRelevance: form.hasCommercialRelevance,
      diseaseAreaTags: form.diseaseAreaTags,
      ipStatus: form.ipStatus,
      license: form.license,
    };

    const formData = new FormData();
    formData.append("metadata", JSON.stringify(metadata));
    if (form.figureFile) formData.append("figure", form.figureFile);
    if (form.dataFile)   formData.append("dataFile", form.dataFile);

    try {
      const res = await fetch("/api/ro/submit", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Submission failed");
        setSubmitting(false);
        return;
      }
      setSubmitted({ id: json.ro.id, contentHash: json.ro.contentHash });
    } catch {
      setError("Network error — check your connection and try again");
    }
    setSubmitting(false);
  }

  // ── Success screen ────────────────────────────────────────

  if (submitted) {
    return (
      <>
        <style>{css}</style>
        <div className="wz-wrap">
          <div className="wz-success">
            <span className="wz-success-icon">⬡</span>
            <div className="wz-success-title">Research Object submitted.</div>
            <p style={{ color: "var(--text)", fontSize: 15, marginBottom: 8 }}>
              Your result is now part of the open record.
            </p>
            <div className="wz-success-hash">
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--subtle)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>Content hash (SHA-256)</div>
              {submitted.contentHash}
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <a href="/explore" className="wz-btn wz-btn-ghost">← Explore the feed</a>
              <button onClick={() => { setSubmitted(null); setForm(INITIAL); setStep(1); }} className="wz-btn wz-btn-primary">
                Submit another RO
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Auth gate ─────────────────────────────────────────────

  if (!walletAddress) {
    return (
      <>
        <style>{css}</style>
        <div className="wz-wrap" style={{ textAlign: "center", paddingTop: 80 }}>
          <div style={{ fontSize: 40, marginBottom: 20 }}>⬡</div>
          <div style={{ fontFamily: "Helvetica, Arial, sans-serif", fontSize: 22, fontWeight: 700, color: "var(--bright)", marginBottom: 12 }}>
            Sign in to submit a Research Object
          </div>
          <p style={{ color: "var(--subtle)", marginBottom: 28, fontSize: 14 }}>
            Your wallet is your signature — proof that this result came from you.
          </p>
          <a href="/" className="wz-btn wz-btn-primary">← Sign in on homepage</a>
        </div>
      </>
    );
  }

  // ── Step content ──────────────────────────────────────────

  const STEP_TITLES = [
    "", // 0 unused
    "What kind of result?",
    "The experiment",
    "The content",
    "Methods & reagents",
    "Evidence quality",
    "Link related work",
    "Files",
    "Rights & submit",
  ];
  const STEP_SUBS = [
    "",
    "Choose the type of research object you're submitting.",
    "Describe the experimental system.",
    "Write the core scientific content.",
    "Describe how this was done.",
    "How strong is the evidence?",
    "Connect this RO to existing research objects.",
    "Attach a figure or data file (optional).",
    "Choose how this work can be used.",
  ];

  return (
    <>
      <style>{css}</style>
      <div className="wz-wrap">

        {/* Nav */}
        <div className="wz-nav">
          <a href="/" className="wz-wordmark">carrier<em>wave</em></a>
          <a href="/explore" className="wz-btn wz-btn-ghost" style={{ fontSize: 13, padding: "7px 14px" }}>
            ← Feed
          </a>
        </div>

        {/* Progress */}
        <div className="wz-progress">
          <div className="wz-progress-track">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <div
                key={i}
                className={`wz-progress-seg ${i + 1 < step ? "done" : i + 1 === step ? "active" : ""}`}
              />
            ))}
          </div>
          <div className="wz-progress-label">
            <span>Step <span>{step}</span> of {TOTAL_STEPS}</span>
            <span>{STEP_TITLES[step]}</span>
          </div>
        </div>

        {/* Step header */}
        <div className="wz-step-header">
          <div className="wz-step-eyebrow">Step {step} — Submit Research Object</div>
          <div className="wz-step-title">{STEP_TITLES[step]}</div>
          <div className="wz-step-sub">{STEP_SUBS[step]}</div>
        </div>

        {/* Error */}
        {error && <div className="wz-error">{error}</div>}

        {/* ── Step body ── */}
        <div className="wz-step-body" key={step}>

          {/* STEP 1 — Type */}
          {step === 1 && (
            <>
              <div className="wz-field">
                <label className="wz-label">Result type <span className="wz-label-sub">required</span></label>
                <div className="wz-card-grid wz-card-grid-2">
                  {RO_TYPE_OPTIONS.map(opt => (
                    <div
                      key={opt.value}
                      className={`wz-option-card${form.roType === opt.value ? " selected" : ""}`}
                      onClick={() => set("roType", opt.value)}
                    >
                      <span className="wz-option-card-icon">{opt.icon}</span>
                      <div className="wz-option-card-label">{opt.label}</div>
                      <div className="wz-option-card-desc">{opt.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="wz-field">
                <label className="wz-label">Data type <span className="wz-label-sub">required</span></label>
                <select className="wz-select" value={form.dataType} onChange={e => set("dataType", e.target.value)}>
                  <option value="">Select data type…</option>
                  {DATA_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </>
          )}

          {/* STEP 2 — Experiment */}
          {step === 2 && (
            <>
              <div className="wz-field">
                <label className="wz-label">Species <span className="wz-label-sub">required</span></label>
                <input
                  className="wz-input" type="text" value={form.species}
                  onChange={e => set("species", e.target.value)}
                  placeholder="e.g. Mus musculus, Homo sapiens, C. elegans, Universal…"
                />
              </div>
              <div className="wz-field">
                <label className="wz-label">Experimental system <span className="wz-label-sub">required</span></label>
                <div className="wz-card-grid">
                  {EXP_SYSTEM_OPTIONS.map(opt => (
                    <div
                      key={opt.value}
                      className={`wz-exp-card${form.experimentalSystem === opt.value ? " selected" : ""}`}
                      onClick={() => set("experimentalSystem", opt.value)}
                    >
                      <div>
                        <div className="wz-exp-card-label">{opt.label}</div>
                        <div className="wz-exp-card-desc">{opt.desc}</div>
                      </div>
                      <div className="wz-exp-card-check">{form.experimentalSystem === opt.value ? "✓" : ""}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="wz-field">
                <label className="wz-label">ORCID <span className="wz-label-sub">optional</span></label>
                <input
                  className="wz-input" type="text" value={form.orcid}
                  onChange={e => set("orcid", e.target.value)}
                  placeholder="0000-0000-0000-0000"
                />
              </div>
            </>
          )}

          {/* STEP 3 — Content */}
          {step === 3 && (
            <>
              <div className="wz-field">
                <label className="wz-label">Title <span className="wz-label-sub">required</span></label>
                <input
                  className="wz-input" type="text" value={form.title}
                  onChange={e => set("title", e.target.value)}
                  placeholder="e.g. PINK1 knockdown reduces mitochondrial membrane potential in glucose-deprived MEFs"
                />
              </div>
              <div className="wz-field">
                <label className="wz-label">
                  Abstract <span className="wz-label-sub">required · max 150 words</span>
                </label>
                <textarea
                  className="wz-textarea" value={form.abstract}
                  onChange={e => set("abstract", e.target.value)}
                  placeholder="2–4 sentences describing the result and key context."
                  rows={5}
                />
                <div className={`wz-char-count${wordCount(form.abstract) > 150 ? " warn" : ""}`}>
                  {wordCount(form.abstract)} / 150 words
                </div>
              </div>
              <div className="wz-field">
                <label className="wz-label">
                  Claim <span className="wz-label-sub">required · one sentence, quantitative</span>
                </label>
                <input
                  className="wz-input" type="text" value={form.claim}
                  onChange={e => set("claim", e.target.value)}
                  placeholder="e.g. PINK1 knockdown reduces ΔΨm by 34% ± 4% in glucose-deprived MEFs (p < 0.001, n=4)"
                />
              </div>
              <div className="wz-field">
                <label className="wz-label">
                  Full description <span className="wz-label-sub">required</span>
                </label>
                <textarea
                  className="wz-textarea" value={form.description}
                  onChange={e => set("description", e.target.value)}
                  placeholder="Full description of the experimental finding, context, and interpretation."
                  rows={6}
                />
              </div>
            </>
          )}

          {/* STEP 4 — Methods & reagents */}
          {step === 4 && (
            <>
              <div className="wz-field">
                <label className="wz-label">Methods <span className="wz-label-sub">required</span></label>
                <textarea
                  className="wz-textarea" value={form.methods}
                  onChange={e => set("methods", e.target.value)}
                  placeholder="Describe your experimental protocol in enough detail for replication."
                  rows={6}
                />
              </div>
              <div className="wz-field">
                <label className="wz-label">Reagents <span className="wz-label-sub">optional</span></label>
                {form.reagents.length > 0 && (
                  <div className="wz-reagent-list">
                    {form.reagents.map((r, i) => (
                      <div key={i} className="wz-reagent-row">
                        <div className="wz-reagent-row-top">
                          <input
                            className="wz-input" placeholder="Name" value={r.name}
                            onChange={e => {
                              const rs = [...form.reagents];
                              rs[i] = { ...rs[i], name: e.target.value };
                              set("reagents", rs);
                            }}
                          />
                          <select
                            className="wz-select" value={r.type}
                            onChange={e => {
                              const rs = [...form.reagents];
                              rs[i] = { ...rs[i], type: e.target.value };
                              set("reagents", rs);
                            }}
                            style={{ width: "auto" }}
                          >
                            {REAGENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <button className="wz-reagent-del" onClick={() => set("reagents", form.reagents.filter((_, j) => j !== i))}>×</button>
                        </div>
                        <input className="wz-input" placeholder="Identifier / catalog #" value={r.identifier}
                          onChange={e => { const rs = [...form.reagents]; rs[i] = { ...rs[i], identifier: e.target.value }; set("reagents", rs); }} />
                        <input className="wz-input" placeholder="Source / vendor" value={r.source}
                          onChange={e => { const rs = [...form.reagents]; rs[i] = { ...rs[i], source: e.target.value }; set("reagents", rs); }} />
                      </div>
                    ))}
                  </div>
                )}
                <button
                  className="wz-btn wz-btn-ghost"
                  style={{ fontSize: 13 }}
                  onClick={() => set("reagents", [...form.reagents, { name: "", type: "other", identifier: "", source: "" }])}
                >
                  + Add reagent
                </button>
              </div>
            </>
          )}

          {/* STEP 5 — Evidence quality */}
          {step === 5 && (
            <>
              <div className="wz-field">
                <label className="wz-label">Confidence level <span className="wz-label-sub">required</span></label>
                <div className="wz-conf-grid">
                  {([
                    { level: 1 as ConfidenceLevel, color: "#ff9f43", label: "Preliminary", desc: "Single lab, not yet replicated" },
                    { level: 2 as ConfidenceLevel, color: "#4f8cff", label: "Replicated",  desc: "Replicated within or across labs" },
                    { level: 3 as ConfidenceLevel, color: "#2eddaa", label: "Validated",   desc: "Independent multi-site validation" },
                  ]).map(c => (
                    <div
                      key={c.level}
                      className={`wz-conf-card${form.confidence === c.level ? ` selected-${c.level}` : ""}`}
                      onClick={() => set("confidence", c.level)}
                    >
                      <div className="wz-conf-dots">
                        {[1,2,3].map(i => (
                          <div key={i} className="wz-conf-dot"
                            style={{ background: i <= c.level ? c.color : "var(--muted)" }} />
                        ))}
                      </div>
                      <div className="wz-conf-level" style={form.confidence === c.level ? { color: c.color } : {}}>
                        {c.label}
                      </div>
                      <div className="wz-conf-desc">{c.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="wz-field">
                <label className="wz-label">Number of replicates <span className="wz-label-sub">required</span></label>
                <input
                  className="wz-input" type="number" min="1" max="999"
                  value={form.replicateCount}
                  onChange={e => set("replicateCount", e.target.value)}
                  style={{ maxWidth: 160 }}
                />
              </div>
              <div className="wz-field">
                <label className="wz-label">Statistical method <span className="wz-label-sub">required</span></label>
                <select className="wz-select" value={form.statisticalMethod} onChange={e => set("statisticalMethod", e.target.value)}>
                  <option value="">Select…</option>
                  {STAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </>
          )}

          {/* STEP 6 — Relationships */}
          {step === 6 && <RelationshipStep form={form} setForm={setForm} />}

          {/* STEP 7 — Files */}
          {step === 7 && (
            <>
              <div className="wz-field">
                <label className="wz-label">Figure <span className="wz-label-sub">optional · max 20 MB · PNG, JPG, PDF, SVG</span></label>
                <div
                  className="wz-dropzone"
                  onClick={() => figureRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("drag-over"); }}
                  onDragLeave={e => e.currentTarget.classList.remove("drag-over")}
                  onDrop={e => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("drag-over");
                    const file = e.dataTransfer.files[0];
                    if (file) set("figureFile", file);
                  }}
                >
                  <div className="wz-dropzone-icon">🖼</div>
                  <div className="wz-dropzone-label">Drop a figure here or click to browse</div>
                  <div className="wz-dropzone-sub">PNG · JPG · PDF · SVG · max 20 MB</div>
                </div>
                <input ref={figureRef} type="file" accept=".png,.jpg,.jpeg,.pdf,.svg" style={{ display: "none" }}
                  onChange={e => set("figureFile", e.target.files?.[0] ?? null)} />
                {form.figureFile && (
                  <div className="wz-file-chosen">
                    ✓ {form.figureFile.name} ({Math.round(form.figureFile.size / 1024)} KB)
                    <span style={{ marginLeft: "auto", cursor: "pointer", color: "var(--subtle)" }}
                      onClick={() => set("figureFile", null)}>×</span>
                  </div>
                )}
              </div>

              <div className="wz-field">
                <label className="wz-label">Data file <span className="wz-label-sub">optional · max 50 MB</span></label>
                <div
                  className="wz-dropzone"
                  onClick={() => dataRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("drag-over"); }}
                  onDragLeave={e => e.currentTarget.classList.remove("drag-over")}
                  onDrop={e => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("drag-over");
                    const file = e.dataTransfer.files[0];
                    if (file) set("dataFile", file);
                  }}
                >
                  <div className="wz-dropzone-icon">📦</div>
                  <div className="wz-dropzone-label">Drop a data file here or click to browse</div>
                  <div className="wz-dropzone-sub">CSV · TSV · XLSX · JSON · ZIP · max 50 MB</div>
                </div>
                <input ref={dataRef} type="file" accept=".csv,.tsv,.xlsx,.json,.zip,.tar.gz" style={{ display: "none" }}
                  onChange={e => set("dataFile", e.target.files?.[0] ?? null)} />
                {form.dataFile && (
                  <div className="wz-file-chosen">
                    ✓ {form.dataFile.name} ({Math.round(form.dataFile.size / 1024)} KB)
                    <span style={{ marginLeft: "auto", cursor: "pointer", color: "var(--subtle)" }}
                      onClick={() => set("dataFile", null)}>×</span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* STEP 8 — Rights & submit */}
          {step === 8 && (
            <>
              <div className="wz-field">
                <label className="wz-label">License <span className="wz-label-sub">required</span></label>
                <div className="wz-license-grid">
                  {[
                    { value: "CC-BY-4.0" as License, title: "CC-BY 4.0", desc: "Free for all uses including commercial. Attribution required. Recommended for most findings." },
                    { value: "delayed_commercial" as License, title: "Delayed commercial", desc: "Free for academic use immediately. Commercial use requires a license from the submitter." },
                  ].map(l => (
                    <div key={l.value}
                      className={`wz-license-card${form.license === l.value ? " selected" : ""}`}
                      onClick={() => set("license", l.value)}>
                      <div className="wz-license-title">{l.title}</div>
                      <div className="wz-license-desc">{l.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="wz-field">
                <label className="wz-label">IP status <span className="wz-label-sub">required</span></label>
                <select className="wz-select" value={form.ipStatus} onChange={e => set("ipStatus", e.target.value)}>
                  <option value="">Select…</option>
                  <option value="no_restrictions">No restrictions</option>
                  <option value="institutional_review_pending">Institutional review pending</option>
                  <option value="licensed">Licensed</option>
                </select>
              </div>

              <div className="wz-field">
                <label className="wz-label">Commercial relevance</label>
                <div
                  className={`wz-exp-card${form.hasCommercialRelevance ? " selected" : ""}`}
                  style={{ marginBottom: 0 }}
                  onClick={() => set("hasCommercialRelevance", !form.hasCommercialRelevance)}
                >
                  <div>
                    <div className="wz-exp-card-label">This result has potential commercial relevance</div>
                    <div className="wz-exp-card-desc">Flags this RO for industry-facing landscape reports</div>
                  </div>
                  <div className="wz-exp-card-check">{form.hasCommercialRelevance ? "✓" : ""}</div>
                </div>
              </div>

              <div className="wz-field">
                <label className="wz-label">Disease area tags <span className="wz-label-sub">optional · press Enter to add</span></label>
                <input
                  className="wz-input" type="text" value={form.diseaseTagInput}
                  onChange={e => set("diseaseTagInput", e.target.value)}
                  placeholder="e.g. Parkinson's disease"
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const tag = form.diseaseTagInput.trim();
                      if (tag && !form.diseaseAreaTags.includes(tag)) {
                        set("diseaseAreaTags", [...form.diseaseAreaTags, tag]);
                      }
                      set("diseaseTagInput", "");
                    }
                  }}
                />
                {form.diseaseAreaTags.length > 0 && (
                  <div className="wz-tags">
                    {form.diseaseAreaTags.map(tag => (
                      <div key={tag} className="wz-tag">
                        {tag}
                        <span className="wz-tag-x" onClick={() => set("diseaseAreaTags", form.diseaseAreaTags.filter(t => t !== tag))}>×</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Review panel */}
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--subtle)", marginBottom: 14, marginTop: 32 }}>Review before submitting</div>
              <div className="wz-review">
                {[
                  { k: "Type",        v: form.roType.replace(/_/g, " ") },
                  { k: "Data type",   v: form.dataType.replace(/_/g, " ") },
                  { k: "Species",     v: form.species },
                  { k: "System",      v: form.experimentalSystem.replace(/_/g, " ") },
                  { k: "Title",       v: form.title, bright: true },
                  { k: "Claim",       v: form.claim, claim: true },
                  { k: "Confidence",  v: ["", "Preliminary", "Replicated", "Validated"][form.confidence] },
                  { k: "Replicates",  v: `n = ${form.replicateCount}` },
                  { k: "Statistics",  v: form.statisticalMethod.replace(/_/g, " ") },
                  { k: "License",     v: form.license },
                  { k: "IP status",   v: form.ipStatus.replace(/_/g, " ") },
                  { k: "Figure",      v: form.figureFile?.name ?? "None" },
                  { k: "Data file",   v: form.dataFile?.name ?? "None" },
                ].map(row => (
                  <div key={row.k} className="wz-review-row">
                    <div className="wz-review-key">{row.k}</div>
                    {(row as any).claim
                      ? <div className="wz-review-claim">{row.v}</div>
                      : <div className={`wz-review-val${(row as any).bright ? " bright" : ""}`}>{row.v}</div>
                    }
                  </div>
                ))}
              </div>

              <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--subtle)", lineHeight: 1.7, marginBottom: 8 }}>
                By submitting, you confirm this is original work and you have the right to disclose it.
                Your wallet address will be permanently associated with this Research Object.
              </div>
            </>
          )}

        </div>{/* end step body */}

        {/* Navigation */}
        <div className="wz-nav-buttons">
          <button
            className="wz-btn wz-btn-ghost"
            onClick={() => step > 1 ? setStep(s => s - 1) : router.push("/")}
          >
            ← {step === 1 ? "Cancel" : "Back"}
          </button>

          {step < TOTAL_STEPS ? (
            <button
              className="wz-btn wz-btn-primary"
              disabled={!canAdvance()}
              onClick={() => setStep(s => s + 1)}
            >
              Continue →
            </button>
          ) : (
            <button
              className="wz-btn wz-btn-submit"
              disabled={!canAdvance() || submitting}
              onClick={handleSubmit}
            >
              {submitting ? <><span className="wz-spinner" /> Submitting…</> : "⬡ Submit Research Object"}
            </button>
          )}
        </div>

      </div>
    </>
  );
}
